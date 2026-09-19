"""No webcam, YOLO, network or model downloads are needed."""
import sys
import unittest
from pathlib import Path
from datetime import datetime, timedelta, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))
from focus_episode import FocusEpisode


class EpisodeTest(unittest.TestCase):
    def setUp(self):
        self.now = 0
        self.events = []
        self.ids = iter(["A", "B", "C"])
        self.tracker = FocusEpisode(10, "UTC", self.events.append, lambda: self.now,
            wall_clock=lambda: datetime(2026, 9, 18, 10, 15, 20, tzinfo=timezone.utc),
            id_factory=lambda: next(self.ids))

    def observe(self, seconds, state):
        self.now = seconds
        self.tracker.observe(state)

    def test_five_seconds_produces_no_event(self):
        self.observe(0, "side")
        self.observe(5, "front")
        self.observe(6, "front")
        self.assertEqual(self.events, [])

    def test_ten_seconds_emits_once_and_thirty_does_not_repeat(self):
        for t in range(31):
            self.observe(t, "side")
        self.assertEqual(len(self.events), 1)
        self.assertEqual(self.events[0]["payload"]["eventId"], "A")
        self.assertEqual(self.events[0]["payload"]["durationSeconds"], 10)

    def test_two_separate_episodes_use_two_ids(self):
        for t, s in [(0, "side"), (10, "side"), (15, "front"), (16, "front"), (20, "side"), (30, "side")]:
            self.observe(t, s)
        self.assertEqual([e["payload"]["eventId"] for e in self.events], ["A", "A", "B"])

    def test_side_back_absent_are_one_continuous_interval(self):
        for t, s in [(0, "side"), (5, "back"), (10, "absent"), (20, "side"), (30, "absent")]:
            self.observe(t, s)
        self.assertEqual(len(self.events), 1)

    def test_recovery_has_same_id_full_duration_and_exact_spring_time_difference(self):
        for t, s in [(0, "side"), (10, "side"), (30, "front"), (31, "front")]:
            self.observe(t, s)
        confirmed, recovered = [e["payload"] for e in self.events]
        self.assertEqual(confirmed["eventId"], recovered["eventId"])
        self.assertEqual(recovered["durationSeconds"], 30)
        self.assertEqual(recovered["eventType"], "focus_recovered")
        start = datetime.fromisoformat(confirmed["occurredAt"]) - timedelta(seconds=confirmed["durationSeconds"])
        self.assertEqual((datetime.fromisoformat(recovered["occurredAt"]) - start).total_seconds(), 30)

    def test_single_front_observation_does_not_reset_confirmed_episode(self):
        for t, s in [(0, "side"), (10, "side"), (15, "front"), (15.1, "side"), (30, "side")]:
            self.observe(t, s)
        self.assertEqual(len(self.events), 1)

    def test_short_normal_before_threshold_does_not_confirm_during_debounce(self):
        self.observe(0, "side")
        self.observe(9.5, "front")
        self.observe(10.5, "front")
        self.assertEqual(self.events, [])

    def test_no_history_no_events(self):
        self.tracker.history_id = None
        self.observe(0, "side")
        self.observe(30, "side")
        self.assertEqual(self.events, [])

    def test_finish_records_reading_window_once_and_stops_recording(self):
        self.observe(0, "side")
        self.observe(10, "side")
        self.now = 27
        self.tracker.finish()
        self.observe(40, "side")
        self.tracker.finish()
        self.assertEqual(len(self.events), 2)
        self.assertEqual(self.events[-1]["payload"]["durationSeconds"], 27)

    def test_pause_blocks_new_confirmations_but_allows_existing_recovery(self):
        self.observe(0, "side")
        self.observe(10, "side")
        self.tracker.set_enabled(False)
        self.observe(30, "front")
        self.observe(31, "front")
        self.observe(32, "side")
        self.observe(42, "side")
        self.assertEqual(len(self.events), 2)

    def test_payload_has_no_part_or_level_and_no_local_timezone_dependency(self):
        self.observe(0, "side")
        self.observe(10, "side")
        payload = self.events[0]["payload"]
        self.assertEqual(set(payload), {"eventId", "eventType", "occurredAt", "durationSeconds"})
        self.assertEqual(payload["occurredAt"], "2026-09-18T10:15:30")

    def test_wall_clock_changes_do_not_change_elapsed_time(self):
        self.observe(0, "side")
        self.tracker.wall_clock = lambda: datetime(2000, 1, 1)
        self.observe(10, "side")
        self.observe(27, "front")
        self.observe(28, "front")
        self.assertEqual(self.events[-1]["payload"]["occurredAt"], "2026-09-18T10:15:47")


if __name__ == "__main__":
    unittest.main()
