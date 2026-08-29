import { useEffect, useRef, useState } from "react";

import "./dreamyCharacter.css";

const dreamyEmotions = ["happy", "sad", "angry", "surprise", "thinking"] as const;

export type DreamyEmotion = (typeof dreamyEmotions)[number];

type FacePosition = {
  mx: number;
  my: number;
  ms: number;
  lx: number;
  ly: number;
  ls: number;
  rx: number;
  ry: number;
  rs: number;
};

type DreamyConfig = {
  canvas: { W: number; H: number };
  anim: { bob: number; bobT: number; blink: number };
  positions: Record<DreamyEmotion, FacePosition>;
};

type CharacterImages = {
  body: HTMLImageElement;
  eyesL: HTMLImageElement[];
  eyesR: HTMLImageElement[];
  mouths: HTMLImageElement[];
};

type DreamyCharacterProps = {
  emotion?: DreamyEmotion;
  active?: boolean;
  analyser?: AnalyserNode | null;
  speaking?: boolean;
  assetBase?: string;
  className?: string;
};

const blinkSequence = [
  [0, 1],
  [0.04, 2],
  [0.08, 3],
  [0.14, 2],
  [0.18, 1],
  [0.22, 0],
] as const;

const emotionLabels: Record<DreamyEmotion, string> = {
  happy: "기뻐하는",
  sad: "슬퍼하는",
  angry: "화난",
  surprise: "놀란",
  thinking: "생각하는",
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${src}`));
    image.src = src;
  });
}

async function loadEmotionImages(assetBase: string, emotion: DreamyEmotion) {
  const directory = `${assetBase}/${emotion}`;
  const frames = [0, 1, 2, 3];
  const [body, eyesL, eyesR, mouths] = await Promise.all([
    loadImage(`${directory}/body.png`),
    Promise.all(frames.map((frame) => loadImage(`${directory}/eye_L_${frame}.png`))),
    Promise.all(frames.map((frame) => loadImage(`${directory}/eye_R_${frame}.png`))),
    Promise.all(frames.map((frame) => loadImage(`${directory}/mouth_${frame}.png`))),
  ]);

  return { body, eyesL, eyesR, mouths } satisfies CharacterImages;
}

function DreamyCharacter({
  emotion = "sad",
  active = true,
  analyser = null,
  speaking = false,
  assetBase = "/interaction-assets",
  className = "",
}: DreamyCharacterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const configRef = useRef<DreamyConfig | null>(null);
  const imagesRef = useRef<Partial<Record<DreamyEmotion, CharacterImages>>>({});
  const emotionRef = useRef(emotion);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    emotionRef.current = emotion;
  }, [emotion]);

  useEffect(() => {
    let cancelled = false;

    const loadAssets = async () => {
      setIsReady(false);
      setHasError(false);
      try {
        const response = await fetch(`${assetBase}/config.json`);
        if (!response.ok) {
          throw new Error("캐릭터 설정을 불러오지 못했습니다.");
        }
        const config = (await response.json()) as DreamyConfig;
        const entries = await Promise.all(
          dreamyEmotions.map(async (currentEmotion) => {
            const images = await loadEmotionImages(assetBase, currentEmotion);
            return [currentEmotion, images] as const;
          }),
        );

        if (!cancelled) {
          configRef.current = config;
          imagesRef.current = Object.fromEntries(entries);
          setIsReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("드리미 캐릭터 로딩 오류:", error);
          setHasError(true);
        }
      }
    };

    void loadAssets();
    return () => {
      cancelled = true;
    };
  }, [assetBase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const config = configRef.current;
    if (!canvas || !config || !isReady) {
      return;
    }

    canvas.width = config.canvas.W;
    canvas.height = config.canvas.H;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();
    const audioSamples = analyser ? new Uint8Array(analyser.fftSize) : null;
    let frameId = 0;
    let nextBlinkAt = 1.5 + Math.random() * 1.5;

    const drawPart = (
      image: HTMLImageElement,
      xPercent: number,
      yPercent: number,
      widthPercent: number,
    ) => {
      const width = (widthPercent / 100) * canvas.width;
      const height = width * (image.height / image.width);
      context.drawImage(
        image,
        (xPercent / 100) * canvas.width - width / 2,
        (yPercent / 100) * canvas.height - height / 2,
        width,
        height,
      );
    };

    const render = (now: number) => {
      const seconds = (now - startedAt) / 1000;
      const currentEmotion = emotionRef.current;
      const images = imagesRef.current[currentEmotion];
      const position = config.positions[currentEmotion];
      if (!images || !position) {
        return;
      }

      let eyeIndex = 0;
      if (!reducedMotion && seconds >= nextBlinkAt) {
        const elapsed = seconds - nextBlinkAt;
        for (const [offset, frame] of blinkSequence) {
          if (elapsed >= offset) eyeIndex = frame;
        }
        if (elapsed > 0.24) {
          eyeIndex = 0;
          nextBlinkAt = seconds + config.anim.blink + Math.random() * 2;
        }
      }

      let mouthIndex = 0;
      if (analyser && audioSamples) {
        analyser.getByteTimeDomainData(audioSamples);
        let energy = 0;
        for (const sample of audioSamples) {
          const normalized = (sample - 128) / 128;
          energy += normalized * normalized;
        }
        const level = Math.min(1, Math.sqrt(energy / audioSamples.length) * 8);
        mouthIndex = level > 0.5 ? 3 : level > 0.3 ? 2 : level > 0.12 ? 1 : 0;
      } else if (speaking && !reducedMotion) {
        mouthIndex = 1 + (Math.floor(seconds * 9) % 3);
      }

      const bobProgress = reducedMotion
        ? 0
        : 0.5 - 0.5 * Math.cos((seconds / config.anim.bobT) * Math.PI * 2);
      const offsetY = -(config.anim.bob / 100) * canvas.height * 0.5 * bobProgress;
      const scaleX = 1 + config.anim.bob * 0.0026 * bobProgress;
      const scaleY = 1 - config.anim.bob * 0.0026 * bobProgress;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2 + offsetY);
      context.scale(scaleX, scaleY);
      context.translate(-canvas.width / 2, -canvas.height / 2);
      context.drawImage(images.body, 0, 0, canvas.width, canvas.height);
      drawPart(images.eyesL[eyeIndex], position.lx, position.ly, position.ls);
      drawPart(images.eyesR[eyeIndex], position.rx, position.ry, position.rs);
      drawPart(images.mouths[mouthIndex], position.mx, position.my, position.ms);
      context.restore();

      if (active) {
        frameId = window.requestAnimationFrame(render);
      }
    };

    render(performance.now());
    return () => window.cancelAnimationFrame(frameId);
  }, [active, analyser, isReady, speaking]);

  return (
    <div
      className={`dreamy-character ${className}`.trim()}
      role="img"
      aria-label={`${emotionLabels[emotion]} 드리미 캐릭터`}
      aria-busy={!isReady && !hasError}
    >
      <canvas ref={canvasRef} className="dreamy-character__canvas" />
      {!isReady && !hasError && (
        <span className="dreamy-character__status">캐릭터 준비 중...</span>
      )}
      {hasError && (
        <span className="dreamy-character__status">캐릭터를 불러오지 못했어요.</span>
      )}
    </div>
  );
}

export default DreamyCharacter;
