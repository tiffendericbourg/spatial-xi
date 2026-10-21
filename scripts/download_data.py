"""Download available StatsBomb 2018 World Cup matches as compact event JSON.

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


def convert_event(event):
    event_type = event.get("type", {}).get("name")
    if event_type not in ("Pass", "Shot", "Carry", "Dribble", "Ball Receipt*"):
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
        "x": location[0],
        "y": location[1],
    }
    details = event.get("pass", {}) if event_type == "Pass" else event.get("shot", {}) if event_type == "Shot" else event.get("carry", {}) if event_type == "Carry" else event.get("dribble", {}) if event_type == "Dribble" else event.get("ball_receipt", {})
    end = details.get("end_location")
    if isinstance(end, list) and len(end) >= 2:
        action["end_x"], action["end_y"] = end[:2]
    if event_type == "Pass":
        action["outcome"] = details.get("outcome", {}).get("name", "Complete")
        action["recipient"] = details.get("recipient", {}).get("name")
    elif event_type == "Shot":
        action["outcome"] = details.get("outcome", {}).get("name")
        action["xg"] = details.get("statsbomb_xg")
    else:
        action["outcome"] = details.get("outcome", {}).get("name")
    return action


def has_current_schema(path):
    try:
        with path.open(encoding="utf-8") as file:
            return json.load(file).get("schema_version") == 2
    except (OSError, ValueError):
        return False


def main():
    # Start with a known, freely available competition: men's 2018 World Cup.
    matches = download_json("matches/43/3.json")
    selected = sorted(matches, key=lambda match: (match["match_date"], match["match_id"]), reverse=True)
    catalogue = []

    for match in selected:
        match_id = match["match_id"]
        output = DATA_DIR / f"{match_id}.json"
        try:
            # Previously downloaded matches do not need another network request.
            if not output.exists() or not has_current_schema(output):
                events = download_json(f"events/{match_id}.json")
                actions = [item for event in events if (item := convert_event(event)) is not None]
                if not actions:
                    raise ValueError("No passes or shots returned")
                save_json(output, {"schema_version": 2, "match_id": match_id, "events": actions})
                print(f"Saved match {match_id}: {len(actions)} events")
            else:
                print(f"Using cached match {match_id}")
        except (OSError, ValueError, KeyError) as error:
            # Keep any existing downloaded match if the remote source fails.
            print(f"Skipped match {match_id}: {error}")
            if not output.exists():
                continue

        catalogue.append({
            "id": match_id,
            "date": match["match_date"],
            "competition": "FIFA World Cup 2018",
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
