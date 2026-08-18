export type DreamyEmotionName =
  | "happy"
  | "sad"
  | "angry"
  | "surprise"
  | "thinking";

export type RealtimeCharacterConfig = {
  childName: string;
  answerTimeoutMs: number;
  maxReminders: number;
  quizCooldownMs: number;
};

export type RealtimeSession = {
  ok: boolean;
  character: RealtimeCharacterConfig;
  services: {
    realtime: boolean;
    narration: boolean;
  };
};

export type RealtimeReadingState = {
  ok: boolean;
  bookId: string | null;
  title?: string;
  level?: number;
  page?: number;
  pageCount?: number;
  sentences?: string[];
};

export type RealtimeServerEvent = Record<string, unknown> & {
  type?: string;
  transcript?: string;
  response?: unknown;
};

type JsonRecord = Record<string, unknown>;

type RealtimeClientHandlers = {
  onAnalyser: (analyser: AnalyserNode | null) => void;
  onConnectionChange: (connected: boolean) => void;
  onEvent: (event: RealtimeServerEvent) => void;
  onResponse: (tag: string | null, text: string) => void;
};

type RealtimeConnectionContext = {
  childName: string;
  storyTitle: string;
};

type PendingRealtimeResponse = {
  requestId: string;
  tag: string;
};

const configuredBase = import.meta.env.VITE_REALTIME_INTERACTION_API_URL;

export const realtimeInteractionApiBase = (
  configuredBase || "/interaction-api"
).replace(/\/$/, "");

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${realtimeInteractionApiBase}${path}`, init);
  const data = (await response.json()) as T & { ok?: boolean; error?: string };

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Realtime API request failed: ${path}`);
  }

  return data;
}

export function getRealtimeSession() {
  return requestJson<RealtimeSession>("/session");
}

export function getRealtimeReadingState() {
  return requestJson<RealtimeReadingState>("/state");
}

export function saveRealtimeQuizLog(entry: JsonRecord) {
  return requestJson<{ ok: boolean }>("/quiz-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => undefined);
}

export function parseJsonObject(text: string): JsonRecord | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as JsonRecord;
  } catch {
    return null;
  }
}

function extractResponseText(response: unknown) {
  if (!response || typeof response !== "object") {
    return "";
  }

  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  let text = "";
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }
      const value = part as { text?: unknown; transcript?: unknown };
      if (typeof value.text === "string") {
        text += value.text;
      } else if (typeof value.transcript === "string") {
        text += value.transcript;
      }
    }
  }

  return text.trim();
}

export class RealtimeInteractionClient {
  private readonly handlers: RealtimeClientHandlers;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private pendingResponse: PendingRealtimeResponse | null = null;
  private responseSequence = 0;
  private connected = false;

  constructor(handlers: RealtimeClientHandlers) {
    this.handlers = handlers;
  }

  get isConnected() {
    return this.connected;
  }

  get hasPendingResponse() {
    return this.pendingResponse !== null;
  }

  setMicrophoneEnabled(enabled: boolean) {
    this.localStream
      ?.getAudioTracks()
      .forEach((track) => {
        track.enabled = enabled;
      });
  }

  async connect(
    audioElement: HTMLAudioElement,
    context?: RealtimeConnectionContext,
  ) {
    if (this.connected) {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저에서는 마이크를 사용할 수 없습니다.");
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const peerConnection = new RTCPeerConnection();
    const remoteStream = new MediaStream();
    this.peerConnection = peerConnection;
    audioElement.srcObject = remoteStream;
    audioElement.autoplay = true;
    audioElement.setAttribute("playsinline", "");

    peerConnection.ontrack = (event) => {
      if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
      this.attachAnalyser(remoteStream);
      void audioElement.play().catch(() => undefined);
    };

    for (const track of this.localStream.getTracks()) {
      peerConnection.addTrack(track, this.localStream);
    }

    const dataChannel = peerConnection.createDataChannel("oai-events");
    this.dataChannel = dataChannel;
    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as RealtimeServerEvent;
        this.handlers.onEvent(message);

        if (message.type === "response.done") {
          const response = message.response as
            | { metadata?: Record<string, unknown> }
            | undefined;
          const requestId = response?.metadata?.interaction_request_id;
          const pendingResponse = this.pendingResponse;

          if (
            !pendingResponse ||
            typeof requestId !== "string" ||
            requestId !== pendingResponse.requestId
          ) {
            return;
          }

          this.pendingResponse = null;
          this.handlers.onResponse(
            pendingResponse.tag,
            extractResponseText(message.response),
          );
        }
      } catch (error) {
        console.error("Realtime event parsing failed:", error);
      }
    };

    const channelOpened = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("음성 연결 시간이 초과되었습니다.")),
        15_000,
      );
      dataChannel.onopen = () => {
        window.clearTimeout(timer);
        resolve();
      };
      dataChannel.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("음성 데이터 채널을 열지 못했습니다."));
      };
    });

    peerConnection.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peerConnection.connectionState)) {
        this.setConnected(false);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    const answer = await requestJson<{ ok: boolean; sdp: string }>("/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sdp: offer.sdp }),
    });

    await peerConnection.setRemoteDescription({ type: "answer", sdp: answer.sdp });
    await channelOpened;
    if (context) {
      this.send({
        type: "session.update",
        session: {
          type: "realtime",
          audio: {
            input: {
              turn_detection: {
                type: "server_vad",
                create_response: false,
                interrupt_response: false,
              },
            },
          },
          instructions: [
            `너는 동화 「${context.storyTitle}」를 함께 읽는 다정한 캐릭터 드리미다.`,
            `현재 아이의 프로필 이름은 ${context.childName}이다. 다른 이름으로 부르지 마라.`,
            "항상 한국어로, 유치원생이 이해할 수 있는 짧고 쉬운 문장으로 말한다.",
            "아이에게 질문할 때는 현재 아이의 이름을 자연스럽게 한 번 부른다.",
            "제공된 동화 내용 밖의 인물이나 사건, 아직 읽지 않은 전개는 만들지 않는다.",
            "JSON으로만 답하라는 요청에는 JSON 객체 하나만 출력한다.",
            "주어진 문장을 그대로 말하라는 요청에는 그 문장 전체만 끝까지 말한다.",
          ].join("\n"),
        },
      });
    }
    this.setConnected(true);
  }

  requestJson(instructions: string, tag: string) {
    return this.createResponse(tag, {
      output_modalities: ["text"],
      instructions,
    });
  }

  requestSpeak(line: string, tag: string) {
    const normalizedLine = line.replace(/\s+/g, " ").trim();
    if (this.pendingResponse || !normalizedLine) {
      return false;
    }
    this.setMicrophoneEnabled(false);
    return this.createResponse(tag, {
      output_modalities: ["audio"],
      max_output_tokens: 2048,
      instructions: [
        "[발화할 전체 문장]",
        normalizedLine,
        "[발화 규칙]",
        "위 문장의 첫 글자부터 마지막 글자까지 자연스럽게 한 번 읽어라.",
        "이름을 부른 뒤에도 멈추지 말고 문장 전체를 끝까지 말하라.",
        "문장에 없는 말은 앞뒤에 덧붙이지 마라.",
      ].join("\n"),
    });
  }

  close() {
    this.dataChannel?.close();
    if (this.peerConnection) {
      this.peerConnection.getSenders().forEach((sender) => sender.track?.stop());
      this.peerConnection.close();
    }
    this.localStream?.getTracks().forEach((track) => track.stop());
    void this.audioContext?.close().catch(() => undefined);

    this.dataChannel = null;
    this.peerConnection = null;
    this.localStream = null;
    this.audioContext = null;
    this.pendingResponse = null;
    this.handlers.onAnalyser(null);
    this.setConnected(false);
  }

  private createResponse(tag: string, response: JsonRecord) {
    if (this.pendingResponse) {
      return false;
    }

    const requestId = `${tag}-${Date.now()}-${++this.responseSequence}`;
    this.pendingResponse = { requestId, tag };

    try {
      this.send({
        type: "response.create",
        response: {
          ...response,
          conversation: "none",
          metadata: {
            interaction_request_id: requestId,
            interaction_tag: tag,
          },
        },
      });
      return true;
    } catch (error) {
      this.pendingResponse = null;
      throw error;
    }
  }

  private attachAnalyser(remoteStream: MediaStream) {
    try {
      this.audioContext ||= new AudioContext();
      if (this.audioContext.state === "suspended") {
        void this.audioContext.resume();
      }
      const source = this.audioContext.createMediaStreamSource(remoteStream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      this.handlers.onAnalyser(analyser);
    } catch (error) {
      console.error("Realtime audio analysis failed:", error);
      this.handlers.onAnalyser(null);
    }
  }

  private send(event: JsonRecord) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      throw new Error("음성 연결이 아직 준비되지 않았습니다.");
    }
    this.dataChannel.send(JSON.stringify(event));
  }

  private setConnected(connected: boolean) {
    if (this.connected === connected) {
      return;
    }
    this.connected = connected;
    this.handlers.onConnectionChange(connected);
  }
}
