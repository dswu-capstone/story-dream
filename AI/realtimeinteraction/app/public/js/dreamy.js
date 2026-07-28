/**
 * DreamyCharacter — dreamy_assets 기반 캐릭터를 캔버스에 렌더링한다.
 *
 * dreamy_video.html 의 애니메이션(둥실둥실 bob + 깜빡임 blink + 입모양 립싱크)을
 * 재사용 가능한 클래스로 옮긴 것. 원본은 미리 계산한 오디오 엔벨로프로 입을 움직였지만,
 * 여기서는 OpenAI Realtime 이 실시간으로 흘려보내는 오디오(AnalyserNode)의 음량을
 * 매 프레임 읽어 입 모양을 고른다. 배경은 투명(캔버스 clear)이라 화면의 흰 배경 위에
 * 캐릭터만 떠 있게 된다.
 *
 * 사용:
 *   const dreamy = new DreamyCharacter(canvasEl);
 *   await dreamy.ready;
 *   dreamy.attachAnalyser(analyserNode);   // realtime 원격 오디오 탭
 *   dreamy.setEmotion("happy");
 *   dreamy.start();  // 렌더 루프 시작
 *   ...
 *   dreamy.stop();
 */

const EMOTIONS = ["happy", "sad", "angry", "surprise"];
const BLINK_SEQ = [[0, 1], [0.04, 2], [0.08, 3], [0.14, 2], [0.18, 1], [0.22, 0]];
const MOUTH_SENS = 8; // 립싱크 감도 (음량 -> 입벌림). 낮출수록 덜 민감

export class DreamyCharacter {
  constructor(canvas, { assetBase = "/dreamy_assets", scale = 0.55 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.base = assetBase;
    this.scale = scale;

    this.cfg = null;
    this.img = {}; // emotion -> {body, eyesL[], eyesR[], mouths[]}
    this.emotion = "happy";

    this.analyser = null;
    this.buf = null;
    this.level = 0; // 최근 RMS 음량 (0~1) — 말 종료 감지에 사용

    this.running = false;
    this.eyeIdx = 0;
    this.mouthIdx = 0;
    this.nextBlink = 2 + Math.random() * 2;
    this.t0 = 0;

    this.frame = this.frame.bind(this);
    this.ready = this.load();
  }

  loadImg(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(im); // 누락돼도 루프가 죽지 않게
      im.src = src;
    });
  }

  async load() {
    this.cfg = await fetch(`${this.base}/config.json`).then((r) => r.json());
    for (const e of EMOTIONS) {
      const dir = `${this.base}/${e}`;
      this.img[e] = {
        body: await this.loadImg(`${dir}/body.png`),
        eyesL: await Promise.all([0, 1, 2, 3].map((i) => this.loadImg(`${dir}/eye_L_${i}.png`))),
        eyesR: await Promise.all([0, 1, 2, 3].map((i) => this.loadImg(`${dir}/eye_R_${i}.png`))),
        mouths: await Promise.all([0, 1, 2, 3].map((i) => this.loadImg(`${dir}/mouth_${i}.png`)))
      };
    }
    this.sizeCanvas();
    this.draw(0);
  }

  sizeCanvas() {
    const W = this.cfg?.canvas?.W || 941;
    const H = this.cfg?.canvas?.H || 1122;
    this.canvas.width = Math.round(W * this.scale);
    this.canvas.height = Math.round(H * this.scale);
  }

  attachAnalyser(analyser) {
    this.analyser = analyser || null;
    this.buf = analyser ? new Uint8Array(analyser.fftSize) : null;
  }

  setEmotion(name) {
    if (this.img[name]) this.emotion = name;
    else if (name === "scared") this.emotion = "surprise";
    else if (name === "thinking") this.emotion = "happy";
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.t0 = performance.now();
    this.nextBlink = 2 + Math.random() * 2;
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    this.mouthIdx = 0;
    this.level = 0;
  }

  // ---- 프레임 ----

  frame(now) {
    if (!this.running) return;
    const t = (now - this.t0) / 1000;
    this.updateBlink(t);
    this.updateMouth();
    this.draw(t);
    requestAnimationFrame(this.frame);
  }

  updateBlink(t) {
    const gap = this.cfg?.anim?.blink ?? 3.0;
    if (t >= this.nextBlink) {
      const dt = t - this.nextBlink;
      let idx = 0;
      for (const [ofs, v] of BLINK_SEQ) if (dt >= ofs) idx = v;
      this.eyeIdx = idx;
      if (dt > 0.24) {
        this.eyeIdx = 0;
        this.nextBlink = t + gap + Math.random() * 2;
      }
    } else {
      this.eyeIdx = 0;
    }
  }

  updateMouth() {
    if (!this.analyser) {
      this.mouthIdx = 0;
      this.level = 0;
      return;
    }
    this.analyser.getByteTimeDomainData(this.buf);
    let s = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = (this.buf[i] - 128) / 128;
      s += v * v;
    }
    const rms = Math.sqrt(s / this.buf.length);
    this.level = rms;
    const l = Math.min(1, rms * MOUTH_SENS);
    this.mouthIdx = l > 0.5 ? 3 : l > 0.3 ? 2 : l > 0.12 ? 1 : 0;
  }

  draw(t) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const I = this.img[this.emotion];
    if (!I) return;
    const POS = this.cfg.positions;
    const S = POS[this.emotion] || POS.happy;

    ctx.clearRect(0, 0, W, H); // 투명 배경 — 캐릭터만 남는다

    // 둥실둥실 (사인파 상하 이동 + 살짝 눌림)
    const amp = this.cfg?.anim?.bob ?? 4.5;
    const per = this.cfg?.anim?.bobT ?? 2.4;
    let dy = 0, sx = 1, sy = 1;
    if (amp > 0) {
      const k = 0.5 - 0.5 * Math.cos((t / per) * Math.PI * 2);
      dy = -(amp / 100) * H * 0.5 * k;
      sx = 1 + amp * 0.0026 * k;
      sy = 1 - amp * 0.0026 * k;
    }

    ctx.save();
    ctx.translate(W / 2, H / 2 + dy);
    ctx.scale(sx, sy);
    ctx.translate(-W / 2, -H / 2);

    ctx.drawImage(I.body, 0, 0, W, H);

    const part = (img, xp, yp, wp) => {
      if (!img || !img.width) return;
      const w = (wp / 100) * W;
      const h = w * (img.height / img.width);
      ctx.drawImage(img, (xp / 100) * W - w / 2, (yp / 100) * H - h / 2, w, h);
    };
    part(I.eyesL[this.eyeIdx], S.lx, S.ly, S.ls);
    part(I.eyesR[this.eyeIdx], S.rx, S.ry, S.rs);
    part(I.mouths[this.mouthIdx], S.mx, S.my, S.ms);

    ctx.restore();
  }
}
