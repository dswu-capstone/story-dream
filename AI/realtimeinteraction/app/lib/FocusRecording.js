// Backend recording only. This class does not publish, suppress or change interaction signals.
const { FocusEventSender } = require("./FocusEventSender");

class FocusRecording {
  constructor({ enabled, baseUrl, timezone, sender }) {
    this.enabled = enabled;
    this.timezone = timezone;
    this.sender = sender || new FocusEventSender({ baseUrl });
    this.historyId = null;
    this.detect = false;
    this.child = null;
    this.sequence = 0;
    this.acks = new Map();
    this.lease = null;
    this.fault = null;
  }

  attach(child) {
    this.child = child;
    child.stdin.on("error", error => this.fail(error));
  }

  detach(child) {
    if (this.child !== child) return;
    this.child = null;
    if (this.historyId) this.fail(new Error("Recorder interrupted; episode identity lost. Stop the session before retrying."));
  }

  fail(error) {
    this.fault = error.message;
    for (const ack of this.acks.values()) ack.reject(error);
    console.error(`[focus-recording] ${error.message}`);
  }

  handleLine(line) {
    try {
      if (line.startsWith("FOCUS_ACK ")) {
        const ack = JSON.parse(line.slice(10));
        const pending = this.acks.get(ack.requestId);
        if (ack.error) pending?.reject(new Error(ack.error)); else pending?.resolve();
        return true;
      }
      if (!line.startsWith("FOCUS_EVENT ")) return false;
      const event = JSON.parse(line.slice(12));
      if (!this.enabled || !this.historyId || event.readingHistoryId !== this.historyId) return true;
      const p = event.payload;
      if (!p?.eventId || !Number.isInteger(p.durationSeconds) || p.durationSeconds < 10
          || !["focus_lost", "absent", "focus_recovered"].includes(p.eventType)) {
        throw new Error("Invalid backend recording event");
      }
      this.sender.enqueue(this.historyId, p);
      return true;
    } catch (error) { this.fail(error); return true; }
  }

  renewLease() {
    clearTimeout(this.lease);
    this.lease = setTimeout(() => {
      console.warn("[focus-recording] session lease expired; recording disabled (interaction stays active)");
      void this.command("stop").catch(() => {}).finally(() => this.cancel());
    }, 60000);
  }

  async setSession(historyId, detect) {
    if (!this.enabled) return;
    if (!Number.isSafeInteger(historyId) || historyId <= 0) throw new Error("Invalid readingHistoryId");
    if (!this.timezone || !this.sender.baseUrl) throw new Error("BACKEND_BASE_URL and FOCUS_TIME_ZONE are required");
    if (this.historyId && this.historyId !== historyId) await this.finishSession(this.historyId);
    if (this.fault) throw new Error(this.fault);
    this.historyId = historyId;
    this.renewLease();
    await this.command("sync", detect);
    this.detect = detect;
  }

  command(action, detect = false) {
    if (!this.child) return Promise.reject(new Error("Camera process is not running"));
    const requestId = ++this.sequence;
    return new Promise((resolve, reject) => {
      const done = error => {
        clearTimeout(timeout);
        this.acks.delete(requestId);
        if (error) reject(error); else resolve();
      };
      const timeout = setTimeout(() => done(new Error("Recorder control timed out")), 15000);
      this.acks.set(requestId, { resolve: () => done(), reject: done });
      this.child.stdin.write(JSON.stringify({ requestId, action, detect,
        readingHistoryId: this.historyId, timezone: this.timezone }) + "\n", error => {
        if (error) done(error);
      });
    });
  }

  async flush(historyId) {
    if (!this.enabled) return;
    if (this.historyId !== historyId) throw new Error("Active recording does not match readingHistoryId");
    this.renewLease();
    await this.command("sync", false);
    this.detect = false;
    // Python ACK follows all prior event lines, creating a barrier before quiz/next-part.
    await this.sender.flush();
    if (this.fault) throw new Error(this.fault);
  }

  async finishSession(historyId) {
    if (!this.enabled || this.historyId === null) return;
    if (this.historyId !== historyId) throw new Error("Active recording does not match readingHistoryId");
    this.renewLease();
    if (this.child) await this.command("stop");
    await this.sender.flush();
    this.cancel();
  }

  cancel() {
    clearTimeout(this.lease);
    this.sender.cancel();
    this.historyId = null;
    this.detect = false;
    this.fault = null;
  }

  status() {
    return { enabled: this.enabled, readingHistoryId: this.historyId, detect: this.detect,
      pendingEvents: this.sender.pending.length, error: this.fault || this.sender.error };
  }
}

module.exports = { FocusRecording };
