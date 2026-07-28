"""
pose_worker.py — 브라우저 웹캠 프레임을 한 장씩 받아 자세를 분류하는 상주 워커.

camera_focus.py 는 카메라를 직접 열어(cv2.VideoCapture) 프레임을 읽지만, 원격/헤드리스
서버에는 카메라가 없다. 대신 브라우저(사용자 PC 웹캠)가 프레임을 서버로 보내고,
Node 서버(PoseWorker.js)가 이 프로세스를 한 번만 띄워 표준입출력으로 통신한다.

프로토콜(줄 단위 JSON):
    입력 (stdin) : {"id": <n>, "image": "<base64 jpeg>"}
    출력 (stdout): {"id": <n>, "state": "front|side|back|absent"}

모델은 시작 시 1회만 로드한다(프레임마다 재로드하면 너무 느림). 분류 로직은
camera_focus.py 의 classify_pose 와 동일하게 유지한다. 10초 임계/이벤트 판정 같은
시간 상태머신은 브라우저 쪽(browser_focus.js)에서 처리한다.
"""

import base64
import json
import os
import sys

import numpy as np
import cv2
from ultralytics import YOLO

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.environ.get("YOLO_POSE_MODEL", os.path.join(HERE, "yolov8n-pose.onnx"))
IMG_SIZE = 256
CONF_THRESHOLD = 0.4
KP_CONF = 0.5
SIDE_RATIO_THRESHOLD = 0.15
BACK_FACE_POINTS_MAX = int(os.environ.get("BACK_FACE_POINTS_MAX", "2"))

NOSE, L_EYE, R_EYE, L_EAR, R_EAR = 0, 1, 2, 3, 4


def classify_pose(kp):
    """얼굴 방향을 front / side / back 으로 분류 (camera_focus.py 와 동일)."""

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


def decode_frame(b64):
    raw = base64.b64decode(b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def main():
    print(f"[pose-worker] loading ONNX pose model: {MODEL_PATH}", file=sys.stderr, flush=True)
    model = YOLO(MODEL_PATH, task="pose")
    print("[pose-worker] model ready", file=sys.stderr, flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            req_id = msg.get("id")
            frame = decode_frame(msg["image"])
            if frame is None:
                raise ValueError("could not decode frame")

            results = model.predict(frame, imgsz=IMG_SIZE, conf=CONF_THRESHOLD, verbose=False)
            result = results[0]
            if result.keypoints is not None and len(result.keypoints) > 0 and len(result.boxes) > 0:
                keypoints = result.keypoints.data[0].cpu().numpy()
                state = classify_pose(keypoints)
            else:
                state = "absent"

            sys.stdout.write(json.dumps({"id": req_id, "state": state}) + "\n")
            sys.stdout.flush()
        except Exception as exc:  # noqa: BLE001
            try:
                rid = json.loads(line).get("id")
            except Exception:
                rid = None
            sys.stdout.write(json.dumps({"id": rid, "state": "absent", "error": str(exc)}) + "\n")
            sys.stdout.flush()
            print(f"[pose-worker][ERROR] {exc}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
