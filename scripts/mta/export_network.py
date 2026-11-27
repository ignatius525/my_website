"""Export the static subway network for the in-browser live map.

The live map (src/subway/) runs the fun-mta pipeline in a Web Worker, so the
static network it needs (stops, routes, stop-pair segments and the track edges
used to bundle parallel lines) is built here by the original Python code and
shipped as JSON. That code is vendored in scripts/mta/mta_map/ (verbatim from
fun-mta); nothing in this file re-implements the build, it only re-shapes
`mta_map.network.Network` for the browser.

Runs nightly in .github/workflows/refresh-subway-data.yml. By hand
(Python >= 3.10):

    python -m venv .venv-mta
    .venv-mta/bin/pip install --require-hashes -r scripts/mta/requirements.txt
    .venv-mta/bin/python scripts/mta/export_network.py --fresh

The output is deterministic (no timestamps), so if MTA has not published a new
schedule the file is rewritten byte for byte and git sees no change. An export
that loses more than 20% of the previous one's stops, segments or edges is
refused rather than published (override with --allow-shrink).

Ordering is part of the format. The browser port walks track edges in exactly
the order `Network.build_track_lines` does, because walk order decides which
way each bundle is wound, and with it which side of the rails each route is
drawn on. That order depends on CPython's iteration order of two-point
frozensets, which JavaScript cannot reproduce, so it is recorded here:

* each edge carries, per route, the global position of that route's first
  occurrence of it in the shape loop, and the direction it was met in;
* `tuple(frozenset((p, q)))` and `tuple(frozenset((q, p)))` are recorded as two
  flags, so the port can tell which endpoint Python would unpack first.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# The vendored package next to this file, ahead of any installed fun-mta.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from mta_map import network, static_gtfs  # noqa: E402
from mta_map.network import _quantise  # noqa: E402

SCHEMA = 1
DEFAULT_OUT = Path(__file__).resolve().parents[2] / "src" / "subway" / "data" / "network.json"
# Sanity floors for any export, well under the fall 2026 network
# (1488 stops, 1149 segments, ~9000 edges, 29 routes).
MIN_COUNTS = {"stops": 1000, "segments": 800, "edges": 6000, "routes": 20}
CORE_ROUTES = {"1", "2", "3", "4", "5", "6", "7", "A", "C", "E", "B", "D", "F", "M",
               "G", "J", "Z", "L", "N", "Q", "R", "W", "SI"}
MAX_SHRINK = 0.8


def _first_is(pair, a) -> int:
    """1 if iterating frozenset `pair` yields `a` first, else 0."""
    return 1 if tuple(pair)[0] == a else 0


def export(net: network.Network) -> dict:
    stops = {
        s.stop_id: [s.name, round(s.lon, 6), round(s.lat, 6), s.parent]
        for s in net.stops.values()
    }
    routes = {
        r.route_id: [r.short_name, r.long_name, r.color, r.text_color, r.sort_order]
        for r in net.routes.values()
    }
    # Sorted: fun-mta builds this table by iterating a set of stop-id strings,
    # whose order changes with Python's per-process hash seed. The order feeds
    # the engine's tie-breaks (graph search, predecessor guesses), so it is
    # fixed here -- and parity_reference.py applies the same sort.
    segments = [
        [seg.from_stop, seg.to_stop, seg.length_m, sorted(seg.routes),
         [[x, y] for x, y in seg.via]]
        for seg in sorted(net.segments.values(), key=lambda s: (s.from_stop, s.to_stop))
    ]

    # Mirror the loop in Network.build_track_lines (active=None) exactly.
    edges: dict[frozenset, dict] = {}
    position = 0
    for shape_id, pts in net.shapes.items():
        raw = net.shape_routes.get(shape_id, "")
        route = net.display_route(raw)
        if not route or raw != route:
            continue
        for i in range(len(pts) - 1):
            a, b = _quantise(pts[i]), _quantise(pts[i + 1])
            if a == b:
                continue
            rec = edges.setdefault(frozenset((a, b)), {})
            if route not in rec:
                rec[route] = (position, a, b)
            position += 1

    out_edges = []
    for key, per_route in edges.items():
        p, q = sorted(key)
        out_edges.append([
            [p[0], p[1]], [q[0], q[1]],
            # Which endpoint tuple(frozenset(...)) yields first, for each
            # insertion order: 1 means p comes out first.
            _first_is(frozenset((p, q)), p),
            _first_is(frozenset((q, p)), p),
            {r: [pos, 0 if (a, b) == (p, q) else 1] for r, (pos, a, b) in per_route.items()},
        ])

    return {
        "schema": SCHEMA,
        "gtfs_version": net.version,
        "stops": stops,
        "routes": routes,
        "segments": segments,
        "edges": out_edges,
    }


def validate(data: dict, previous: dict | None, allow_shrink: bool) -> list[str]:
    """Reasons not to publish this export (empty if it looks sound)."""
    problems = []
    for key, floor in MIN_COUNTS.items():
        if len(data[key]) < floor:
            problems.append(f"only {len(data[key])} {key} (expected at least {floor})")
    missing = CORE_ROUTES - set(data["routes"])
    if missing:
        problems.append(f"routes missing: {', '.join(sorted(missing))}")
    if previous and previous.get("schema") == SCHEMA and not allow_shrink:
        for key in ("stops", "segments", "edges"):
            old, new = len(previous.get(key, ())), len(data[key])
            if old and new < old * MAX_SHRINK:
                problems.append(f"{key} shrank from {old} to {new}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("-o", "--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--fresh", action="store_true",
                        help="re-download the static GTFS instead of using a cached copy (up to 7 days old)")
    parser.add_argument("--allow-shrink", action="store_true",
                        help="publish even if the network shrank by more than 20%%")
    args = parser.parse_args()

    if args.fresh:
        static_gtfs.ensure_gtfs(force=True)
    # Round-trip through the cache format so the export matches what the
    # server would load (segment lengths are rounded in the cache).
    net = network.Network.from_json(network.load().to_json())
    data = export(net)

    previous = None
    if args.out.exists():
        try:
            previous = json.loads(args.out.read_text())
        except json.JSONDecodeError:
            previous = None
    problems = validate(data, previous, args.allow_shrink)
    if problems:
        print("refusing to write the export:\n  " + "\n  ".join(problems), file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, separators=(",", ":")))
    changed = not previous or previous.get("gtfs_version") != data["gtfs_version"]
    print(
        f"{args.out}: {len(data['stops'])} stops, {len(data['segments'])} segments, "
        f"{len(data['edges'])} edges, {args.out.stat().st_size / 1e6:.2f} MB "
        f"(GTFS {data['gtfs_version']}{', new' if changed else ', unchanged'})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
