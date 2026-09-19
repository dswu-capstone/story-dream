import { FocusEventQueue, type FocusEvent } from "./focusEvents";

type Delivery = Pick<FocusEventQueue, "enqueue" | "flush">;
type SampleToken = { historyId: number; generation: number };

// Independent branch after existing browser smoothing. Never emits character signals.
export class BrowserFocusRecording {
  private historyId: number | null = null;
  private generation = 0;
  private detect = false;
  private authorized = false;
  private ending = false;
  private timezone = "";
  private started: number | null = null;
  private wallStart = 0;
  private eventId: string | null = null;
  private frontSince: number | null = null;
  private lastObserved = 0;
  private fault: unknown = null;
  private readonly delivery: Delivery;
  private readonly clock: () => number;
  private readonly wallClock: () => number;
  private readonly idFactory: () => string;

  constructor(delivery: Delivery = new FocusEventQueue(), clock = () => performance.now() / 1000,
    wallClock = () => Date.now(), idFactory = () => crypto.randomUUID()) {
    this.delivery = delivery;
    this.clock = clock;
    this.wallClock = wallClock;
    this.idFactory = idFactory;
  }

  async sync(historyId: number, detect: boolean, timezone: string | undefined) {
    if (!Number.isSafeInteger(historyId) || historyId <= 0) throw new Error("Invalid readingHistoryId");
    if (!timezone) throw new Error("Node 서버의 FOCUS_TIME_ZONE을 Backend 시간대에 맞춰 설정하세요.");
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0); // Reject unknown zones before recording.
    if (this.historyId !== null && this.historyId !== historyId) await this.stop(this.historyId);
    if (this.ending) throw new Error("종료 중인 집중도 이벤트를 먼저 전송해야 합니다.");
    this.historyId = historyId;
    this.timezone = timezone;
    this.authorized = true;
    this.setDetect(detect);
  }

  suspend() {
    this.authorized = false;
    this.generation++;
    this.observationStopped();
  }

  private setDetect(detect: boolean) {
    if (this.detect !== detect) this.generation++;
    this.detect = detect;
    if (!detect && !this.eventId) this.reset();
  }

  pause() { this.setDetect(false); }

  sampleToken(): SampleToken | null {
    return this.authorized && !this.ending && this.historyId !== null && (this.detect || this.eventId !== null)
      ? { historyId: this.historyId, generation: this.generation } : null;
  }

  observe(state: string, token: SampleToken | null, source: string | undefined) {
    // Also check the actual source on the pose response, including an in-flight mode switch.
    if (source !== "browser" || !token || !this.authorized || this.ending || this.fault
      || token.historyId !== this.historyId || token.generation !== this.generation) return;
    try {
      const now = this.clock();
      this.lastObserved = now;
      if (state === "front") {
        if (this.started !== null) {
          this.frontSince ??= now;
          if (now - this.frontSince >= 1) {
            if (this.eventId) this.send("focus_recovered", this.frontSince);
            this.reset();
          }
        }
        return;
      }
      if (!["side", "back", "absent"].includes(state)) return;
      this.frontSince = null;
      if (!this.detect && !this.eventId) return;
      if (this.started === null) {
        this.started = now;
        // Spring expects a LocalDateTime in its configured zone, not the PC's local zone.
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: this.timezone,
          year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
          minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(this.wallClock());
        const value = (key: string) => parts.find(p => p.type === key)!.value;
        this.wallStart = Date.parse(`${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}Z`);
      }
      if (this.detect && !this.eventId && now - this.started >= 10) {
        this.eventId = this.idFactory();
        this.send("focus_lost", now);
      }
    } catch (error) {
      this.fault = error;
      console.warn("[focus-browser] recording failed", error);
    }
  }

  observationStopped() {
    // An unobserved gap cannot complete a short episode or the FRONT debounce.
    this.generation++;
    this.frontSince = null;
    if (!this.eventId) this.reset();
  }

  async flush(historyId: number) {
    if (this.historyId !== historyId) throw new Error("Active recording does not match readingHistoryId");
    this.setDetect(false);
    await this.delivery.flush();
    if (this.fault) throw this.fault;
  }

  async stop(historyId: number) {
    if (this.historyId === null) return;
    if (this.historyId !== historyId) throw new Error("Active recording does not match readingHistoryId");
    this.ending = true;
    this.suspend();
    this.setDetect(false);
    if (this.eventId) {
      // No camera on other routes: do not claim an unobserved end time.
      this.send("focus_recovered", this.lastObserved);
      this.reset();
    }
    await this.delivery.flush();
    if (this.fault) throw this.fault;
    this.historyId = null;
    this.ending = false;
  }

  private send(eventType: FocusEvent["eventType"], now: number) {
    const durationSeconds = Math.max(10, Math.floor(now - this.started!));
    this.delivery.enqueue(this.historyId!, { eventId: this.eventId!, eventType, durationSeconds,
      occurredAt: new Date(this.wallStart + durationSeconds * 1000).toISOString().slice(0, 19) });
  }

  private reset() {
    this.started = this.frontSince = this.eventId = null;
  }
}

export const browserFocusRecording = new BrowserFocusRecording();
