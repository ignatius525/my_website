"""Download, cache and stream the static GTFS bundle."""

from __future__ import annotations

import csv
import io
import logging
import time
import zipfile
from collections.abc import Iterator
from pathlib import Path

import httpx

from . import config

log = logging.getLogger(__name__)


class StaticGtfsError(RuntimeError):
    pass


def ensure_gtfs(force: bool = False) -> Path:
    """Return a path to the cached GTFS zip, downloading it if needed."""
    path = config.GTFS_ZIP
    if not force and path.exists():
        age = time.time() - path.stat().st_mtime
        if age < config.STATIC_MAX_AGE and zipfile.is_zipfile(path):
            return path
        log.info("static GTFS is %.1f days old, refreshing", age / 86400)

    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".zip.part")
    log.info("downloading %s", config.STATIC_GTFS_URL)
    with httpx.stream(
        "GET", config.STATIC_GTFS_URL, timeout=300.0, follow_redirects=True
    ) as r:
        r.raise_for_status()
        with tmp.open("wb") as fh:
            for chunk in r.iter_bytes(65536):
                fh.write(chunk)

    if not zipfile.is_zipfile(tmp):
        tmp.unlink(missing_ok=True)
        raise StaticGtfsError("downloaded static GTFS is not a zip archive")
    tmp.replace(path)
    log.info("static GTFS cached at %s (%.1f MB)", path, path.stat().st_size / 1e6)
    return path


def read_rows(path: Path, name: str) -> Iterator[dict[str, str]]:
    """Stream one CSV member of the zip as dicts, without unpacking to disk.

    ``stop_times.txt`` is 36 MB, so nothing here ever materialises a whole file.
    """
    with zipfile.ZipFile(path) as zf:
        try:
            member = zf.open(name)
        except KeyError as exc:
            raise StaticGtfsError(f"{name} missing from {path}") from exc
        with member:
            # utf-8-sig strips the BOM MTA sometimes prefixes.
            yield from csv.DictReader(io.TextIOWrapper(member, encoding="utf-8-sig"))


def feed_version(path: Path) -> str:
    """The publisher's version string, used to invalidate the network cache."""
    for row in read_rows(path, "feed_info.txt"):
        return row.get("feed_version", "")
    return ""
