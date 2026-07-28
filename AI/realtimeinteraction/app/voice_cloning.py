"""
voice_cloning.py (app edition)

Fish Audio 보이스 클로닝 TTS로 동화 나레이션을 페이지별 WAV로 생성한다.
NarrationService(server.js)가 책을 클릭했을 때 백그라운드로 실행하며,
진행률을 stdout의 "PROGRESS {json}" 라인으로 보고한다:

    PROGRESS {"level": 1, "index": 3, "done": 4, "total": 273, "status": "ok"}

단독 실행도 가능:
    export FISH_AUDIO_API_KEY=...
    python voice_cloning.py --dataset ../dataset/gongu_0059_....jsonl \
                            --out-root public/assets/audio/gongu-0059
    python voice_cloning.py --test        # 짧은 한 줄만 합성해 목소리 확인

레퍼런스: REFERENCE_AUDIO env (기본 ../dataset/reference_1min.wav).
같은 이름의 .txt가 있으면 전사로 함께 전송해 품질을 높인다.
FISH_REFERENCE_ID 를 주면 fish.audio에 만들어 둔 보이스 모델을 대신 쓴다.

출력: <out-root>/level{N}/page-{IDX}.wav  (이미 있는 파일은 건너뜀 → 재개 안전)
"""

import argparse
import json
import os
import sys
import time

import requests

try:
    import ormsgpack
except ImportError:
    ormsgpack = None

HERE = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.abspath(os.path.join(HERE, "..", "dataset"))

DEFAULT_DATASET = os.path.join(DATASET_DIR, "gongu_0059_미운 아기 오리.jsonl")
SENTENCES_PER_PAGE = int(os.environ.get("SENTENCES_PER_PAGE", "4"))

FISH_AUDIO_API_KEY = os.environ.get("FISH_AUDIO_API_KEY", "")
FISH_AUDIO_BASE_URL = os.environ.get("FISH_AUDIO_BASE_URL", "https://api.fish.audio")
FISH_AUDIO_MODEL = os.environ.get("FISH_AUDIO_MODEL", "s1")
FISH_REFERENCE_ID = os.environ.get("FISH_REFERENCE_ID", "")

REFERENCE_AUDIO = os.environ.get(
    "REFERENCE_AUDIO", os.path.join(DATASET_DIR, "reference_1min.wav")
)
REFERENCE_TEXT = os.environ.get("REFERENCE_TEXT", "")

LEVELS = (1, 2, 3)


class FishAudioError(RuntimeError):
    pass


def load_reference():
    """(audio_bytes, transcript) — in-context 클로닝용 레퍼런스."""
    if FISH_REFERENCE_ID:
        return None, None

    if not os.path.exists(REFERENCE_AUDIO):
        raise FishAudioError(f"reference audio not found: {REFERENCE_AUDIO}")

    with open(REFERENCE_AUDIO, "rb") as f:
        audio_bytes = f.read()

    text = REFERENCE_TEXT
    if not text:
        txt_path = os.path.splitext(REFERENCE_AUDIO)[0] + ".txt"
        if os.path.exists(txt_path):
            with open(txt_path, encoding="utf-8") as f:
                text = f.read().strip()

    return audio_bytes, text


def fish_synthesize(text, out_path, reference):
    if not FISH_AUDIO_API_KEY:
        raise FishAudioError("FISH_AUDIO_API_KEY is not set")
    if ormsgpack is None:
        raise FishAudioError("ormsgpack is required: pip install ormsgpack")

    payload = {
        "text": text,
        "format": "wav",
        "normalize": True,
        "latency": "normal",
        "chunk_length": 200,
        "references": [],
    }
    if FISH_REFERENCE_ID:
        payload["reference_id"] = FISH_REFERENCE_ID
    else:
        audio_bytes, ref_text = reference
        payload["references"] = [{"audio": audio_bytes, "text": ref_text or ""}]

    response = requests.post(
        f"{FISH_AUDIO_BASE_URL.rstrip('/')}/v1/tts",
        data=ormsgpack.packb(payload),
        headers={
            "Authorization": f"Bearer {FISH_AUDIO_API_KEY}",
            "Content-Type": "application/msgpack",
            "model": FISH_AUDIO_MODEL,
        },
        timeout=120,
    )
    if response.status_code != 200:
        raise FishAudioError(
            f"POST /v1/tts -> HTTP {response.status_code}: {response.text[:500]}"
        )

    # 임시 파일에 쓰고 rename: 생성 중에 서버가 '준비된 페이지'로 오인하지 않게
    tmp_path = out_path + ".part"
    with open(tmp_path, "wb") as f:
        f.write(response.content)
    os.replace(tmp_path, out_path)


def load_pages(dataset):
    """level -> [page text] (server.js Story.pages와 동일한 묶음 규칙)."""
    by_level = {level: [] for level in LEVELS}
    with open(dataset, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            level = int(row.get("level", 0))
            if level not in by_level:
                continue
            text = str(row.get("output", "")).replace("\\n", "\n").strip()
            if text:
                by_level[level].append((int(row.get("unit_id", 0)), text))

    pages_by_level = {}
    for level, items in by_level.items():
        items.sort(key=lambda it: it[0])
        texts = [t for _, t in items]
        pages_by_level[level] = [
            "\n".join(texts[i:i + SENTENCES_PER_PAGE])
            for i in range(0, len(texts), SENTENCES_PER_PAGE)
        ]
    return pages_by_level


def report_progress(level, index, done, total, status):
    print(
        "PROGRESS " + json.dumps(
            {"level": level, "index": index, "done": done, "total": total, "status": status}
        ),
        flush=True,
    )


def main():
    parser = argparse.ArgumentParser(description="Fish Audio voice-cloning narration")
    parser.add_argument("--dataset", default=DEFAULT_DATASET, help="story jsonl path")
    parser.add_argument("--out-root", default=os.path.join(HERE, "narration-out"),
                        help="output root (level{N}/page-XXX.wav below it)")
    parser.add_argument("--levels", default="1,2,3", help="comma-separated levels to generate")
    parser.add_argument("--overwrite", action="store_true", help="regenerate existing files")
    parser.add_argument("--test", action="store_true", help="synthesize one short line and exit")
    args = parser.parse_args()

    if not FISH_AUDIO_API_KEY:
        sys.exit("FISH_AUDIO_API_KEY environment variable is required")

    try:
        reference = load_reference()
    except FishAudioError as exc:
        sys.exit(str(exc))

    if FISH_REFERENCE_ID:
        print(f"[voice] using fish.audio voice model: {FISH_REFERENCE_ID}", flush=True)
    else:
        print(f"[voice] in-context cloning from {REFERENCE_AUDIO}", flush=True)
        if not reference[1]:
            print("[voice][hint] no reference transcript (.txt) found", flush=True)

    if args.test:
        out = os.path.join(HERE, "narration_test.wav")
        fish_synthesize("안녕! 나는 아기 오리야. 오늘은 재미있는 이야기를 들려줄게.", out, reference)
        print(f"[test] wrote {out}", flush=True)
        return

    levels = [int(l) for l in args.levels.split(",") if int(l) in LEVELS]
    pages_by_level = load_pages(args.dataset)
    total = sum(len(pages_by_level[l]) for l in levels)

    done = failed = 0
    consecutive_failures = 0
    MAX_CONSECUTIVE_FAILURES = 3  # 키 오류/네트워크 단절이면 즉시 멈춘다
    for level in levels:
        pages = pages_by_level.get(level, [])
        out_dir = os.path.join(args.out_root, f"level{level}")
        os.makedirs(out_dir, exist_ok=True)
        for index, text in enumerate(pages):
            out_path = os.path.join(out_dir, f"page-{index:03d}.wav")
            if os.path.exists(out_path) and not args.overwrite:
                done += 1
                report_progress(level, index, done, total, "skip")
                continue
            started = time.time()
            try:
                fish_synthesize(text, out_path, reference)
                done += 1
                consecutive_failures = 0
                report_progress(level, index, done, total, "ok")
                print(f"[voice] level{level} page {index:03d} ok "
                      f"({len(text)} chars, {time.time()-started:.1f}s)", flush=True)
            except FishAudioError as exc:
                failed += 1
                consecutive_failures += 1
                report_progress(level, index, done, total, "fail")
                print(f"[voice] level{level} page {index:03d} FAILED: {exc}", flush=True)
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    print(f"[voice] aborting: {consecutive_failures} consecutive failures", flush=True)
                    sys.exit(1)

    print(f"[voice] finished. done={done} failed={failed} total={total}", flush=True)
    sys.exit(1 if failed and done == 0 else 0)


if __name__ == "__main__":
    main()
