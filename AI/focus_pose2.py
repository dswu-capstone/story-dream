"""
focus_pose2.py
pose 기반 집중도 판정 (v3)

개선점:
  1) side 각도 정밀화 - 코/눈 위치로 고개 각도(yaw) 추정
       정면이면 코가 양 눈 정중앙 → 한쪽으로 치우치면 그 비율로 각도 판단
       살짝(약 25도)만 돌려도 side로 판정
  2) Piper 음성 - 오프라인, 빠름 (인터넷 불필요)
  3) 미리 생성(prefetch) - 이탈 "시작"하면 백그라운드로 음성 미리 합성,
       10초 도달 시 즉시 재생 → 체감 지연 0

실행:
    source ~/yolo-env/bin/activate
    DISPLAY=:0 python focus_pose2.py
"""

import time
import os
import tempfile
import threading
from collections import deque, Counter

import cv2
import numpy as np
from ultralytics import YOLO

import voice_piper   # Piper 음성 모듈

# ── 설정값 ────────────────────────────────────────────────
MODEL_PATH = "yolov8n-pose.onnx"
IMG_SIZE = 256
CONF_THRESHOLD = 0.4
KP_CONF = 0.5
CAMERA_INDEX = 0

INFER_EVERY_N = 3
SMOOTH_WINDOW = 8

# side 판정 민감도: 코가 양눈 중심에서 이 비율 이상 치우치면 side
#   (눈 사이 거리 대비. 작을수록 민감 = 살짝만 돌려도 side)
#   0.15 ≈ 약 25도 정도부터 side로 잡음. 더 민감하게 하려면 0.12, 둔감하게 0.20
SIDE_RATIO_THRESHOLD = 0.15

FOCUS_LOST_THRESHOLD = 10.0
ABSENT_THRESHOLD = 15.0
FOCUS_LOST_MESSAGE = "○○아, 여기 봐봐! 다음 얘기 궁금하지 않아? 지금 주인공이 위험에 빠졌어!"
HEARTBEAT_INTERVAL = 5.0

NOSE, L_EYE, R_EYE, L_EAR, R_EAR = 0, 1, 2, 3, 4
L_SHO, R_SHO = 5, 6
# ──────────────────────────────────────────────────────────


def classify_pose(kp):
    """
    관절점(17,3)으로 방향 판정.
    side는 코-눈 위치로 고개 각도를 추정해 정밀하게.
    반환: "front" | "side" | "back"
    """
    def vis(i):
        return kp[i][2] >= KP_CONF

    nose_v = vis(NOSE)
    leye_v, reye_v = vis(L_EYE), vis(R_EYE)
    eyes = int(leye_v) + int(reye_v)
    face_pts = int(nose_v) + eyes + int(vis(L_EAR)) + int(vis(R_EAR))

    # 얼굴 관절이 거의 없음 → 등 돌림
    if face_pts == 0:
        return "back"

    # 양쪽 눈 + 코가 다 보이면 → 각도 계산으로 front/side 구분
    if nose_v and eyes == 2:
        lx = kp[L_EYE][0]
        rx = kp[R_EYE][0]
        nx = kp[NOSE][0]
        eye_center = (lx + rx) / 2.0
        eye_dist = abs(lx - rx)
        if eye_dist < 1e-3:
            return "front"
        # 코가 눈 중심에서 얼마나 치우쳤나 (비율)
        offset_ratio = abs(nx - eye_center) / eye_dist
        if offset_ratio >= SIDE_RATIO_THRESHOLD:
            return "side"   # 살짝이라도 돌아감
        return "front"

    # 코+눈이 다 안 보이고 일부만 → 이미 옆으로 많이 돌아간 상태
    return "side"


def main():
    print("[INFO] pose 모델 로딩...")
    model = YOLO(MODEL_PATH, task="pose")
    print("[INFO] 로드 완료")

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print(f"[ERROR] 웹캠 열기 실패 (index={CAMERA_INDEX})")
        return
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    frame_idx = 0
    raw_state = "absent"
    draw_kpts = None
    state_history = deque(maxlen=SMOOTH_WINDOW)

    distract_since = None
    focus_event_sent = False
    absent_since = None
    absent_event_sent = False
    show_alert = False
    last_heartbeat = time.time()

    # ── 미리 생성(prefetch) 관련 ───────────────────────────
    prefetch_path = None        # 미리 합성해둔 wav 경로
    prefetch_started = False     # 이번 이탈에서 미리 생성 시작했는지

    def prefetch_voice():
        """이탈 시작 시 백그라운드로 음성을 미리 합성해둔다."""
        nonlocal prefetch_path
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                path = f.name
            voice_piper.synth_to_file(FOCUS_LOST_MESSAGE, path)
            prefetch_path = path
            print("[prefetch] 음성 미리 생성 완료")
        except Exception as e:
            print(f"[prefetch][ERROR] {e}")

    print("[INFO] 시작. q로 종료.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        now = time.time()

        if frame_idx % INFER_EVERY_N == 0:
            results = model.predict(
                frame, imgsz=IMG_SIZE, conf=CONF_THRESHOLD, verbose=False,
            )
            r = results[0]
            if r.keypoints is not None and len(r.keypoints) > 0 and len(r.boxes) > 0:
                kpts = r.keypoints.data[0].cpu().numpy()
                raw_state = classify_pose(kpts)
                draw_kpts = kpts
            else:
                raw_state = "absent"
                draw_kpts = None
        frame_idx += 1

        state_history.append(raw_state)
        if len(state_history) >= 3:
            state = Counter(state_history).most_common(1)[0][0]
        else:
            state = raw_state

        if draw_kpts is not None:
            for (x, y, c) in draw_kpts:
                if c >= KP_CONF:
                    cv2.circle(frame, (int(x), int(y)), 4, (0, 255, 255), -1)

        is_distracted = state in ("side", "back")
        is_absent = state == "absent"

        # ── 이탈 타이머 + 미리 생성 ────────────────────────
        if is_distracted:
            if distract_since is None:
                distract_since = now
                # 이탈 시작! → 음성 미리 생성 시작 (백그라운드)
                if not prefetch_started:
                    prefetch_started = True
                    prefetch_path = None
                    threading.Thread(target=prefetch_voice, daemon=True).start()
            distract_dur = now - distract_since
        else:
            distract_since = None
            distract_dur = 0
            focus_event_sent = False
            prefetch_started = False
            # 미리 만든 파일 정리
            if prefetch_path and os.path.exists(prefetch_path):
                try:
                    os.remove(prefetch_path)
                except OSError:
                    pass
            prefetch_path = None

        if is_absent:
            if absent_since is None:
                absent_since = now
            absent_dur = now - absent_since
        else:
            absent_since = None
            absent_dur = 0
            absent_event_sent = False
            show_alert = False

        # ── 이벤트: 10초 도달 → 미리 만든 음성 즉시 재생 ───
        if distract_dur >= FOCUS_LOST_THRESHOLD and not focus_event_sent:
            print(f"\n  >>> [EVENT] focus_lost ({state}) → 음성\n")
            if prefetch_path and os.path.exists(prefetch_path):
                # 미리 생성된 거 즉시 재생 (지연 0)
                threading.Thread(
                    target=voice_piper._play_wav, args=(prefetch_path,), daemon=True
                ).start()
            else:
                # 미리 생성이 아직 안 끝났으면 그냥 지금 합성
                voice_piper.speak(FOCUS_LOST_MESSAGE)
            focus_event_sent = True

        if absent_dur >= ABSENT_THRESHOLD and not absent_event_sent:
            print(f"\n  >>> [EVENT] absent → 동화 정지 ALERT\n")
            show_alert = True
            absent_event_sent = True

        if now - last_heartbeat >= HEARTBEAT_INTERVAL:
            print(f"[heartbeat] state={state} (raw={raw_state})")
            last_heartbeat = now

        # ── 화면 ───────────────────────────────────────────
        color = {
            "front": (0, 255, 0), "side": (0, 165, 255),
            "back": (0, 100, 255), "absent": (0, 0, 255),
        }.get(state, (200, 200, 200))
        label = state.upper()
        if is_distracted and distract_dur > 0:
            label += f"  {distract_dur:.1f}s"
        if is_absent and absent_dur > 0:
            label += f"  {absent_dur:.1f}s"
        cv2.putText(frame, label, (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 2)

        if show_alert:
            h, w = frame.shape[:2]
            overlay = frame.copy()
            cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
            cv2.addWeighted(overlay, 0.5, frame, 0.5, 0, frame)
            cv2.putText(frame, "STORY PAUSED", (w // 2 - 160, h // 2 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)

        cv2.imshow("Focus Pose v3 (q to quit)", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] 종료.")


if __name__ == "__main__":
    main()
