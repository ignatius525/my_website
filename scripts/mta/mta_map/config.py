"""Configuration: feed endpoints, tuning constants, cache locations.

Every endpoint here was verified live against the MTA on 2026-09-01 with no
API key. Notes that cost real debugging time:

* The ``nyct%2F`` prefix **must stay percent-encoded**. The decoded path
  ``.../mtagtfsfeeds/nyct/gtfs-l`` returns HTTP 403.
* Feeds respond with ``application/octet-stream``, so content-type cannot be
  used to tell success from failure. Bad paths return **HTTP 200** carrying an
  S3 XML error body, which is why :mod:`mta_map.feeds` sniffs the payload.
* There is no ``gtfs-7`` feed; routes 1-7 and the 42 St shuttle ride on
  ``nyct%2Fgtfs``.
"""

from __future__ import annotations

import os
from pathlib import Path

BASE = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds"

# Feed id -> routes it is documented to carry. The routes are informational
# (for /api/health reporting); whatever the feed actually returns wins.
SUBWAY_FEEDS: dict[str, tuple[str, ...]] = {
    "nyct%2Fgtfs": ("1", "2", "3", "4", "5", "6", "6X", "7", "7X", "GS"),
    "nyct%2Fgtfs-ace": ("A", "C", "E", "H"),
    "nyct%2Fgtfs-bdfm": ("B", "D", "F", "FX", "M", "FS"),
    "nyct%2Fgtfs-g": ("G",),
    "nyct%2Fgtfs-jz": ("J", "Z"),
    "nyct%2Fgtfs-nqrw": ("N", "Q", "R", "W"),
    "nyct%2Fgtfs-l": ("L",),
    "nyct%2Fgtfs-si": ("SI", "SS"),
}

ALERTS_FEED = f"{BASE}/camsys%2Fsubway-alerts"

# The plain subway bundle, not gtfs_supplemented.zip: the two ship a
# byte-identical stops.txt and the same 257 shapes, but the supplement's
# stop_times.txt is 131 MB against 36 MB. Nothing is gained geometrically.
STATIC_GTFS_URL = "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip"


def feed_url(feed_id: str) -> str:
    return f"{BASE}/{feed_id}"


# ---------------------------------------------------------------- timing ----

POLL_INTERVAL = float(os.environ.get("MTA_MAP_POLL_INTERVAL", "60"))
HTTP_TIMEOUT = float(os.environ.get("MTA_MAP_HTTP_TIMEOUT", "25"))
HTTP_RETRIES = int(os.environ.get("MTA_MAP_HTTP_RETRIES", "2"))

# A feed whose header timestamp is older than this is reported unhealthy.
FEED_STALE_AFTER = 180.0
# Drop a train we have not seen in any feed for this long.
TRAIN_EXPIRY = 300.0

# ------------------------------------------------------------ active track ----

# Draw only the track routes are currently running over, rather than every
# pattern in the static schedule. The E runs Queens Boulevard express except
# overnight and on diversions, yet its shapes cover both; measured against a
# live snapshot the schedule carries 14.5 km of phantom W through Brooklyn,
# 11.9 km of R, 6.8 km of F and 2.2 km of E local.
ACTIVE_ONLY = os.environ.get("MTA_MAP_ACTIVE_ONLY", "1") not in ("0", "false", "no")

# How long a stretch of track stays drawn after the last train scheduled over
# it. Trip updates already look about an hour ahead; keeping some of the recent
# past as well stops a line blinking out between trains on a long headway, while
# a real change of pattern still takes effect within the window.
ACTIVE_TRACK_WINDOW = float(os.environ.get("MTA_MAP_ACTIVE_WINDOW", "1800"))

# ------------------------------------------------------------- movement ----

# Measured across 14 884 live segments: median 15.7 mph, p95 24.6 mph. 0.30%
# of segments implied over 60 mph (max 12 081 mph) and three had dt <= 0, so
# implied speeds are clamped into this band before they are trusted.
MIN_SPEED_MPS = 1.3   # ~3 mph
MAX_SPEED_MPS = 20.0  # ~45 mph
TYPICAL_SPEED_MPS = 7.0  # ~15.7 mph, the measured median; used when timing is absent

# Cap progress short of 1.0 so a train never visually overshoots a station the
# feed has not yet confirmed it reached.
MAX_PROGRESS = 0.98

# ---------------------------------------------------------------- paths ----

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Anchored on the project, not the working directory: a systemd unit on the Pi
# will not be started from the repo root. Override with MTA_MAP_CACHE.
CACHE_DIR = Path(os.environ.get("MTA_MAP_CACHE") or PROJECT_ROOT / ".cache").resolve()
GTFS_ZIP = CACHE_DIR / "gtfs_subway.zip"
NETWORK_JSON = CACHE_DIR / "network.json"
WEB_DIR = PROJECT_ROOT / "web"

# Refresh the static bundle when the cached copy is older than this.
STATIC_MAX_AGE = 7 * 24 * 3600
