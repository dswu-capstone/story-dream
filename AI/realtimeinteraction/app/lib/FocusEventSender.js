// One bounded in-memory FIFO. Recovery cannot overtake the confirmed event.
class FocusEventSender {
  constructor({ baseUrl, fetchImpl = fetch, delay = ms => new Promise(r => setTimeout(r, ms)), log = console.log }) {
    this.baseUrl = baseUrl?.replace(/\/$/, "");
    this.fetch = fetchImpl;
    this.delay = delay;
    this.log = log;
    this.pending = [];
    this.running = null;
    this.error = null;
    this.generation = 0;
    this.controller = null;
  }

  enqueue(historyId, payload) {
    if (this.pending.length >= 128) throw new Error("Focus event queue is full");
    // Construct the Spring DTO explicitly: no state, partType or level on the wire.
    const { eventId, eventType, occurredAt, durationSeconds } = payload;
    this.pending.push({ historyId, body: { eventId, eventType, occurredAt, durationSeconds } });
    if (!this.error) void this.flush().catch(() => {});
  }

  async flush() {
    if (this.running) return this.running;
    this.error = null;
    const generation = this.generation;
    this.running = this.drain(generation).catch(error => {
      if (generation === this.generation) {
        this.error = error.message;
        this.log(`[focus-backend] pending: ${error.message}`);
      }
      throw error;
    });
    try { await this.running; } finally {
      this.running = null;
      if (generation !== this.generation && this.pending.length) void this.flush().catch(() => {});
    }
  }

  async drain(generation) {
    while (this.pending.length && generation === this.generation) {
      const item = this.pending[0];
      if (!this.baseUrl) throw new Error("BACKEND_BASE_URL is required");
      let delivered = false;
      for (let attempt = 0; attempt < 4 && generation === this.generation; attempt++) {
        if (attempt) await this.delay(1000 * 2 ** (attempt - 1));
        if (generation !== this.generation) return;
        this.controller = new AbortController();
        const timeout = setTimeout(() => this.controller?.abort(), 3000);
        try {
          this.log(`[focus-backend] send history=${item.historyId} event=${item.body.eventId} type=${item.body.eventType} attempt=${attempt + 1}`);
          const response = await this.fetch(`${this.baseUrl}/api/reading-histories/${item.historyId}/focus-events`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.body), signal: this.controller.signal
          });
          const result = await response.json();
          const accepted = item.body.eventType === "focus_recovered"
            ? ["RECOVERED", "ALREADY_PROCESSED"] : ["SAVED", "ALREADY_PROCESSED"];
          if (!response.ok || !result.success || !accepted.includes(result.data?.status)) {
            const error = new Error(`Focus API rejected request (${response.status})`);
            error.permanent = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
            throw error;
          }
          this.log(`[focus-backend] ack event=${item.body.eventId} status=${result.data.status} logId=${result.data.logId}`);
          delivered = true;
          break;
        } catch (error) {
          if (generation !== this.generation) return;
          if (error.permanent || attempt === 3) throw error;
        } finally { clearTimeout(timeout); }
      }
      if (!delivered || generation !== this.generation) return;
      this.pending.shift();
    }
  }

  cancel() {
    this.generation++;
    this.controller?.abort();
    this.pending = [];
    this.error = null;
  }
}

module.exports = { FocusEventSender };
