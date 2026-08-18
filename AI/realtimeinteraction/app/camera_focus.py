"""
camera_focus.py (story-display edition)

YOLO pose focus detection for the story reading session. Watches the child
through the Pi camera / USB webcam and classifies attention into
front / side / back / absent. When side/back or absent persists for 30s,
POSTs a focus event to the story-display server, which relays it to the
browser via SSE -- the browser then pauses the narration and runs the
character quiz cycle.

This process is auto-spawned by story-display/server.js when the story
starts (disable with CAMERA_FOCUS=0), so there is nothing to launch by hand.
It always runs the ONNX model: the .pt weights are exported to .onnx once and
every later run loads the cached .onnx (much faster on the Pi's CPU).

Runs headless by default (no cv2.imshow); set SHOW_WINDOW=1 while debugging
on a desktop session.

Standalone run (same env the server uses):
    APP_SERVER_URL=http://127.0.0.1:4000 /home/pi/yolo-env/bin/python camera_focus.py

Events POSTed to {APP_SERVER_URL}/api/focus:
    focus_state      heartbeat every 5s with the smoothed state
    focus_lost       side/back persisted for FOCUS_LOST_THRESHOLD seconds
    absent           nobody detected for ABSENT_THRESHOLD seconds
    focus_recovered  front again after a focus_lost/absent was reported
"""

import json
import base64
import os
import time
import urllib.request
from collections import Counter, deque

import cv2
from ultralytics import YOLO

HERE = os.path.dirname(os.path.abspath(__file__))

# yolov8n-pose.onnx lives next to this script; if only the .pt is present,
# ensure_onnx_model() exports it once and caches the .onnx.
MODEL_PATH = os.environ.get("YOLO_POSE_MODEL", os.path.join(HERE, "yolov8n-pose.onnx"))
IMG_SIZE = 256
CONF_THRESHOLD = 0.4
KP_CONF = 0.5
CAMERA_INDEX = int(os.environ.get("CAMERA_INDEX", "0"))

INFER_EVERY_N = 3
SMOOTH_WINDOW = 8
SIDE_RATIO_THRESHOLD = 0.15
BACK_FACE_POINTS_MAX = int(os.environ.get("BACK_FACE_POINTS_MAX", "2"))

FOCUS_LOST_THRESHOLD = float(os.environ.get("FOCUS_LOST_THRESHOLD", "30"))
ABSENT_THRESHOLD = float(os.environ.get("ABSENT_THRESHOLD", "30"))
HEARTBEAT_INTERVAL = 5.0

APP_SERVER_URL = os.environ.get("APP_SERVER_URL", "http://127.0.0.1:4000")
SHOW_WINDOW = os.environ.get("SHOW_WINDOW", "0") == "1"

# 주석(키포인트/상태) 입힌 프레임을 서버로 스트리밍 → /monitor 페이지에서
# (노트북 등 다른 기기에서) YOLO 동작을 실시간 확인할 수 있다.
CAMERA_STREAM_FPS = float(os.environ.get("CAMERA_STREAM_FPS", "4"))
CAMERA_STREAM_JPEG_QUALITY = int(os.environ.get("CAMERA_STREAM_JPEG_QUALITY", "60"))
CAMERA_STREAM_MAX_WIDTH = int(os.environ.get("CAMERA_STREAM_MAX_WIDTH", "480"))

NOSE, L_EYE, R_EYE, L_EAR, R_EAR = 0, 1, 2, 3, 4


def post_focus_event(event_type, state, detail=""):
    payload = {
        "eventType": event_type,
        "state": state,
        "detail": detail,
        "source": "camera-focus",
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
        print(f"[camera-focus][ERROR] /api/focus: {exc}")


def post_camera_frame(frame, state):
    """주석 입힌 프레임을 JPEG(base64)로 서버에 올린다 (/monitor 용)."""
    height, width = frame.shape[:2]
    if width > CAMERA_STREAM_MAX_WIDTH:
        scale = CAMERA_STREAM_MAX_WIDTH / width
        frame = cv2.resize(frame, (CAMERA_STREAM_MAX_WIDTH, int(height * scale)))

    ok, buffer = cv2.imencode(
        ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), CAMERA_STREAM_JPEG_QUALITY]
    )
    if not ok:
        return
    payload = {
        "image": base64.b64encode(buffer).decode("ascii"),
        "state": state,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    try:
        request = urllib.request.Request(
            f"{APP_SERVER_URL.rstrip('/')}/api/camera-frame",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=2):
            pass
    except Exception as exc:
        print(f"[camera-focus][ERROR] /api/camera-frame: {exc}")


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

    if face_points < BACK_FACE_POINTS_MAX:
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


def ensure_onnx_model(path):
    """Export the .pt weights to .onnx once, then reuse the cached .onnx file."""
    if not path.endswith(".onnx") or os.path.exists(path):
        return path

    pt_path = path[: -len(".onnx")] + ".pt"
    print(f"[camera-focus] {path} not found, exporting from {pt_path} (one-time)...")
    exported_path = YOLO(pt_path, task="pose").export(format="onnx", imgsz=IMG_SIZE)
    if exported_path and os.path.abspath(exported_path) != os.path.abspath(path):
        os.replace(exported_path, path)
    return path


def main():
    print(f"[camera-focus] loading ONNX pose model: {MODEL_PATH}")
    model_path = ensure_onnx_model(MODEL_PATH)
    model = YOLO(model_path, task="pose")
    print("[camera-focus] model ready")

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        raise SystemExit(f"[camera-focus] failed to open camera (index={CAMERA_INDEX})")

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
    recovery_pending = False  # a focus_lost/absent was reported; announce recovery
    last_heartbeat = time.time()
    last_stream_sent = 0.0
    stream_interval = 1.0 / CAMERA_STREAM_FPS if CAMERA_STREAM_FPS > 0 else None

    print("[camera-focus] running")

    while True:
        ok, frame = cap.read()
        if not ok:
            print("[camera-focus] camera read failed, stopping")
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

        is_distracted = state in ("side", "back")
        is_absent = state == "absent"

        if is_distracted:
            if distract_since is None:
                distract_since = now
            distract_duration = now - distract_since
        else:
            distract_since = None
            distract_duration = 0
            focus_event_sent = False

        if is_absent:
            if absent_since is None:
                absent_since = now
            absent_duration = now - absent_since
        else:
            absent_since = None
            absent_duration = 0
            absent_event_sent = False

        if distract_duration >= FOCUS_LOST_THRESHOLD and not focus_event_sent:
            print(f"[camera-focus][EVENT] focus_lost ({state})")
            post_focus_event("focus_lost", state, detail=f"distracted_for={distract_duration:.1f}s")
            focus_event_sent = True
            recovery_pending = True

        if absent_duration >= ABSENT_THRESHOLD and not absent_event_sent:
            print("[camera-focus][EVENT] absent")
            post_focus_event("absent", state, detail=f"absent_for={absent_duration:.1f}s")
            absent_event_sent = True
            recovery_pending = True

        if state == "front" and recovery_pending:
            print("[camera-focus][EVENT] focus_recovered")
            post_focus_event("focus_recovered", state)
            recovery_pending = False

        if now - last_heartbeat >= HEARTBEAT_INTERVAL:
            post_focus_event("focus_state", state, detail=f"raw={raw_state}")
            last_heartbeat = now

        # 키포인트 + 상태 라벨을 프레임에 그린다 (모니터 스트림/로컬 창 공용)
        color = {
            "front": (0, 255, 0),
            "side": (0, 165, 255),
            "back": (0, 100, 255),
            "absent": (0, 0, 255),
        }.get(state, (200, 200, 200))
        if draw_keypoints is not None:
            for x, y, confidence in draw_keypoints:
                if confidence >= KP_CONF:
                    cv2.circle(frame, (int(x), int(y)), 4, (0, 255, 255), -1)
        label = state.upper()
        if is_distracted and distract_duration > 0:
            label += f"  {distract_duration:.1f}s"
        if is_absent and absent_duration > 0:
            label += f"  {absent_duration:.1f}s"
        cv2.putText(frame, label, (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 2)

        if stream_interval is not None and now - last_stream_sent >= stream_interval:
            post_camera_frame(frame, state)
            last_stream_sent = now

        if SHOW_WINDOW:
            cv2.imshow("camera_focus (q to quit)", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    if SHOW_WINDOW:
        cv2.destroyAllWindows()
    print("[camera-focus] stopped")


if __name__ == "__main__":
    main()
