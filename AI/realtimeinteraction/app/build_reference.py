"""
build_reference.py

Turn the per-prompt recordings collected by the voice-enroll web tool into a
single voice-cloning reference WAV (the same shape as dataset/reference_1min.wav):

    recordings/prompt-00.webm, prompt-01.webm, ...
        -> convert each to 44.1 kHz mono WAV (ffmpeg)
        -> trim leading/trailing silence per take
        -> concatenate with a short gap between takes
        -> ../dataset/reference_user.wav

Also writes reference_user.txt next to the WAV with the prompt transcript when
--transcript is given, since Fish Audio clones better with a reference text.

Usage (voice-enroll/server.js runs this automatically on /api/finalize):
    python3 build_reference.py --recordings recordings --out ../dataset/reference_user.wav

The last stdout line is a JSON summary: {"ok": true, "out": ..., "seconds": ...}
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

GAP_SECONDS = 0.35
MIN_TOTAL_SECONDS = 30  # Fish Audio clones best from ~30s+ of speech

AUDIO_EXTENSIONS = (".webm", ".ogg", ".wav", ".mp4", ".m4a")


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}\n{result.stderr[-800:]}")
    return result


def probe_duration(path):
    result = run([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        path,
    ])
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def convert_take(src, dst):
    """Decode to 44.1 kHz mono WAV and shave silence off both ends."""
    run([
        "ffmpeg", "-y", "-v", "error",
        "-i", src,
        "-af",
        (
            "silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.15,"
            "areverse,"
            "silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.15,"
            "areverse"
        ),
        "-ar", "44100", "-ac", "1",
        dst,
    ])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--recordings", required=True, help="directory with prompt-NN.* takes")
    parser.add_argument("--out", required=True, help="output reference wav path")
    parser.add_argument("--transcript", help="optional transcript to save next to the wav")
    args = parser.parse_args()

    takes = sorted(
        f for f in os.listdir(args.recordings)
        if f.lower().endswith(AUDIO_EXTENSIONS) and re.match(r"prompt-\d+\.", f)
    )
    if not takes:
        sys.exit("no recordings found -- run the voice-enroll web page first")

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        # 1) normalize every take
        wavs = []
        for name in takes:
            src = os.path.join(args.recordings, name)
            dst = os.path.join(tmp, os.path.splitext(name)[0] + ".wav")
            convert_take(src, dst)
            if probe_duration(dst) >= 0.4:
                wavs.append(dst)
            else:
                print(f"[build] skipping near-empty take: {name}")

        if not wavs:
            sys.exit("every take was empty after silence trimming")

        # 2) short silence gap inserted between takes
        gap = os.path.join(tmp, "gap.wav")
        run([
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
            "-t", str(GAP_SECONDS), gap,
        ])

        # 3) concatenate takes + gaps
        list_file = os.path.join(tmp, "list.txt")
        with open(list_file, "w") as f:
            for i, wav in enumerate(wavs):
                if i > 0:
                    f.write(f"file '{gap}'\n")
                f.write(f"file '{wav}'\n")
        run([
            "ffmpeg", "-y", "-v", "error",
            "-f", "concat", "-safe", "0", "-i", list_file,
            "-ar", "44100", "-ac", "1",
            out_path,
        ])

    seconds = probe_duration(out_path)
    print(f"[build] wrote {out_path} ({seconds:.1f}s from {len(takes)} takes)")
    if seconds < MIN_TOTAL_SECONDS:
        print(
            f"[build][warn] only {seconds:.0f}s of speech -- voice cloning works best "
            f"with {MIN_TOTAL_SECONDS}s+; consider re-running with longer sentences"
        )

    if args.transcript:
        txt_path = os.path.splitext(out_path)[0] + ".txt"
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(args.transcript)
        print(f"[build] wrote transcript {txt_path}")

    print(json.dumps({"ok": True, "out": out_path, "seconds": round(seconds, 1)}))


if __name__ == "__main__":
    main()
