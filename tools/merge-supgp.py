# Swaps in SpaceX's own Starlink orbits (CelesTrak's supplemental data, sup-gp.php?FILE=starlink)
# for the public ones in a CelesTrak GP list (CSV). SpaceX's come from its own tracking and are
# updated more often, which matters most for freshly launched trains whose public orbits are still
# rough. Rows are matched by catalog number; names and launch designations stay the official ones.
# Only supplemental orbits from the last 3 days are used.
# Usage: python3 tools/merge-supgp.py active.csv supgp-starlink.csv
import csv, io, sys
from datetime import datetime, timedelta, timezone

ORBIT = ["EPOCH", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION", "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY",
         "EPHEMERIS_TYPE", "ELEMENT_SET_NO", "REV_AT_EPOCH", "BSTAR", "MEAN_MOTION_DOT", "MEAN_MOTION_DDOT"]
gp_path, sup_path = sys.argv[1], sys.argv[2]
now = datetime.now(timezone.utc)


def recent(row):
    try:
        t = datetime.fromisoformat(row["EPOCH"].rstrip("Z")).replace(tzinfo=timezone.utc)
    except (KeyError, ValueError):
        return False
    return abs(now - t) < timedelta(days=3)


with open(sup_path, newline="", encoding="utf-8") as f:
    sup = {r["NORAD_CAT_ID"]: r for r in csv.DictReader(f) if r.get("NORAD_CAT_ID") and r.get("MEAN_MOTION") and recent(r)}
with open(gp_path, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    fields, rows = reader.fieldnames, list(reader)
if not fields or "NORAD_CAT_ID" not in fields:
    sys.exit("not a CelesTrak CSV list: " + gp_path)

used = starlinks = 0
for r in rows:
    if not r.get("OBJECT_NAME", "").startswith("STARLINK"):
        continue
    starlinks += 1
    s = sup.get(r.get("NORAD_CAT_ID"))
    if s and all(s.get(k, "") != "" for k in ("EPOCH", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION")):
        for k in ORBIT:
            if k in fields and s.get(k, "") != "":
                r[k] = s[k]
        used += 1

out = io.StringIO()
w = csv.DictWriter(out, fieldnames=fields, lineterminator="\n")
w.writeheader()
w.writerows(rows)
with open(gp_path, "w", newline="", encoding="utf-8") as f:
    f.write(out.getvalue())
print(f"SpaceX orbits used for {used} of {starlinks} Starlink satellites")
