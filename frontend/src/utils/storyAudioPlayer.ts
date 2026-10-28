export type PlaybackStatus = "loading" | "playing" | "paused" | "blocked" | "error";

type PlayerEvents = {
  onStatus: (status: PlaybackStatus) => void;
  onEnded: () => void;
  onStart: () => void;
  onRelease: () => void;
  onPlaying: () => void;
};

/** One media element per mounted reader. Each source has its own event generation. */
export class StoryAudioPlayer {
  private audio: HTMLAudioElement;
  private generation = 0;
  private attempt = 0;
  private wantsPlayback = false;
  private status: PlaybackStatus = "paused";
  private advanceTimer: ReturnType<typeof setTimeout> | undefined;
  private loadingTimer: ReturnType<typeof setTimeout> | undefined;
  private ended = false;
  private url = "";
  private events: PlayerEvents;

  constructor(events: PlayerEvents) {
    this.events = events;
    this.audio = new Audio();
  }

  private update(status: PlaybackStatus) {
    this.status = status;
    this.events.onStatus(status);
  }

  private clearTimers() {
    clearTimeout(this.advanceTimer);
    clearTimeout(this.loadingTimer);
  }

  stop() {
    this.generation++;
    this.attempt++;
    this.wantsPlayback = false;
    this.clearTimers();
    this.audio.onended = null;
    this.audio.onplaying = null;
    this.audio.onerror = null;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.events.onRelease();
  }

  setPage(url: string | null | undefined) {
    this.stop();
    this.url = url?.trim() ?? "";
    this.ended = false;
    if (!this.url) { this.update("error"); return; }
    const generation = this.generation;
    this.audio.src = this.url;
    this.audio.onended = () => {
      if (generation !== this.generation) return;
      this.ended = true;
      this.events.onRelease();
      // Allow a pause click at the end boundary to cancel the queued transition.
      this.advanceTimer = setTimeout(() => {
        if (generation === this.generation && this.wantsPlayback) {
          this.wantsPlayback = false;
          this.events.onEnded();
        }
      }, 80);
    };
    this.audio.onplaying = () => {
      if (generation !== this.generation || !this.wantsPlayback) return;
      clearTimeout(this.loadingTimer);
      this.update("playing");
      this.events.onPlaying();
    };
    this.audio.onerror = () => {
      if (generation === this.generation) this.fail("error");
    };
    this.play();
  }

  private fail(status: "blocked" | "error") {
    this.attempt++;
    this.wantsPlayback = false;
    this.clearTimers();
    this.audio.pause();
    this.events.onRelease();
    this.update(status);
  }

  private play() {
    const generation = this.generation;
    const attempt = ++this.attempt;
    this.wantsPlayback = true;
    this.update("loading");
    this.events.onStart();
    this.loadingTimer = setTimeout(() => {
      if (generation === this.generation && attempt === this.attempt) this.fail("error");
    }, 20_000);
    void this.audio.play().catch((error: unknown) => {
      if (generation !== this.generation || attempt !== this.attempt) return;
      this.fail(error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "error");
    });
  }

  toggle() {
    if (this.wantsPlayback) {
      this.wantsPlayback = false;
      this.attempt++;
      this.clearTimers();
      this.audio.pause();
      this.events.onRelease();
      this.update("paused");
    } else if (this.ended) {
      this.ended = false;
      this.events.onEnded();
    } else if (this.status === "error") {
      this.setPage(this.url);
    } else {
      // Do not change src/currentTime when resuming a paused or blocked element.
      this.play();
    }
  }
}
