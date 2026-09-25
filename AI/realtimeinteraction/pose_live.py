import base64, json, subprocess, sys, time, os

DEV = os.environ.get("CAM_DEV", "/dev/video0")
SHOT = "/tmp/sd-camera-smoke/live.jpg"
py = sys.executable

print("모델 로딩 중… (20~60초)", flush=True)
w = subprocess.Popen([py, "app/pose_worker.py"], stdin=subprocess.PIPE,
                     stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)

KO = {"front": "정면 (집중)", "side": "옆모습 (딴짓)",
      "back": "뒤돌아봄 (딴짓)", "absent": "사람 없음"}
n = 0
try:
    while True:
        n += 1
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error",
                        "-f", "v4l2", "-video_size", "640x480", "-i", DEV,
                        "-frames:v", "1", "-y", SHOT],
                       stdin=subprocess.DEVNULL, check=False)
        try:
            img = base64.b64encode(open(SHOT, "rb").read()).decode()
        except OSError:
            print("  캡처 실패"); time.sleep(1); continue
        w.stdin.write(json.dumps({"id": n, "image": img}) + "\n")
        w.stdin.flush()
        # worker 가 JSON 앞에 배너를 찍기도 해서, 파싱되는 줄이 나올 때까지 읽는다.
        st = None
        while st is None:
            line = w.stdout.readline()
            if not line:
                break
            try:
                st = json.loads(line).get("state", "?")
            except json.JSONDecodeError:
                continue
        if st is None:
            print("worker 종료됨"); break
        print(f"[{time.strftime('%H:%M:%S')}] {st:7s} {KO.get(st, '')}", flush=True)
        time.sleep(1.0)
except KeyboardInterrupt:
    print("\n종료합니다.")
finally:
    w.terminate()
