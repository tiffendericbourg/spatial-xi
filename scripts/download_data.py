"""Prepare StatsBomb 2018 and 2022 World Cup event and corner-sequence JSON.

Run: python scripts/download_data.py
No third-party Python packages needed.
"""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
DATA_DIR = Path(__file__).resolve().parents[1] / "public" / "data"


def download_json(path):
    request = Request(f"{SOURCE}/{path}", headers={"User-Agent": "spatial-xi-portfolio"})
    with urlopen(request, timeout=45) as response:
        return json.load(response)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, separators=(",", ":"))
    os.replace(temp_path, path)


def count_bypassed(event, visible):
    """Visible opponents in the forward corridor of a completed pass."""
    start = event.get("location")
    end = event.get("pass", {}).get("end_location")
    if not start or not end or end[0] <= start[0]:
        return 0
    count = 0
    for item in visible:
        if item.get("teammate") is not False:
            continue
        point = item.get("location")
        if not point or not (start[0] < point[0] < end[0]):
            continue
        t = (point[0] - start[0]) / (end[0] - start[0])
        if abs(point[1] - (start[1] + t * (end[1] - start[1]))) <= 12:
            count += 1
    return count


def convert_event(event, freeze=None):
    event_type = event.get("type", {}).get("name")
    if event_type not in ("Pass", "Shot", "Carry", "Dribble", "Ball Receipt*", "Goal Keeper"):
        return None
    location = event.get("location")
    if not isinstance(location, list) or len(location) < 2:
        return None

    action = {
        "id": event.get("id"),
        "type": event_type,
        "minute": event.get("minute"),
        "second": event.get("second"),
        "period": event.get("period"),
        "team": event.get("team", {}).get("name"),
        "player": event.get("player", {}).get("name"),
        "is_goalkeeper": event.get("position", {}).get("id") == 1,
        "x": location[0],
        "y": location[1],
    }
    details = event.get("pass", {}) if event_type == "Pass" else event.get("shot", {}) if event_type == "Shot" else event.get("carry", {}) if event_type == "Carry" else event.get("dribble", {}) if event_type == "Dribble" else event.get("goalkeeper", {}) if event_type == "Goal Keeper" else event.get("ball_receipt", {})
    end = details.get("end_location")
    if isinstance(end, list) and len(end) >= 2:
        action["end_x"], action["end_y"] = end[:2]
    if event_type == "Pass":
        action["outcome"] = details.get("outcome", {}).get("name", "Complete")
        action["recipient"] = details.get("recipient", {}).get("name")
        if freeze is not None and action["outcome"] == "Complete":
            action["bypassed"] = count_bypassed(event, freeze)
        action["is_corner"] = details.get("type", {}).get("name") == "Corner"
        if action["is_corner"] and freeze is not None:
            keepers = [item["location"][:2] for item in freeze
                       if item.get("keeper") is True and item.get("teammate") is False
                       and isinstance(item.get("location"), list)]
            if keepers:
                action["corner_keeper_xy"] = keepers[0]
    elif event_type == "Goal Keeper":
        action["outcome"] = details.get("type", {}).get("name")
        action["body_part"] = details.get("body_part", {}).get("name")
    elif event_type == "Shot":
        action["shot_type"] = details.get("type", {}).get("name")
        action["outcome"] = details.get("outcome", {}).get("name")
        action["xg"] = details.get("statsbomb_xg")
        if freeze is not None:
            # For shot frames, the goalkeeper is an opponent of the shooter.
            keepers = [player.get("location") for player in freeze
                       if player.get("keeper") is True and player.get("teammate") is False
                       and isinstance(player.get("location"), list)]
            if keepers:
                action["keeper_xy"] = keepers[0][:2]
            defenders = [player.get("location")[:2] for player in freeze
                         if player.get("teammate") is False and player.get("keeper") is not True
                         and isinstance(player.get("location"), list)]
            action["defender_xy"] = defenders
    else:
        action["outcome"] = details.get("outcome", {}).get("name")
    return action



CORNER_SCHEMA = 1
CORNER_WINDOW_SECONDS = 18


def corner_sequences(events):
    """Find logged goalkeeper collections/punches in the corner's possession.

    Time is only a safety limit: the event must also share the possession
    or have a direct related_events link. A keeper action is NOT inferred
    from proximity alone. No linked action is not evidence of failure.
    """
    corners = []
    restarts = {"Corner", "Free Kick", "Throw-in", "Goal Kick", "Kick Off"}
    for index, corner in enumerate(events):
        if (corner.get("type", {}).get("name") != "Pass"
                or corner.get("pass", {}).get("type", {}).get("name") != "Corner"):
            continue

        team = corner.get("team", {}).get("name")
        possession = corner.get("possession")
        period = corner.get("period")
        start = corner.get("minute", 0) * 60 + corner.get("second", 0)
        corner_id = corner.get("id")
        related = set(corner.get("related_events") or [])
        interventions = []

        for action in events[index + 1:]:
            if action.get("period") != period:
                break
            elapsed = (action.get("minute", 0) * 60
                       + action.get("second", 0) - start)
            if elapsed > CORNER_WINDOW_SECONDS or elapsed < 0:
                break

            kind = action.get("type", {}).get("name")
            if kind in {"Half End", "Half Start", "Referee Ball-Drop"}:
                break
            if (kind == "Pass"
                    and action.get("pass", {}).get("type", {}).get("name") in restarts):
                break

            directly_related = (action.get("id") in related
                                or corner_id in (action.get("related_events") or []))
            same_possession = (possession is not None
                               and action.get("possession") == possession)
            if not same_possession and not directly_related:
                # The corner possession ended. Do not attach later keeper actions
                # merely because they occurred close in time.
                break

            if kind == "Goal Keeper" and action.get("team", {}).get("name") != team:
                details = action.get("goalkeeper") or {}
                action_type = details.get("type", {}).get("name")
                if action_type in {"Collected", "Punch"}:
                    point = action.get("location") or []
                    interventions.append({
                        "id": action.get("id"),
                        "type": action_type,
                        "outcome": details.get("outcome", {}).get("name"),
                        "player": action.get("player", {}).get("name"),
                        "team": action.get("team", {}).get("name"),
                        "x": point[0] if len(point) >= 2 else None,
                        "y": point[1] if len(point) >= 2 else None,
                        "elapsed_seconds": elapsed,
                        "link": "related_event" if directly_related else "same_possession",
                    })

            if kind == "Shot" and action.get("shot", {}).get("outcome", {}).get("name") == "Goal":
                break

        corners.append({
            "id": corner_id,
            "period": period,
            "minute": corner.get("minute"),
            "second": corner.get("second"),
            "team": team,
            "side": "Left" if (corner.get("location") or [0, 40])[1] < 40 else "Right",
            "interventions": interventions,
        })

    return corners


def has_current_corner_schema(path):
    try:
        with path.open(encoding="utf-8") as file:
            return json.load(file).get("schema_version") == CORNER_SCHEMA
    except (OSError, ValueError):
        return False


def has_current_schema(path):
    try:
        with path.open(encoding="utf-8") as file:
            return json.load(file).get("schema_version") == 7
    except (OSError, ValueError):
        return False


def main():
    # Both available men's World Cup seasons in StatsBomb Open Data.
    selected = []
    for season, year in ((3, 2018), (106, 2022)):
        selected += [(match, year) for match in download_json(f"matches/43/{season}.json")]
    selected.sort(key=lambda item: (item[0]["match_date"], item[0]["match_id"]), reverse=True)
    catalogue = []

    for match, year in selected:
        match_id = match["match_id"]
        output = DATA_DIR / f"{match_id}.json"
        corner_output = DATA_DIR / "corners" / f"{match_id}.json"
        try:
            needs_events = not output.exists() or not has_current_schema(output)
            needs_corners = (not corner_output.exists()
                             or not has_current_corner_schema(corner_output))
            if needs_events or needs_corners:
                events = download_json(f"events/{match_id}.json")

                if needs_events:
                    freeze_frames = {}
                    if year == 2022:
                        try:
                            frames = download_json(f"three-sixty/{match_id}.json")
                            freeze_frames = {
                                frame["event_uuid"]: frame.get("freeze_frame", [])
                                for frame in frames
                            }
                        except (OSError, ValueError):
                            print(f"No 360 for {match_id}, using estimated efficiency")

                    actions = [
                        item for event in events
                        if (item := convert_event(
                            event, freeze_frames.get(event["id"])
                        )) is not None
                    ]
                    if not actions:
                        raise ValueError("No passes or shots returned")
                    save_json(output, {
                        "schema_version": 7, "match_id": match_id, "events": actions
                    })
                    print(f"Saved match {match_id}: {len(actions)} events")

                if needs_corners:
                    corners = corner_sequences(events)
                    save_json(corner_output, {
                        "schema_version": CORNER_SCHEMA,
                        "match_id": match_id,
                        "corners": corners,
                    })
                    linked = sum(bool(c["interventions"]) for c in corners)
                    print(f"Saved corners {match_id}: {len(corners)}, "
                          f"{linked} with logged keeper actions")
            else:
                print(f"Using cached match and corners {match_id}")
        except (OSError, ValueError, KeyError) as error:
            # Preserve data already on disk when a remote source is unavailable.
            print(f"Skipped match {match_id}: {error}")
            if not output.exists():
                continue

        catalogue.append({
            "id": match_id,
            "date": match["match_date"],
            "competition": f"FIFA World Cup {year}",
            "year": year,
            "home": match["home_team"]["home_team_name"],
            "away": match["away_team"]["away_team_name"],
            "home_score": match.get("home_score"),
            "away_score": match.get("away_score"),
            "stage": match.get("competition_stage", {}).get("name", "Unknown stage"),
        })

    if not catalogue:
        raise RuntimeError("No match data available; preserving existing catalogue")
    # Never replace a larger existing catalogue after a partial download failure.
    catalogue_path = DATA_DIR / "matches.json"
    if catalogue_path.exists():
        with catalogue_path.open(encoding="utf-8") as file:
            previous = json.load(file)
        existing_ids = {match["id"] for match in catalogue}
        catalogue += [match for match in previous if match["id"] not in existing_ids]
    catalogue.sort(key=lambda match: (match["date"], match["id"]), reverse=True)
    save_json(catalogue_path, catalogue)
    print(f"Catalogue contains {len(catalogue)} matches")


if __name__ == "__main__":
    main()
