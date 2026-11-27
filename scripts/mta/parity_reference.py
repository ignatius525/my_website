"""Reference output from the original fun-mta Python, for parity_check.mjs.

Replays recorded feeds (each snapshot dir in order) through Store exactly as
poll_once would, and dumps the /api payloads after each step. Uses the same
network export_network.py writes, so run that first if the GTFS changed.

    python scripts/mta/parity_reference.py ref.json <snapshot dirs...>
"""
import json, sys, time
from pathlib import Path
from unittest import mock

from mta_map import api, config, network
from mta_map.feeds import parse_feed
from mta_map.model import FeedResult
from mta_map.store import Store
from mta_map.tracker import Tracker

# Mirrors RESUME_GAP in src/subway/engine/config.js: the browser pauses while
# the map is off screen and starts its cross-poll memory afresh after a longer
# gap. The Python server never pauses, so this is the one deliberate
# difference; mirroring it lets snapshots from separate captures share a run.
RESUME_GAP = 150

snap_dirs = [Path(p) for p in sys.argv[2:]]
out_path = Path(sys.argv[1])

# Segments in the exporter's canonical order (see export_network.py).
data = network.load().to_json()
data["segments"].sort(key=lambda s: (s[0], s[1]))
net = network.Network.from_json(data)
store = Store(net)

def lines(display):
    return [{"route_id": p.route_id, "via": [list(v) for v in p.via], "offsets": p.offsets} for p in display.paths]

steps = []
scheduled = lines(store.display)
last = None
for d in snap_dirs:
    wall = json.loads((d / "captured_at.json").read_text())["wall"]
    if last is not None and wall - last > RESUME_GAP:
        store.tracker = Tracker()
        store._by_feed.clear()
    last = wall
    results = []
    for fid in config.SUBWAY_FEEDS:
        f = d / (fid.replace("%2F", "_") + ".pb")
        if not f.exists():
            results.append(FeedResult(feed_id=fid, ok=False, error="missing", fetched_at=wall)); continue
        ts, trains = parse_feed(f.read_bytes(), fid)
        results.append(FeedResult(feed_id=fid, ok=True, timestamp=ts, trains=trains, fetched_at=wall))
    for r in results:
        if r.ok:
            store._by_feed[r.feed_id] = r.trains
    trains = [t for ts in store._by_feed.values() for t in ts]
    snap = store._place(trains, [], wall, wall)
    store.snapshot = snap
    with mock.patch("time.time", return_value=wall):
        feats = [api._train_feature(p, net, snap.display) for p in snap.placed]
    steps.append({"wall": wall, "version": snap.network_version, "trains": feats,
                  "lines": lines(snap.display), "counts": snap.resolution_counts})

stops = [{"stop_id": s.stop_id, "routes": sorted({net.display_route(r) for r in (net.stop_routes.get(s.stop_id+"N", set()) | net.stop_routes.get(s.stop_id+"S", set()))})} for s in net.stops.values() if not s.parent]
out_path.write_text(json.dumps({"scheduled": scheduled, "steps": steps, "stops": stops}))
print("python:", [(len(s["trains"]), len(s["lines"]), s["counts"]) for s in steps])
