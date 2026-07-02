"""
voice_piper.py
Piper(오프라인 신경망 TTS)로 음성을 만들어 재생하는 모듈.

OpenAI와 달리 인터넷이 필요 없고, 파이4에서 1초 내로 생성된다.

사전 준비:
    pip install piper-tts
    # 한국어 음성 모델(.onnx + .json) 다운로드 후 아래 VOICE_MODEL 경로 지정

단독 테스트:
    python voice_piper.py

사용:
    from voice_piper import speak
    speak("○○아, 여기 봐봐!")
"""

import os
import subprocess
import tempfile
import threading
import wave

# ── 설정 ──────────────────────────────────────────────────
# 다운로드한 Piper 한국어 음성 모델 경로 (.onnx 파일)
# 예: ~/storydream/yolo/piper_voices/ko_KR-xxx.onnx
VOICE_MODEL = os.path.expanduser(
    "~/storydream/yolo/piper_voices/ko_KR-glow_tts.onnx"
)
# ──────────────────────────────────────────────────────────

_voice = None


def _get_voice():
    """Piper 음성 객체를 한 번만 로드해서 재사용."""
    global _voice
    if _voice is None:
        from piper import PiperVoice
        if not os.path.exists(VOICE_MODEL):
            raise RuntimeError(
                f"Piper 음성 모델이 없습니다: {VOICE_MODEL}\n"
                "  한국어 모델(.onnx + .json)을 받아 경로를 맞추세요."
            )
        _voice = PiperVoice.load(VOICE_MODEL)
    return _voice


def _play_wav(path):
    """wav 파일 재생. aplay 사용 (파이 기본)."""
    try:
        subprocess.run(["aplay", "-q", path], check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        print(f"[voice][ERROR] 재생 실패: {e}")
        return False


def synth_to_file(text, path):
    """text를 음성으로 합성해 wav 파일로 저장 (재생은 안 함). 미리 생성용."""
    voice = _get_voice()
    with wave.open(path, "wb") as wav_file:
        voice.synthesize(text, wav_file)
    return path


def speak(text, blocking=False):
    """text를 음성으로 만들어 재생한다."""
    def _run():
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                tmp = f.name
            synth_to_file(text, tmp)
            _play_wav(tmp)
            os.remove(tmp)
        except Exception as e:
            print(f"[voice][ERROR] 음성 생성/재생 실패: {e}")

    if blocking:
        _run()
    else:
        threading.Thread(target=_run, daemon=True).start()


if __name__ == "__main__":
    print("[voice_piper] 테스트 음성 재생...")
    speak("안녕! 여기 봐봐. 다음 이야기가 정말 궁금하지 않아?", blocking=True)
    print("[voice_piper] 끝. 소리가 안 나면 음성모델 경로와 스피커를 확인하세요.")
