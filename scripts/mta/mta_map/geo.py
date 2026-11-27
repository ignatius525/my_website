"""Geometry helpers for placing trains on subway line polylines.

Everything works in a *local equirectangular plane* scaled so that one unit is
one metre. NYC spans ~0.5 degrees of latitude, so a single cos(lat) scale factor
taken at the city's centre is accurate to well under a metre here -- far below
the ~100 m worst-case offset between a stop and its line geometry.

Coordinates are (lon, lat) throughout, matching GeoJSON.
"""

from __future__ import annotations

import bisect
import math

EARTH_R = 6371008.8  # WGS84 mean radius, metres
NYC_LAT = 40.73  # reference latitude for the local plane

Point = tuple[float, float]


def plane(lat0: float = NYC_LAT) -> tuple[float, float]:
    """Metres-per-degree scale factors (kx, ky) for a local plane at `lat0`."""
    ky = math.radians(1.0) * EARTH_R
    return ky * math.cos(math.radians(lat0)), ky


KX, KY = plane()


def cumulative(pts: list[Point]) -> list[float]:
    """Cumulative along-line distance in metres for each vertex."""
    cum = [0.0]
    for i in range(1, len(pts)):
        dx = (pts[i][0] - pts[i - 1][0]) * KX
        dy = (pts[i][1] - pts[i - 1][1]) * KY
        cum.append(cum[-1] + math.hypot(dx, dy))
    return cum


def haversine(a: Point, b: Point) -> float:
    """True great-circle distance in metres; used for validation, not hot paths."""
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_R * math.asin(math.sqrt(h))


def project(pts: list[Point], cum: list[float], p: Point) -> tuple[float, float]:
    """Project `p` onto the polyline.

    Returns (offset_metres, distance_along_metres) for the nearest point on the
    line. O(len(pts)); only ever called during the one-time network build.
    """
    px, py = p[0] * KX, p[1] * KY
    best_off = math.inf
    best_dist = 0.0
    for i in range(len(pts) - 1):
        ax, ay = pts[i][0] * KX, pts[i][1] * KY
        bx, by = pts[i + 1][0] * KX, pts[i + 1][1] * KY
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy
        if seg2 == 0.0:
            t = 0.0
        else:
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg2))
        off = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
        if off < best_off:
            best_off = off
            best_dist = cum[i] + t * math.sqrt(seg2)
    return best_off, best_dist


def bearing_at(pts: list[Point], i: int) -> float:
    """Compass bearing (degrees clockwise from north) of segment `i`.

    Skips zero-length segments rather than reporting due north for them. A
    sliced polyline can begin with a degenerate segment when a stop projects
    exactly onto a shape vertex, and returning 0.0 there would point a train's
    direction arrow north while it actually travels southwest.
    """
    if len(pts) < 2:
        return 0.0
    i = max(0, min(i, len(pts) - 2))
    for j in list(range(i, len(pts) - 1)) + list(range(i - 1, -1, -1)):
        dx = (pts[j + 1][0] - pts[j][0]) * KX
        dy = (pts[j + 1][1] - pts[j][1]) * KY
        if dx != 0.0 or dy != 0.0:
            return math.degrees(math.atan2(dx, dy)) % 360.0
    return 0.0


def bearing_between(a: Point, b: Point) -> float:
    """Compass bearing from `a` to `b`, degrees clockwise from north."""
    dx = (b[0] - a[0]) * KX
    dy = (b[1] - a[1]) * KY
    if dx == 0.0 and dy == 0.0:
        return 0.0
    return math.degrees(math.atan2(dx, dy)) % 360.0


def segment_index(pts: list[Point], cum: list[float], target: float) -> int:
    """Index of the polyline segment containing `target` metres along it."""
    if len(pts) < 2:
        return 0
    i = bisect.bisect_right(cum, target) - 1
    return max(0, min(i, len(pts) - 2))


def interpolate(pts: list[Point], cum: list[float], target: float) -> tuple[float, float, float]:
    """Point at `target` metres along the polyline, as (lon, lat, bearing)."""
    if len(pts) == 1:
        return pts[0][0], pts[0][1], 0.0
    total = cum[-1]
    if target <= 0.0:
        return pts[0][0], pts[0][1], bearing_at(pts, 0)
    if target >= total:
        return pts[-1][0], pts[-1][1], bearing_at(pts, len(pts) - 2)

    i = bisect.bisect_right(cum, target) - 1
    i = max(0, min(i, len(pts) - 2))
    span = cum[i + 1] - cum[i]
    t = 0.0 if span <= 0.0 else (target - cum[i]) / span
    lon = pts[i][0] + t * (pts[i + 1][0] - pts[i][0])
    lat = pts[i][1] + t * (pts[i + 1][1] - pts[i][1])
    return lon, lat, bearing_at(pts, i)


def slice_between(pts: list[Point], cum: list[float], d0: float, d1: float) -> list[Point]:
    """Sub-polyline between two along-line distances, endpoints included exactly."""
    if d1 <= d0:
        lon, lat, _ = interpolate(pts, cum, d0)
        return [(lon, lat)]
    lon0, lat0, _ = interpolate(pts, cum, d0)
    lon1, lat1, _ = interpolate(pts, cum, d1)
    out: list[Point] = [(lon0, lat0)]
    lo = bisect.bisect_right(cum, d0)
    hi = bisect.bisect_left(cum, d1)
    for pt in (*pts[lo:hi], (lon1, lat1)):
        # Rounding can reproduce an endpoint that is already present; duplicate
        # consecutive vertices leave a zero-length segment behind.
        if pt != out[-1]:
            out.append(pt)
    return out


def polyline_length(pts: list[Point]) -> float:
    """Total length of a polyline in metres."""
    return cumulative(pts)[-1] if len(pts) > 1 else 0.0
