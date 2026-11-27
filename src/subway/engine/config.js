/*
 * Live subway map: feed endpoints and tuning constants.
 *
 * Ported from fun-mta (mta_map/config.py). The engine in this folder is the
 * project's Python backend, run in a Web Worker: the MTA feeds send
 * `Access-Control-Allow-Origin: *`, so the browser can poll them directly and
 * the site needs no server.
 *
 * Every endpoint needs no API key. Two notes that cost real debugging time:
 * - The `nyct%2F` prefix must stay percent-encoded; the decoded path 403s.
 * - A wrong path returns HTTP 200 with an S3 XML error body, so success is
 *   decided by decoding the payload, never by status or content type.
 */

export const FEED_BASE = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds';

// Feed id -> routes it is documented to carry (informational; the feed wins).
// There is no gtfs-7 feed: routes 1-7 and the 42 St shuttle ride on nyct%2Fgtfs.
export const SUBWAY_FEEDS = {
  'nyct%2Fgtfs': ['1', '2', '3', '4', '5', '6', '6X', '7', '7X', 'GS'],
  'nyct%2Fgtfs-ace': ['A', 'C', 'E', 'H'],
  'nyct%2Fgtfs-bdfm': ['B', 'D', 'F', 'FX', 'M', 'FS'],
  'nyct%2Fgtfs-g': ['G'],
  'nyct%2Fgtfs-jz': ['J', 'Z'],
  'nyct%2Fgtfs-nqrw': ['N', 'Q', 'R', 'W'],
  'nyct%2Fgtfs-l': ['L'],
  'nyct%2Fgtfs-si': ['SI', 'SS'],
};

export const feedUrl = (feedId) => `${FEED_BASE}/${feedId}`;

// ---------------------------------------------------------------- timing ----

export const POLL_INTERVAL_MS = 60_000;
export const HTTP_TIMEOUT_MS = 25_000;
export const HTTP_RETRIES = 2;
// The largest live feed is ~45 kB gzipped (~600 kB decoded), carrying ~300
// trains. Anything far beyond that is not a feed: refusing it bounds the
// decode cost of a hostile or broken response (an 8 MB one decoded to 524k
// trains and 455 MB of heap in review).
export const MAX_FEED_BYTES = 2 * 1024 * 1024;
export const MAX_TRAINS_PER_FEED = 3000;

// A feed whose header timestamp is older than this is reported unhealthy.
export const FEED_STALE_AFTER = 180;
// Drop a train we have not seen in any feed for this long.
export const TRAIN_EXPIRY = 300;

// The Python server polled nonstop; the browser pauses while the map is off
// screen or the tab is hidden. Cross-poll memory is only valid between
// consecutive polls, so after a longer gap it is discarded and the next poll
// starts fresh, as a newly started server would. Without this a resumed map
// drew ~20% of trains on straight chords from stops they left minutes (or,
// since NYCT train ids repeat daily, days) ago.
export const RESUME_GAP = 150;

// If the visitor's clock disagrees with the feeds' header timestamps by more
// than this, positions are computed on the feeds' clock instead (the Python
// served its own server time to the page for the same reason). Feeds are
// normally 0-30 s old when fetched, so smaller differences are left alone.
export const CLOCK_SKEW_TOLERANCE = 90;

// ------------------------------------------------------------ active track ----

// Draw only the track routes are currently running over, not every pattern in
// the static schedule (which carries 14.5 km of phantom W through Brooklyn).
export const ACTIVE_ONLY = true;
// How long a stretch of track stays drawn after the last train scheduled over
// it, so a line does not blink out between trains on a long headway.
export const ACTIVE_TRACK_WINDOW = 1800;

// ------------------------------------------------------------- movement ----

// Measured across 14 884 live segments: median 15.7 mph, p95 24.6 mph; 0.30%
// implied over 60 mph, so implied speeds are clamped into this band.
export const MIN_SPEED_MPS = 1.3; // ~3 mph
export const MAX_SPEED_MPS = 20.0; // ~45 mph
export const TYPICAL_SPEED_MPS = 7.0; // the measured median

// Cap progress short of 1.0 so a train never visually overshoots a station
// the feed has not yet confirmed it reached.
export const MAX_PROGRESS = 0.98;
