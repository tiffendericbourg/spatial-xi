"""Regression tests for corner-to-goalkeeper sequence linking."""
import unittest

from scripts.download_data import corner_sequences


def action(kind, number, seconds, possession, team="A", period=1, **fields):
    event = {
        "id": str(number),
        "index": number,
        "minute": 8,
        "second": seconds,
        "period": period,
        "possession": possession,
        "type": {"name": kind},
        "team": {"name": team},
        "player": {"name": "Test goalkeeper" if team == "B" else "Corner taker"},
        "location": [3, 40] if team == "B" else [120, 0],
    }
    event.update(fields)
    return event


def corner(possession=10, seconds=5, **fields):
    return action("Pass", 1, seconds, possession,
                  pass_ignored=None, **fields) | {"pass": {"type": {"name": "Corner"}}}


def keeper(index, seconds, possession, kind="Collected", outcome="Claim", **fields):
    return action("Goal Keeper", index, seconds, possession, team="B",
                  goalkeeper={"type": {"name": kind}, "outcome": {"name": outcome}},
                  **fields)


class CornerSequenceTests(unittest.TestCase):
    def test_collection_same_possession(self):
        result = corner_sequences([corner(), keeper(2, 8, 10)])
        linked = result[0]["interventions"]
        self.assertEqual(len(linked), 1)
        self.assertEqual(linked[0]["type"], "Collected")
        self.assertEqual(linked[0]["outcome"], "Claim")
        self.assertEqual(linked[0]["link"], "same_possession")
        self.assertEqual(linked[0]["elapsed_seconds"], 3)

    def test_punch_is_not_mistaken_for_collection(self):
        result = corner_sequences([corner(), keeper(2, 8, 10, kind="Punch", outcome="Punched Out")])
        self.assertEqual(result[0]["interventions"][0]["type"], "Punch")

    def test_a_keeper_save_is_not_an_aerial_collection(self):
        result = corner_sequences([corner(), keeper(2, 8, 10, kind="Shot Saved")])
        self.assertEqual(result[0]["interventions"], [])

    def test_unrelated_possession_not_matched_even_if_just_one_second(self):
        result = corner_sequences([corner(), keeper(2, 6, 11)])
        self.assertEqual(result[0]["interventions"], [])

    def test_early_turnover_blocks_later_action(self):
        turnover = action("Ball Recovery", 2, 6, 11, team="B")
        result = corner_sequences([corner(), turnover, keeper(3, 8, 10)])
        self.assertEqual(result[0]["interventions"], [])

    def test_new_restart_blocks_action(self):
        restart = action("Pass", 2, 7, 10, team="B", **{"pass": {"type": {"name": "Free Kick"}}})
        result = corner_sequences([corner(), restart, keeper(3, 9, 10)])
        self.assertEqual(result[0]["interventions"], [])

    def test_time_limit_still_applies(self):
        result = corner_sequences([corner(), keeper(2, 24, 10)])
        self.assertEqual(result[0]["interventions"], [])

    def test_explicit_related_event_link_can_cross_possession(self):
        related = keeper(2, 7, 11, related_events=["1"])
        result = corner_sequences([corner(), related])
        self.assertEqual(result[0]["interventions"][0]["link"], "related_event")

    def test_other_period_does_not_match(self):
        result = corner_sequences([corner(), keeper(2, 8, 10, period=2)])
        self.assertEqual(result[0]["interventions"], [])


if __name__ == "__main__":
    unittest.main()
