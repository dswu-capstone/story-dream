import { callChild } from "../../utils/childAddress";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "./realtimeInteractionPage.css";

import {
  getRealtimeReadingState,
  getRealtimeSession,
  parseJsonObject,
  RealtimeInteractionClient,
  saveRealtimeQuizLog,
  type DreamyEmotionName,
  type RealtimeCharacterConfig,
  type RealtimeServerEvent,
} from "../../api/realtimeInteraction";
import { getProfile } from "../../api/profile";
import { getStoryDetail } from "../../api/story";
import replayIcon from "../../assets/mingcute_voice-line.svg";
import DreamyCharacter from "../../components/DreamyCharacter/dreamyCharacter";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";
import type { ReadingSession, StoryDetail, StoryPage } from "../../types/story";
import {
  getReadingPageProgress,
  getVisitedReadingParts,
  loadReadingSession,
} from "../../utils/readingSession";

type InteractionPhase =
  | "idle"
  | "connecting"
  | "asking"
  | "listening"
  | "thinking"
  | "feedback"
  | "complete";

type InteractionMode = "realtime" | "browser" | null;

type SpeechRecognitionEventLike = Event & {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const defaultConfig: RealtimeCharacterConfig = {
  childName: "아이",
  answerTimeoutMs: 12_000,
  maxReminders: 2,
  quizCooldownMs: 20_000,
};

const speechWindow = window as typeof window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type StoryContextSnapshot = {
  storyTitle: string;
  partType: string;
  partOrderNum: number;
  currentPageNumber: number;
  totalParts: number;
  sentences: string[];
};

function makeDefaultQuestion(childName: string, storyTitle = "이야기") {
  return `${callChild(childName)}!\n방금 읽은 「${storyTitle}」에서 무슨 일이 있었는지 이야기해 줄래?`;
}

function makeIntroMessage(childName: string) {
  return `${callChild(childName)}!\n방금 읽은 이야기를 같이 떠올려 볼까?`;
}

function normalizeSingleQuestion(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;

  const normalized = value
    .replace(/^[\s\-–—•*\d.)]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return fallback;

  const firstQuestionMark = normalized.indexOf("?");
  if (firstQuestionMark >= 0) {
    return normalized.slice(0, firstQuestionMark + 1);
  }

  const firstSentenceEnd = normalized.search(/[.!]/);
  const singleSentence = (
    firstSentenceEnd >= 0
      ? normalized.slice(0, firstSentenceEnd)
      : normalized
  ).trim();

  return singleSentence ? `${singleSentence}?` : fallback;
}

const browserAnswerStopWords = new Set([
  "그리고",
  "그런데",
  "그냥",
  "깊",
  "나",
  "너",
  "네",
  "내",
  "더",
  "또",
  "맞아",
  "맞아요",
  "뭐",
  "무슨",
  "방금",
  "분명",
  "속",
  "아니",
  "아니야",
  "아니요",
  "어",
  "응",
  "예",
  "이야기",
  "있다",
  "있었",
  "있어",
  "있는",
  "있나요",
  "있었나요",
  "있는지",
  "있었는지",
  "알다",
  "알았",
  "알아",
  "없다",
  "없어",
  "없었",
  "없나요",
  "어디",
  "언제",
  "누가",
  "누구",
  "무엇",
  "왜",
  "어떻게",
  "뭐였",
  "무엇이었",
  "했나요",
  "했니",
  "였나요",
  "인가요",
  "일이",
  "일은",
  "내용",
  "장면",
  "부분",
  "생각",
  "말해",
  "말했",
  "말할",
  "말했지",
  "말해줄",
  "대답",
  "정말",
  "잘",
  "조금",
  "다시",
  "했어",
  "했어요",
  "했지",
  "했죠",
]);

function normalizeBrowserToken(token: string) {
  let normalized = token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const suffixes = [
    "이었어요",
    "였어요",
    "했어요",
    "이에요",
    "예요",
    "어요",
    "아요",
    "었어요",
    "았어요",
    "나요",
    "어요",
    "아요",
    "었어",
    "았어",
    "었지",
    "았지",
    "었니",
    "았니",
    "아서",
    "어서",
    "니",
    "했어",
    "였어",
    "이었어",
    "했지",
    "였지",
    "하고",
    "해서",
    "하며",
    "으로",
    "에서",
    "에게",
    "부터",
    "까지",
    "에는",
    "은",
    "는",
    "이",
    "가",
    "을",
    "를",
    "에",
    "도",
    "의",
    "로",
    "와",
    "과",
    "랑",
    "만",
    "다",
    "요",
    "어",
    "아",
    "지",
  ];

  for (const suffix of suffixes) {
    if (normalized.length > suffix.length + 1 && normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }
  return normalized;
}

function getBrowserMeaningfulTokens(text: string) {
  return text
    .split(/\s+/)
    .map(normalizeBrowserToken)
    .filter(
      (token) => token.length >= 2 && !browserAnswerStopWords.has(token),
    );
}

function gradeBrowserAnswer(
  question: string,
  answer: string,
  context: string,
  storyTitle = "",
) {
  const normalizedAnswer = answer.replace(/[.!?,，。？！]/gu, " ").trim();
  const answerTokens = getBrowserMeaningfulTokens(normalizedAnswer);
  const questionTokens = getBrowserMeaningfulTokens(question);
  const titleTokens = getBrowserMeaningfulTokens(storyTitle);
  const storySentences = context
    .split(/\r?\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const storyTokens = new Set(getBrowserMeaningfulTokens(context));
  const isUncertainAnswer = /모르겠|몰라|기억이 안|잘 모르/gu.test(normalizedAnswer);
  const isTitleQuestion = /무슨 동화|동화 제목|제목|어떤 동화/u.test(question);
  const isAffirmativeAnswer = /^(응|네|예|맞아|맞아요|그랬어|그랬어요|그래)$/u.test(
    normalizedAnswer,
  );

  let correct = false;
  if (!isUncertainAnswer && isTitleQuestion && titleTokens.length > 0) {
    correct = titleTokens.every((token) => answerTokens.includes(token));
  } else if (!isUncertainAnswer && isAffirmativeAnswer) {
    // 긍정형 답변은 질문의 핵심 내용이 실제 본문에 모두 있을 때만 인정한다.
    correct =
      questionTokens.length > 0 &&
      questionTokens.every((token) => storyTokens.has(token));
  } else if (!isUncertainAnswer) {
    const matchedAnswerTokens = answerTokens.filter((token) =>
      storyTokens.has(token),
    );
    correct = matchedAnswerTokens.length > 0;
  }

  const scoredSentence = [...storySentences]
    .map((sentence, index) => {
      const sentenceTokens = new Set(getBrowserMeaningfulTokens(sentence));
      const answerScore = answerTokens.filter((token) =>
        sentenceTokens.has(token),
      ).length;
      const questionScore = questionTokens.filter((token) =>
        sentenceTokens.has(token),
      ).length;
      return { sentence, index, score: answerScore * 2 + questionScore };
    })
    .sort((first, second) => second.score - first.score || first.index - second.index)[0];

  const referenceSentence = isTitleQuestion && storyTitle
    ? `이 동화의 제목은 「${storyTitle}」야.`
    : scoredSentence?.score
      ? scoredSentence.sentence
      : undefined;

  return { correct, referenceSentence };
}

function getPageSentences(pages: StoryPage[]) {
  return pages.flatMap((page) =>
    page.sentences
      .map((sentence) => sentence.content.trim())
      .filter(Boolean),
  );
}

function buildStoryContext(
  story: StoryDetail,
  readingSession: ReadingSession,
): StoryContextSnapshot {
  const orderedParts = [...story.parts].sort(
    (first, second) => first.orderNum - second.orderNum,
  );
  const currentPart =
    orderedParts.find(
      (part) => part.orderNum === readingSession.currentPart.orderNum,
    ) ??
    orderedParts.find((part) => part.type === readingSession.currentPart.type) ??
    readingSession.currentPart;
  const safePageIndex = Math.min(
    Math.max(readingSession.currentPageIndex, 0),
    Math.max(currentPart.pages.length - 1, 0),
  );
  const previousParts = orderedParts.filter(
    (part) => part.orderNum < currentPart.orderNum,
  );
  const sentences = [
    ...previousParts.flatMap((part) => getPageSentences(part.pages)),
    ...getPageSentences(currentPart.pages.slice(0, safePageIndex + 1)),
  ];

  return {
    storyTitle: story.title || readingSession.storyTitle,
    partType: currentPart.type,
    partOrderNum: currentPart.orderNum,
    currentPageNumber: currentPart.pages[safePageIndex]?.pageNum ?? safePageIndex + 1,
    totalParts: Math.max(orderedParts.length, 1),
    sentences,
  };
}

function buildSessionStoryContext(
  readingSession: ReadingSession,
): StoryContextSnapshot {
  const currentPart = readingSession.currentPart;
  const safePageIndex = Math.min(
    Math.max(readingSession.currentPageIndex, 0),
    Math.max(currentPart.pages.length - 1, 0),
  );

  return {
    storyTitle: readingSession.storyTitle,
    partType: currentPart.type,
    partOrderNum: currentPart.orderNum,
    currentPageNumber: currentPart.pages[safePageIndex]?.pageNum ?? safePageIndex + 1,
    totalParts: 3,
    sentences: [
      ...getVisitedReadingParts(readingSession)
        .filter(({ part }) => part.orderNum < currentPart.orderNum)
        .flatMap(({ part }) => getPageSentences(part.pages)),
      ...getPageSentences(currentPart.pages.slice(0, safePageIndex + 1)),
    ],
  };
}

function normalizeEmotion(value: unknown): DreamyEmotionName {
  if (typeof value !== "string") return "happy";
  const emotions: Record<string, DreamyEmotionName> = {
    happy: "happy",
    sad: "sad",
    angry: "angry",
    surprise: "surprise",
    thinking: "thinking",
    기쁨: "happy",
    슬픔: "sad",
    화남: "angry",
    놀람: "surprise",
    생각: "thinking",
  };
  return emotions[value.trim()] || "happy";
}

type BubbleStyle = CSSProperties & {
  "--bubble-width": string;
  "--bubble-min-height": string;
};

function getBubbleLayout(text: string) {
  const textLength = Array.from(text.replace(/\s/g, "")).length;
  const widthPercent = Math.min(72, 45 + textLength * 0.18);
  const charactersPerLine =
    widthPercent < 54 ? 20 : widthPercent < 64 ? 25 : 31;
  const explicitLineCount = Math.max(text.split("\n").length, 1);
  const estimatedLineCount = Math.max(
    explicitLineCount,
    Math.ceil(textLength / charactersPerLine),
  );
  const minHeight = Math.min(430, Math.max(230, 180 + estimatedLineCount * 45));

  let size = "short";
  if (textLength > 150) size = "xlong";
  else if (textLength > 90) size = "long";
  else if (textLength > 52) size = "medium";

  return {
    size,
    style: {
      "--bubble-width": `${widthPercent}%`,
      "--bubble-min-height": `${minHeight}px`,
    } as BubbleStyle,
  };
}

function RealtimeInteractionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const questionParam = searchParams.get("question");
  const contextParam = searchParams.get("context");
  const [storedReadingSession] = useState(loadReadingSession);
  const [selectedChildId] = useState(() =>
    Number(localStorage.getItem("selectedChildId")),
  );
  const [selectedChildName] = useState(
    () => localStorage.getItem("selectedChildName")?.trim() || "아이",
  );

  const [phase, setPhase] = useState<InteractionPhase>("idle");
  const [mode, setMode] = useState<InteractionMode>(null);
  const [bubbleText, setBubbleText] = useState(
    questionParam || makeIntroMessage(selectedChildName),
  );
  const [emotion, setEmotion] = useState<DreamyEmotionName>("happy");
  const [statusText, setStatusText] = useState(
    "드리미가 말을 걸고 있어요...",
  );
  const [typedAnswer, setTypedAnswer] = useState("");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [storySnapshot, setStorySnapshot] = useState<StoryContextSnapshot | null>(
    () =>
      storedReadingSession
        ? buildSessionStoryContext(storedReadingSession)
        : null,
  );

  const audioRef = useRef<HTMLAudioElement>(null);
  const clientRef = useRef<RealtimeInteractionClient | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const phaseRef = useRef<InteractionPhase>("idle");
  const modeRef = useRef<InteractionMode>(null);
  const configRef = useRef({
    ...defaultConfig,
    childName: selectedChildName,
  });
  const sessionCheckedRef = useRef(false);
  const realtimeAvailableRef = useRef(false);
  const activeQuestionRef = useRef(
    questionParam ||
      makeDefaultQuestion(
        selectedChildName,
        storedReadingSession?.storyTitle,
      ),
  );
  const transcriptRef = useRef("");
  const storyContextRef = useRef(
    contextParam ||
      (storedReadingSession
        ? buildSessionStoryContext(storedReadingSession).sentences.join("\n")
        : "아직 읽고 있는 동화 내용을 불러오지 못했습니다."),
  );
  const answerTimerRef = useRef<number | null>(null);
  const audioTimerRef = useRef<number | null>(null);
  const pendingAudioTagRef = useRef<string | null>(null);
  const audioPlaybackStartedRef = useRef(false);
  const interactionStartInFlightRef = useRef(false);
  const questionGenerationInFlightRef = useRef(false);

  const updatePhase = (next: InteractionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const updateMode = (next: InteractionMode) => {
    modeRef.current = next;
    setMode(next);
  };

  const clearTimers = () => {
    if (answerTimerRef.current !== null) window.clearTimeout(answerTimerRef.current);
    if (audioTimerRef.current !== null) window.clearTimeout(audioTimerRef.current);
    answerTimerRef.current = null;
    audioTimerRef.current = null;
  };

  const prepareSession = useCallback(async () => {
    const profileRequest =
      Number.isInteger(selectedChildId) && selectedChildId > 0
        ? getProfile(selectedChildId)
        : Promise.reject(new Error("선택된 아동 프로필이 없습니다."));
    const storyRequest = storedReadingSession?.visitedParts
      ? Promise.resolve(null)
      : storedReadingSession
      ? getStoryDetail(
          storedReadingSession.originalStoryId,
          storedReadingSession.selectedLevel,
        )
      : Promise.reject(new Error("진행 중인 독서 세션이 없습니다."));
    const [sessionResult, profileResult, storyResult, stateResult] =
      await Promise.allSettled([
        getRealtimeSession(),
        profileRequest,
        storyRequest,
        getRealtimeReadingState(),
      ]);

    let nextSnapshot = storedReadingSession
      ? buildSessionStoryContext(storedReadingSession)
      : null;
    if (storyResult.status === "fulfilled" && storyResult.value && storedReadingSession) {
      nextSnapshot = buildStoryContext(storyResult.value, storedReadingSession);
      setStorySnapshot(nextSnapshot);
      if (!contextParam && nextSnapshot.sentences.length > 0) {
        storyContextRef.current = nextSnapshot.sentences.join("\n");
      }
    }

    const profileChildName =
      profileResult.status === "fulfilled" && profileResult.value.name.trim()
        ? profileResult.value.name.trim()
        : selectedChildName;
    if (profileResult.status === "fulfilled") {
      localStorage.setItem("selectedChildName", profileChildName);
    }

    const realtimeConfig =
      sessionResult.status === "fulfilled"
        ? sessionResult.value.character
        : defaultConfig;
    configRef.current = {
      ...defaultConfig,
      ...realtimeConfig,
      childName: profileChildName,
    };

    if (sessionResult.status === "fulfilled") {
      realtimeAvailableRef.current = sessionResult.value.services.realtime;
    }
    if (
      stateResult.status === "fulfilled" &&
      !storedReadingSession &&
      !contextParam
    ) {
      const sentences = stateResult.value.sentences || [];
      if (sentences.length > 0) {
        storyContextRef.current = sentences.join("\n");
        const fallbackSnapshot: StoryContextSnapshot = {
          storyTitle: stateResult.value.title || "동화",
          partType: "현재 부분",
          partOrderNum: Math.max(
            Number(searchParams.get("partIndex") ?? 0) + 1,
            1,
          ),
          currentPageNumber: Math.max((stateResult.value.page ?? 0) + 1, 1),
          totalParts: Math.max(Number(searchParams.get("totalParts") ?? 3), 1),
          sentences,
        };
        nextSnapshot = fallbackSnapshot;
        setStorySnapshot(fallbackSnapshot);
      }
    }

    if (!questionParam) {
      const question = makeDefaultQuestion(
        configRef.current.childName,
        nextSnapshot?.storyTitle,
      );
      activeQuestionRef.current = question;
      if (phaseRef.current === "idle") {
        setBubbleText(makeIntroMessage(configRef.current.childName));
      }
    }

    sessionCheckedRef.current = true;
  }, [
    contextParam,
    questionParam,
    searchParams,
    selectedChildId,
    selectedChildName,
    storedReadingSession,
  ]);

  useEffect(() => {
    const prepareTimer = window.setTimeout(() => {
      void prepareSession();
    }, 0);
    return () => {
      window.clearTimeout(prepareTimer);
      clearTimers();
      recognitionRef.current?.stop();
      clientRef.current?.close();
      window.speechSynthesis?.cancel();
    };
  }, [prepareSession]);

  const beginListening = () => {
    clientRef.current?.setMicrophoneEnabled(true);
    updatePhase("listening");
    setIsSpeaking(false);
    setBubbleText(activeQuestionRef.current);
    setStatusText("듣고 있어요. 마이크에 대고 천천히 말해 주세요.");
    answerTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "listening") {
        setStatusText("괜찮아요. 말하거나 아래 칸에 답을 적어 주세요.");
      }
    }, configRef.current.answerTimeoutMs);
  };

  const finishAudio = (tag: string | null) => {
    pendingAudioTagRef.current = null;
    audioPlaybackStartedRef.current = false;
    setIsSpeaking(false);
    if (audioTimerRef.current !== null) window.clearTimeout(audioTimerRef.current);
    audioTimerRef.current = null;

    if (tag === "speak-question" || tag === "speak-replay") {
      beginListening();
    } else if (tag === "speak-feedback") {
      updatePhase("complete");
      setStatusText("멋지게 대답했어요! 동화로 돌아가도 좋아요.");
    }
  };

  const expectAudioFinish = (tag: string) => {
    pendingAudioTagRef.current = tag;
    audioPlaybackStartedRef.current = false;
    if (audioTimerRef.current !== null) window.clearTimeout(audioTimerRef.current);
    audioTimerRef.current = window.setTimeout(() => finishAudio(tag), 30_000);
  };

  const speakWithBrowser = (text: string, onEnd: () => void) => {
    if (!("speechSynthesis" in window)) {
      onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/\n/g, " "));
    utterance.lang = "ko-KR";
    utterance.rate = 0.92;
    utterance.pitch = 1.12;
    const koreanVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("ko"));
    if (koreanVoice) utterance.voice = koreanVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd();
    };
    utterance.onerror = utterance.onend;
    window.speechSynthesis.speak(utterance);
  };

  const submitAnswer = (answer: string) => {
    const cleaned = answer.trim();
    if (!cleaned || phaseRef.current !== "listening") return;

    clearTimers();
    recognitionRef.current?.stop();
    clientRef.current?.setMicrophoneEnabled(false);
    transcriptRef.current = cleaned;
    setTypedAnswer("");
    updatePhase("thinking");
    setEmotion("thinking");
    setBubbleText(`${callChild(configRef.current.childName)}, 잠깐 생각해 볼게!`);
    setStatusText(`“${cleaned}”라고 대답했어요.`);

    if (modeRef.current === "realtime" && clientRef.current?.isConnected) {
      clientRef.current.requestJson(
        [
          "JSON으로만 답하라.",
          "[상황] 이 대화는 아이가 동화를 읽는 도중에 잠깐 진행된다.",
          `실제 아이의 프로필 이름: ${JSON.stringify(configRef.current.childName)}. 동화 속 인물과 구분한다.`,
          `퀴즈: ${activeQuestionRef.current.replace(/\n/g, " ")}`,
          `아이의 대답: ${cleaned}`,
          "[아이에게 공개된 동화 내용 — 처음부터 현재 페이지까지]",
          storyContextRef.current,
          "[행동] 위에 제공된 동화 내용만 근거로 아이의 답이 문맥상 맞는지 판단하라. 표현이 달라도 뜻이 맞으면 정답이다.",
          "동의어, 조사 생략, 짧은 답변도 핵심 사실이 맞으면 정답이다. 본문과 모순되거나 질문에 답하지 않는 말, 모르겠다는 답은 정답으로 추측하지 않는다.",
          "feedback은 짧은 두 문장 이내다. 정답이면 맞힌 사실을 확인하고, 오답이면 탓하지 않고 본문에 나온 사실을 알려 준다. 마지막에는 함께 이야기를 이어 읽자고 권한다.",
          "feedback의 격려 문장은 ~ 또는 !로 부드럽게 마무리한다. 예: 함께 다음 이야기도 읽어 보자~ 기호는 문장마다 하나만 사용한다.",
          "답변이 불명확하면 틀렸다고 단정하는 말 대신 본문의 사실을 안내한다. 능력이나 성격을 평가하지 않으며 추가 질문을 하지 않는다. feedback에는 이름을 부르는 호칭을 넣지 않는다.",
          "[예외] 아직 읽지 않은 뒤의 사건은 언급하거나 추측하지 말고, 제공되지 않은 인물·사건을 만들지 마라.",
          "correct는 문자열이 아닌 불리언 true 또는 false다. emotion은 기쁨 또는 놀람 중 하나이며 기본은 기쁨이다. 오답이라고 슬픔이나 화남을 표현하지 않는다.",
          '출력 키는 correct, feedback, emotion만 사용한다. 형식 예: {"correct": true, "feedback": "...", "emotion": "기쁨"}',
        ].join("\n"),
        "judge-json",
      );
      return;
    }

    const browserGrade = gradeBrowserAnswer(
      activeQuestionRef.current,
      cleaned,
      storyContextRef.current,
      storySnapshot?.storyTitle || storedReadingSession?.storyTitle || "",
    );
    const feedback = browserGrade.correct
      ? "맞았어! 지금까지 읽은 내용을 잘 기억했네. 함께 다음 이야기도 읽어 보자!"
      : browserGrade.referenceSentence
        ? `괜찮아, 아쉽지만 정답과는 조금 달라. 정답은 이렇게 나와 있었어: ${browserGrade.referenceSentence} 다시 떠올려 보면서 다음 이야기도 함께 읽어 보자!`
        : "괜찮아, 아직 헷갈릴 수 있어. 정답은 지금까지 읽은 이야기 속에 있어. 함께 다시 떠올려 보자!";
    window.setTimeout(() => {
      setEmotion("happy");
      setBubbleText(feedback);
      updatePhase("feedback");
      setStatusText("드리미가 대답하고 있어요.");
      speakWithBrowser(feedback, () => {
        updatePhase("complete");
        setStatusText(
          browserGrade.correct
            ? "정답이에요. 동화로 돌아가도 좋아요."
            : "이야기 내용을 다시 떠올려 봤어요. 동화로 돌아가도 좋아요.",
        );
      });
    }, 450);
    void saveRealtimeQuizLog({
      question: activeQuestionRef.current,
      answer: cleaned,
      correct: browserGrade.correct,
      emotion: "happy",
      feedback,
      source: "stories-interaction-page-browser",
    });
  };

  const startBrowserRecognition = () => {
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      beginListening();
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      submitAnswer(event.results[0]?.[0]?.transcript || "");
    };
    recognition.onerror = () => {
      setStatusText("음성을 듣지 못했어요. 아래 칸에 답을 적어 주세요.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    beginListening();
    try {
      recognition.start();
    } catch {
      setStatusText("아래 칸에 답을 적어 주세요.");
    }
  };

  const startBrowserInteraction = () => {
    updateMode("browser");
    updatePhase("asking");
    setEmotion("happy");
    setBubbleText(activeQuestionRef.current);
    setStatusText("드리미가 질문하고 있어요.");
    speakWithBrowser(activeQuestionRef.current, startBrowserRecognition);
  };

  const askRealtimeQuestion = () => {
    const client = clientRef.current;
    if (
      questionGenerationInFlightRef.current ||
      !client?.isConnected ||
      client.hasPendingResponse
    ) {
      return;
    }

    questionGenerationInFlightRef.current = true;
    client.setMicrophoneEnabled(false);
    updatePhase("thinking");
    setEmotion("thinking");
    setBubbleText(`${callChild(configRef.current.childName)}, 질문을 생각하고 있어!`);
    setStatusText("방금 읽은 이야기에서 질문을 만들고 있어요.");
    const requested = client.requestJson(
      [
        "JSON으로만 답하라.",
        "[상황] 이 대화는 아이가 동화를 읽는 도중에 잠깐 진행된다.",
        `동화 제목: ${storySnapshot?.storyTitle || storedReadingSession?.storyTitle || "동화"}`,
        `현재 위치: ${storySnapshot?.partType || "현재 부분"} ${storySnapshot?.currentPageNumber || 1}페이지`,
        "[아이에게 공개된 동화 내용 — 처음부터 현재 페이지까지, 시간 순서]",
        storyContextRef.current,
        "",
        `[행동] ${configRef.current.childName}에게 위 내용만으로 바로 답할 수 있는 아주 쉬운 사실 확인 질문을 한 문장으로 만들어라. 가능하면 가장 최근에 읽은 사건을 물어라.`,
        "question에는 질문을 정확히 하나만 넣고 물음표도 하나만 사용하라. 두 가지를 묻거나 연속 질문을 만들지 마라.",
        "인물, 장소, 행동 중 한 가지만 묻는다. 정답이 본문에 명확히 있고 짧은 말로 답할 수 있어야 한다. 부정형이나 이중 부정, 본문에 없는 이유를 묻지 않는다.",
        "질문 앞뒤에 설명, 인사, 추가 질문을 붙이지 마라.",
        "question에는 이름을 부르는 호칭을 넣지 않는다. 프로필 이름은 화면에서 별도로 붙인다. 등장인물은 질문의 주어나 목적어로만 언급한다. emotion은 기쁨 또는 놀람 중 하나이며 기본은 기쁨이다.",
        "[예외] 아직 읽지 않은 뒤의 전개, 결말, 제공되지 않은 인물이나 사건은 절대 질문하지 마라. 아이의 취향이나 감상처럼 정답을 판정할 수 없는 질문도 피하라.",
        '출력 키는 question, emotion만 사용한다. 형식 예: {"question": "... ?", "emotion": "기쁨"}',
      ].join("\n"),
      "quiz-json",
    );

    if (!requested) {
      questionGenerationInFlightRef.current = false;
    }
  };

  const handleRealtimeEvent = (message: RealtimeServerEvent) => {
    if (message.type === "output_audio_buffer.started") {
      audioPlaybackStartedRef.current = true;
      setIsSpeaking(true);
      return;
    }
    if (
      message.type === "output_audio_buffer.stopped" ||
      message.type === "output_audio_buffer.cleared"
    ) {
      if (audioPlaybackStartedRef.current) {
        finishAudio(pendingAudioTagRef.current);
      }
      return;
    }
    if (message.type === "input_audio_buffer.speech_started") {
      if (phaseRef.current === "listening") setStatusText("잘 듣고 있어요...");
      return;
    }
    if (message.type === "conversation.item.input_audio_transcription.completed") {
      submitAnswer(typeof message.transcript === "string" ? message.transcript : "");
    }
  };

  const handleRealtimeResponse = (tag: string | null, text: string) => {
    if (tag === "quiz-json") {
      questionGenerationInFlightRef.current = false;
      const data = parseJsonObject(text);
      const fallbackQuestion = makeDefaultQuestion(
        configRef.current.childName,
        storySnapshot?.storyTitle || storedReadingSession?.storyTitle,
      );
      const questionBody = normalizeSingleQuestion(data?.question, "");
      // Reject an unexpected opening vocative instead of speaking a character's name to the child.
      const hasVocative = /^[^\s,!?]{1,30}[아야](?:\s|[,!])/.test(questionBody);
      const question = questionBody && !hasVocative
        ? `${callChild(configRef.current.childName)}, ${questionBody}`
        : fallbackQuestion;
      activeQuestionRef.current = question;
      setBubbleText(question);
      setEmotion(normalizeEmotion(data?.emotion));
      updatePhase("asking");
      setStatusText("드리미가 질문하고 있어요.");
      const speechRequested = clientRef.current?.requestSpeak(
        question,
        "speak-question",
      );
      if (speechRequested) {
        setIsSpeaking(true);
        expectAudioFinish("speak-question");
      }
      return;
    }

    if (tag === "judge-json") {
      const data = parseJsonObject(text);
      const correct = data?.correct === true;
      const feedback =
        typeof data?.feedback === "string"
          ? data.feedback
          : `${callChild(configRef.current.childName)}, 대답해 줘서 고마워! 함께 이야기를 이어 읽어 보자.`;
      const nextEmotion = data?.emotion === "놀람" ? "surprise" : "happy";

      setEmotion(nextEmotion);
      setBubbleText(feedback);
      updatePhase("feedback");
      setStatusText("드리미가 대답하고 있어요.");
      setIsSpeaking(true);
      expectAudioFinish("speak-feedback");
      void saveRealtimeQuizLog({
        question: activeQuestionRef.current,
        answer: transcriptRef.current,
        correct,
        emotion: nextEmotion,
        feedback,
        source: "stories-interaction-page",
      });
      clientRef.current?.requestSpeak(feedback, "speak-feedback");
    }
  };

  const startInteraction = async () => {
    if (
      interactionStartInFlightRef.current ||
      (phaseRef.current !== "idle" && phaseRef.current !== "complete")
    ) {
      return;
    }

    interactionStartInFlightRef.current = true;
    updatePhase("connecting");
    clearTimers();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    transcriptRef.current = "";
    setTypedAnswer("");

    try {
      if (!sessionCheckedRef.current) await prepareSession();
      if (clientRef.current?.isConnected) {
        askRealtimeQuestion();
        return;
      }
      if (!realtimeAvailableRef.current || !audioRef.current) {
        startBrowserInteraction();
        return;
      }

      setEmotion("thinking");
      setBubbleText(`${callChild(configRef.current.childName)}, 드리미가 목소리를 준비하고 있어!`);
      setStatusText("마이크와 음성 서비스를 연결하고 있어요.");

      const client = new RealtimeInteractionClient({
        onAnalyser: setAnalyser,
        onConnectionChange: (connected) => {
          if (!connected && modeRef.current === "realtime") {
            setStatusText("음성 연결이 끊어졌어요. 다시 연결해 주세요.");
          }
        },
        onEvent: handleRealtimeEvent,
        onResponse: handleRealtimeResponse,
      });
      clientRef.current = client;

      try {
        await client.connect(audioRef.current, {
          childName: configRef.current.childName,
          storyTitle:
            storySnapshot?.storyTitle ||
            storedReadingSession?.storyTitle ||
            "동화",
        });
        updateMode("realtime");
        askRealtimeQuestion();
      } catch (error) {
        console.error("Realtime interaction connection failed:", error);
        client.close();
        clientRef.current = null;
        setAnalyser(null);
        setStatusText("브라우저 음성으로 이어서 시작할게요.");
        startBrowserInteraction();
      }
    } finally {
      interactionStartInFlightRef.current = false;
    }
  };

  const replayQuestion = () => {
    if (phaseRef.current !== "listening" || isSpeaking) return;

    clearTimers();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setBubbleText(activeQuestionRef.current);
    setEmotion("sad");
    updatePhase("asking");
    setStatusText("질문을 다시 들려줄게요.");

    if (modeRef.current === "realtime" && clientRef.current?.isConnected) {
      setIsSpeaking(true);
      expectAudioFinish("speak-replay");
      clientRef.current.requestSpeak(activeQuestionRef.current, "speak-replay");
    } else {
      speakWithBrowser(activeQuestionRef.current, startBrowserRecognition);
    }
  };

  const handleAnswerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitAnswer(typedAnswer);
  };

  const continueStory = () => {
    clearTimers();
    recognitionRef.current?.stop();
    clientRef.current?.close();
    window.speechSynthesis?.cancel();

    if (storedReadingSession) {
      navigate(
        `/stories/read?originalStoryId=${storedReadingSession.originalStoryId}`,
        {
          replace: true,
          state: { storyTitle: storedReadingSession.storyTitle },
        },
      );
      return;
    }

    navigate(-1);
  };

  // 이 화면은 아이가 집중을 잃었을 때 자동으로 열리므로, 버튼을 누르게 하지 않고
  // 들어오자마자 드리미가 먼저 말을 건다. (재시도 버튼은 대화가 끝난 뒤에만 보인다)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startInteraction();
    // 최초 1회만 실행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 처음 진입 시에는 시작 버튼을 숨긴다(자동으로 시작하므로).
  // 대화가 끝난 뒤에만 "한 번 더 이야기하기" 를 보여준다.
  const showStartButton = phase === "complete";
  const pageProgress = storedReadingSession
    ? getReadingPageProgress(storedReadingSession)
    : null;
  const currentStep = Math.max(
    pageProgress?.currentPage ??
      storySnapshot?.partOrderNum ??
      Number(searchParams.get("partIndex") ?? 0) + 1,
    1,
  );
  const totalSteps = Math.max(
    pageProgress?.totalPages ??
      storySnapshot?.totalParts ??
      Number(searchParams.get("totalParts") ?? 3),
    1,
  );
  const bubbleLayout = getBubbleLayout(bubbleText);

  return (
    <main className="realtime-interaction-page">
      <Logo />


      <section className="realtime-interaction-page__stage" data-phase={phase} aria-label="드리미와 동화 퀴즈">
        <div
          className={`realtime-interaction-page__bubble realtime-interaction-page__bubble--${bubbleLayout.size}`}
          style={bubbleLayout.style}
          aria-live="polite"
        >
          <h1 className="realtime-interaction-page__message">{bubbleText}</h1>
        </div>
        <button
          type="button"
          className="realtime-interaction-page__character-button"
          onClick={() => void startInteraction()}
          disabled={!showStartButton}
          aria-label={showStartButton ? "드리미와 이야기 시작" : "드리미가 상호작용 중입니다"}
        >
          <DreamyCharacter
            emotion={emotion}
            analyser={analyser}
            speaking={isSpeaking}
            className="realtime-interaction-page__character"
          />
        </button>
      </section>

      <div className="realtime-interaction-page__controls">
        <p className="realtime-interaction-page__status" role="status">
          <span
            className={`realtime-interaction-page__status-dot realtime-interaction-page__status-dot--${phase}`}
            aria-hidden="true"
          />
          {statusText}
          {mode === "browser" && phase !== "idle" && (
            <span className="realtime-interaction-page__mode">브라우저 음성</span>
          )}
        </p>

        {showStartButton && (
          <div className="realtime-interaction-page__complete-actions">
            <button
              type="button"
              className="realtime-interaction-page__start-button"
              onClick={() => void startInteraction()}
            >
              <span aria-hidden="true">●</span>
              {phase === "complete" ? "한 번 더 이야기하기" : "드리미와 이야기하기"}
            </button>
            {phase === "complete" && (
              <button
                type="button"
                className="realtime-interaction-page__continue-button"
                onClick={continueStory}
              >
                동화 계속 읽기
              </button>
            )}
          </div>
        )}

        {phase === "listening" && (
          <form
            className="realtime-interaction-page__answer-form"
            onSubmit={handleAnswerSubmit}
          >
            <label htmlFor="realtime-interaction-answer" className="sr-only">
              드리미 질문에 답하기
            </label>
            <input
              id="realtime-interaction-answer"
              value={typedAnswer}
              onChange={(event) => setTypedAnswer(event.target.value)}
              placeholder="말하거나 여기에 답을 적어 주세요"
              autoComplete="off"
            />
            <button type="submit" disabled={!typedAnswer.trim()}>
              답하기
            </button>
          </form>
        )}

        {(phase === "asking" || phase === "listening") && (
          <button
            type="button"
            className="realtime-interaction-page__replay-button"
            onClick={replayQuestion}
            disabled={phase !== "listening" || isSpeaking}
          >
            <img src={replayIcon} alt="" aria-hidden="true" />
            다시 듣기
          </button>
        )}
      </div>

      <audio ref={audioRef} className="realtime-interaction-page__audio" autoPlay />
      <div className="story-progress-footer">
        <StoryProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      </div>
    </main>
  );
}

export default RealtimeInteractionPage;
