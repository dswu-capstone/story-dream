/**
 * RealtimeGateway — OpenAI Realtime WebRTC SDP 프록시.
 * API 키를 서버에만 두고, 브라우저의 SDP offer를 받아 세션을 만든다.
 * 퀴즈 캐릭터의 시스템 instructions도 여기서 구성한다.
 */

class RealtimeGateway {
  constructor({ apiKey, character }) {
    this.apiKey = apiKey;
    this.character = character;
  }

  get available() {
    return Boolean(this.apiKey);
  }

  buildInstructions(storyTitle) {
    const c = this.character;
    return [
      `너는 동화 "${storyTitle}" 속 캐릭터 ${c.characterName}다.`,
      `아이 이름은 ${c.childName}이다. 말할 때 가끔 이름을 다정하게 불러라.`,
      "역할: 아이가 동화에 집중하지 못할 때 나타나, 방금 읽어준 내용으로 아주 쉬운 퀴즈를 내고 아이의 대답을 확인해 다시 이야기로 데려온다.",
      "말하기 규칙: 항상 한국어. 유치원생이 이해할 짧고 쉬운 문장. 다정하고 신나는 말투. 혼내거나 겁주지 않는다.",
      "JSON 규칙: 지시에 'JSON으로만'이라는 말이 있으면 인사말·설명·코드블록 없이 요청된 JSON 객체 하나만 출력한다.",
      "그대로 말하기 규칙: 지시에 '다음 문장을 그대로 말하라'가 있으면 주어진 문장만 자연스럽게 소리 내어 말하고 다른 말을 덧붙이지 않는다."
    ].join("\n");
  }

  buildSessionPayload(storyTitle) {
    const c = this.character;
    return {
      type: "realtime",
      model: c.model,
      instructions: this.buildInstructions(storyTitle),
      output_modalities: ["audio"],
      audio: {
        input: {
          noise_reduction: { type: "near_field" },
          transcription: { model: "gpt-4o-mini-transcribe", language: "ko" },
          turn_detection: {
            type: "server_vad",
            // 퀴즈 사이클이 모든 응답을 직접 생성하므로(JSON→발화→판정),
            // 아이 발화가 자동 응답을 만들면 안 된다.
            create_response: false,
            interrupt_response: false,
            threshold: c.threshold,
            prefix_padding_ms: c.prefixPaddingMs,
            silence_duration_ms: c.silenceDurationMs
          }
        },
        output: { voice: c.voice, speed: 1.0 }
      }
    };
  }

  async createCall(sdp, storyTitle) {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const session = this.buildSessionPayload(storyTitle);
    const form = new FormData();
    form.set("sdp", sdp);
    form.set("session", JSON.stringify(session));

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form
    });

    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        message = JSON.parse(text)?.error?.message || text;
      } catch {}
      throw new Error(message || `Realtime call failed with status ${response.status}`);
    }

    return { sdp: text, session };
  }
}

module.exports = { RealtimeGateway };
