# Builds data/space.json: upcoming rocket launches and the people in space right now, from
# The Space Devs' Launch Library 2 (https://thespacedevs.com/llapi). Run by the GitHub workflow
# every few hours, so phones don't each ask the library (which allows few requests per hour).
# Usage: python3 tools/build-space.py data/space.json
import json, sys, urllib.request
from datetime import datetime, timezone

API = "https://ll.thespacedevs.com/2.3.0"


def get(path):
    req = urllib.request.Request(API + path, headers={"User-Agent": "Overhead satellite app"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def short_name(org):
    # "China Aerospace Science and Technology Corporation" is too long for a phone; use "CASC".
    name, abbrev = org.get("name") or "", org.get("abbrev") or ""
    return abbrev if len(name) > 26 and abbrev else name


def launch(l):
    pad, mission = l.get("pad") or {}, l.get("mission") or {}
    loc = pad.get("location") or {}
    return {
        "name": l.get("name"),
        "net": l.get("net"),                    # planned launch time (UTC)
        "precision": (l.get("net_precision") or {}).get("name"),
        "status": (l.get("status") or {}).get("abbrev"),
        "provider": short_name(l.get("launch_service_provider") or {}),
        "pad": pad.get("name"),
        "place": loc.get("name"),
        "lat": float(pad["latitude"]) if pad.get("latitude") else None,
        "lon": float(pad["longitude"]) if pad.get("longitude") else None,
        "mission": mission.get("type"),
        "orbit": (mission.get("orbit") or {}).get("name"),
        "crewed": "crew" in (mission.get("type") or "").lower() or "human" in (mission.get("type") or "").lower(),
    }


def person(p):
    return {
        "name": p.get("name"),
        "agency": (p.get("agency") or {}).get("abbrev"),
        "country": ((p.get("nationality") or [{}])[0] or {}).get("name"),
        "since": p.get("last_flight"),            # launch of their current flight
    }


out = sys.argv[1] if len(sys.argv) > 1 else "data/space.json"
launches = get("/launches/upcoming/?limit=20&mode=normal")["results"]
people = get("/astronauts/?in_space=true&limit=40&mode=normal")["results"]
humans = [p for p in people if ((p.get("type") or {}).get("name") or "Human").lower() != "non-human" and p.get("name") != "Starman"]
data = {
    "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "source": "The Space Devs Launch Library 2",
    "launches": [launch(l) for l in launches],
    "crew": [person(p) for p in humans],
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
print(f"space.json: {len(data['launches'])} launches, {len(data['crew'])} people in space")
