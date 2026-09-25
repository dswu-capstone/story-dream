"""Hardware-independent episode tracker; a single ID survives state changes/retries."""
import uuid
from datetime import datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo


class FocusEpisode:
    THRESHOLD = 10
    RECOVERY_SECONDS = 1.0

    def __init__(self, history_id, timezone, emit, clock, wall_clock=None, id_factory=None):
        self.history_id = history_id
        self.emit = emit
        self.clock = clock
        zone = dt_timezone.utc if timezone == "UTC" else ZoneInfo(timezone)
        self.wall_clock = wall_clock or (lambda: datetime.now(zone))
        self.id_factory = id_factory or (lambda: str(uuid.uuid4()))
        self.enabled = True
        self.closed = False
        self.started = None
        self.wall_start = None
        self.event_id = None
        self.front_since = None

    def set_enabled(self, enabled):
        self.enabled = enabled
        if not enabled and self.event_id is None:
            self._reset()

    def observe(self, state):
        if self.closed or not self.history_id:
            return
        now = self.clock()
        if state == "front":
            if self.started is not None:
                if self.front_since is None:
                    self.front_since = now
                if now - self.front_since >= self.RECOVERY_SECONDS:
                    if self.event_id:
                        self._send("focus_recovered", self.front_since, "front")
                    self._reset()
            return
        if state not in ("side", "back", "absent"):
            return
        self.front_since = None
        if not self.enabled and self.event_id is None:
            return
        if self.started is None:
            self.started = now
            # Spring LocalDateTime has no offset. Use explicitly configured server timezone.
            self.wall_start = self.wall_clock().replace(tzinfo=None, microsecond=0)
        if self.enabled and self.event_id is None and now - self.started >= self.THRESHOLD:
            self.event_id = self.id_factory()
            self._send("absent" if state == "absent" else "focus_lost", now, state)

    def finish(self):
        if self.event_id:
            self._send("focus_recovered", self.front_since or self.clock(), "front")
        self._reset()
        self.closed = True

    def _send(self, kind, now, state):
        seconds = max(10, int(now - self.started))
        # Both messages share one whole-second origin, matching Backend recovery validation.
        occurred = self.wall_start + timedelta(seconds=seconds)
        self.emit({
            "readingHistoryId": self.history_id,
            "state": state,
            "payload": {"eventId": self.event_id, "eventType": kind,
                        "occurredAt": occurred.isoformat(timespec="seconds"),
                        "durationSeconds": seconds},
        })

    def _reset(self):
        self.started = self.wall_start = self.event_id = self.front_since = None
