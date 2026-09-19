// Stage 4 DTO only. Uses the same /api proxy as reading.ts; no device credentials.
export type FocusEvent = {
  eventId: string;
  eventType: "focus_lost" | "focus_recovered";
  occurredAt: string;
  durationSeconds: number;
};

type DeliveryError = Error & { permanent?: boolean };

export class FocusEventQueue {
  private pending: { historyId: number; body: FocusEvent }[] = [];
  private running: Promise<void> | null = null;
  private failed = false;
  private readonly fetchImpl: typeof fetch;
  private readonly delay: (ms: number) => Promise<void>;

  constructor(fetchImpl: typeof fetch = fetch, delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))) {
    // Native browser fetch requires the global receiver, not this queue instance.
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.delay = delay;
  }

  enqueue(historyId: number, event: FocusEvent) {
    if (this.pending.length >= 128) throw new Error("집중도 이벤트 전송 대기열이 가득 찼습니다.");
    const { eventId, eventType, occurredAt, durationSeconds } = event;
    this.pending.push({ historyId, body: { eventId, eventType, occurredAt, durationSeconds } });
    if (!this.failed) void this.flush().catch(error => console.warn("[focus-browser] pending", error));
  }

  async flush(): Promise<void> {
    if (this.running) return this.running;
    this.failed = false;
    this.running = this.drain().catch(error => { this.failed = true; throw error; });
    try { await this.running; } finally {
      this.running = null;
      if (!this.failed && this.pending.length) void this.flush().catch(error => console.warn("[focus-browser] pending", error));
    }
  }

  private async drain() {
    while (this.pending.length) {
      const item = this.pending[0];
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) await this.delay(1000 * 2 ** (attempt - 1));
        try {
          const response = await this.fetchImpl(`/api/reading-histories/${item.historyId}/focus-events`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.body), signal: AbortSignal.timeout(3000),
          });
          const result = await response.json().catch(() => null);
          const accepted = item.body.eventType === "focus_recovered"
            ? ["RECOVERED", "ALREADY_PROCESSED"] : ["SAVED", "ALREADY_PROCESSED"];
          if (!response.ok || !result?.success || !accepted.includes(result.data?.status)) {
            const error: DeliveryError = new Error(`Focus API 요청 실패 (${response.status})`);
            error.permanent = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
            throw error;
          }
          console.info(`[focus-browser] ${item.body.eventType} event=${item.body.eventId} status=${result.data.status}`);
          break;
        } catch (error) {
          if ((error as DeliveryError).permanent || attempt === 3) throw error;
        }
      }
      this.pending.shift();
    }
  }
}
