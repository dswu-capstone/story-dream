"""
focus_pose2.py

YOLO pose-based focus detection for the Story Dream interaction pipeline.

Pipeline role:
1. Continuously estimate child pose from the Raspberry Pi camera.
2. Convert pose into coarse attention states: front / side / back / absent.
3. When attention is lost for a threshold, notify the app server.
4. The app server pushes that signal to the web client.
5. The web client triggers a Realtime API recovery prompt from the character.

Run example:
    source ~/yolo-env/bin/activate
    APP_SERVER_URL=http://127.0.0.1:3000 DISPLAY=:0 python focus_pose2.py
"""

import json
import os
import tempfile
import threading
import time
import urllib.request
from collections import Counter, deque

import cv2
from ultralytics import YOLO

import voice_piper

MODEL_PATH = "yolov8n-pose.onnx"
IMG_SIZE = 256
CONF_THRESHOLD = 0.4
KP_CONF = 0.5
CAMERA_INDEX = 0

INFER_EVERY_N = 3
SMOOTH_WINDOW = 8
SIDE_RATIO_THRESHOLD = 0.15

FOCUS_LOST_THRESHOLD = 10.0
ABSENT_THRESHOLD = 15.0
FOCUS_LOST_MESSAGE = "OO야, 여기 주인공이 기다리고 있어. 이야기로 다시 돌아와 볼까?"
HEARTBEAT_INTERVAL = 5.0

APP_SERVER_URL = os.environ.get("APP_SERVER_URL", "http://127.0.0.1:3000")
SEND_APP_SERVER_EVENTS = os.environ.get("SEND_APP_SERVER_EVENTS", "1") != "0"
LOCAL_VOICE_ALERT = os.environ.get("LOCAL_VOICE_ALERT", "0") == "1"

NOSE, L_EYE, R_EYE, L_EAR, R_EAR = 0, 1, 2, 3, 4


def post_focus_event(event_type, state, detail="", story_paused=False):
    """Send focus signals to the app server."""
    if not SEND_APP_SERVER_EVENTS:
        return

    payload = {
        "eventType": event_type,
        "state": state,
        "detail": detail,
        "storyPaused": story_paused,
        "source": "yolo-focus-pose",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    try:
        request = urllib.request.Request(
            f"{APP_SERVER_URL.rstrip('/')}/api/focus",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=2):
            pass
    except Exception as exc:
        print(f"[app-server][ERROR] {exc}")


def classify_pose(kp):
    """Classify the face direction into front / side / back."""

    def visible(index):
        return kp[index][2] >= KP_CONF

    nose_visible = visible(NOSE)
    left_eye_visible = visible(L_EYE)
    right_eye_visible = visible(R_EYE)
    face_points = (
        int(nose_visible)
        + int(left_eye_visible)
        + int(right_eye_visible)
        + int(visible(L_EAR))
        + int(visible(R_EAR))
    )

    if face_points == 0:
        return "back"

    if nose_visible and left_eye_visible and right_eye_visible:
        left_x = kp[L_EYE][0]
        right_x = kp[R_EYE][0]
        nose_x = kp[NOSE][0]
        eye_distance = abs(left_x - right_x)
        if eye_distance < 1e-3:
            return "front"

        eye_center = (left_x + right_x) / 2.0
        offset_ratio = abs(nose_x - eye_center) / eye_distance
        if offset_ratio >= SIDE_RATIO_THRESHOLD:
            return "side"
        return "front"

    return "side"


def main():
    print("[INFO] Loading YOLO pose model...")
    model = YOLO(MODEL_PATH, task="pose")
    print("[INFO] Model ready.")

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print(f"[ERROR] Failed to open camera (index={CAMERA_INDEX})")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    frame_index = 0
    raw_state = "absent"
    draw_keypoints = None
    state_history = deque(maxlen=SMOOTH_WINDOW)

    distract_since = None
    focus_event_sent = False
    absent_since = None
    absent_event_sent = False
    show_alert = False
    last_heartbeat = time.time()
    prefetch_path = None
    prefetch_started = False

    def prefetch_voice():
        nonlocal prefetch_path
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
                prefetch_path = handle.name
            voice_piper.synth_to_file(FOCUS_LOST_MESSAGE, prefetch_path)
            print("[prefetch] Voice alert ready.")
        except Exception as exc:
            print(f"[prefetch][ERROR] {exc}")

    print("[INFO] Running. Press q to quit.")

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        now = time.time()

        if frame_index % INFER_EVERY_N == 0:
            results = model.predict(frame, imgsz=IMG_SIZE, conf=CONF_THRESHOLD, verbose=False)
            result = results[0]
            if result.keypoints is not None and len(result.keypoints) > 0 and len(result.boxes) > 0:
                keypoints = result.keypoints.data[0].cpu().numpy()
                raw_state = classify_pose(keypoints)
                draw_keypoints = keypoints
            else:
                raw_state = "absent"
                draw_keypoints = None

        frame_index += 1
        state_history.append(raw_state)
        state = Counter(state_history).most_common(1)[0][0] if len(state_history) >= 3 else raw_state

        if draw_keypoints is not None:
            for x, y, confidence in draw_keypoints:
                if confidence >= KP_CONF:
                    cv2.circle(frame, (int(x), int(y)), 4, (0, 255, 255), -1)

        is_distracted = state in ("side", "back")
        is_absent = state == "absent"

        if is_distracted:
            if distract_since is None:
                distract_since = now
                if LOCAL_VOICE_ALERT and not prefetch_started:
                    prefetch_started = True
                    prefetch_path = None
                    threading.Thread(target=prefetch_voice, daemon=True).start()
            distract_duration = now - distract_since
        else:
            distract_since = None
            distract_duration = 0
            focus_event_sent = False
            prefetch_started = False
            if prefetch_path and os.path.exists(prefetch_path):
                try:
                    os.remove(prefetch_path)
                except OSError:
                    pass
            prefetch_path = None

        if is_absent:
            if absent_since is None:
                absent_since = now
            absent_duration = now - absent_since
        else:
            absent_since = None
            absent_duration = 0
            absent_event_sent = False
            show_alert = False

        if distract_duration >= FOCUS_LOST_THRESHOLD and not focus_event_sent:
            print(f"[EVENT] focus_lost ({state})")
            post_focus_event(
                "focus_lost",
                state,
                detail=f"distracted_for={distract_duration:.1f}s",
            )

            if LOCAL_VOICE_ALERT:
                if prefetch_path and os.path.exists(prefetch_path):
                    threading.Thread(
                        target=voice_piper._play_wav,
                        args=(prefetch_path,),
                        daemon=True,
                    ).start()
                else:
                    voice_piper.speak(FOCUS_LOST_MESSAGE)

            focus_event_sent = True

        if absent_duration >= ABSENT_THRESHOLD and not absent_event_sent:
            print("[EVENT] absent")
            post_focus_event(
                "absent",
                state,
                detail=f"absent_for={absent_duration:.1f}s",
                story_paused=True,
            )
            show_alert = True
            absent_event_sent = True

        if now - last_heartbeat >= HEARTBEAT_INTERVAL:
            print(f"[heartbeat] state={state} raw={raw_state}")
            post_focus_event("focus_state", state, detail=f"raw={raw_state}")
            last_heartbeat = now

        color = {
            "front": (0, 255, 0),
            "side": (0, 165, 255),
            "back": (0, 100, 255),
            "absent": (0, 0, 255),
        }.get(state, (200, 200, 200))

        label = state.upper()
        if is_distracted and distract_duration > 0:
            label += f"  {distract_duration:.1f}s"
        if is_absent and absent_duration > 0:
            label += f"  {absent_duration:.1f}s"

        cv2.putText(frame, label, (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 2)

        if show_alert:
            height, width = frame.shape[:2]
            overlay = frame.copy()
            cv2.rectangle(overlay, (0, 0), (width, height), (0, 0, 0), -1)
            cv2.addWeighted(overlay, 0.5, frame, 0.5, 0, frame)
            cv2.putText(
                frame,
                "STORY PAUSED",
                (width // 2 - 160, height // 2 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                (0, 0, 255),
                3,
            )

        cv2.imshow("Focus Pose (q to quit)", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Stopped.")


if __name__ == "__main__":
    main()
