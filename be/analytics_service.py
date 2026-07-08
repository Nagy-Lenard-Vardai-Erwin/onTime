"""
Bridge between the FastAPI app and the standalone ``analytics`` package.

The modules inside ``be/analytics`` use plain top-level imports
(``from data_loader import ...``) because they were written to be run as a
script from within that folder.  To reuse those exact functions from the API we
append the analytics folder to ``sys.path`` and import the functions we need.

Loading and cleaning ~130k bus-location rows takes a few seconds, so the result
is cached in-memory for ``_CACHE_TTL`` seconds.  Every dashboard chart is
derived from a single cached snapshot, and the CSV download endpoint serves the
same data, so a page load only triggers one database read.
"""

import json
import os
import sys
import threading
import time

import pandas as pd

_ANALYTICS_DIR = os.path.join(os.path.dirname(__file__), "analytics")
if _ANALYTICS_DIR not in sys.path:
    sys.path.append(_ANALYTICS_DIR)

from data_loader import load_bus_locations
from cleaning import clean_data
from route_analysis import (
    trips_per_route,
    buses_per_route,
)
from speed_analysis import (
    speed_statistics,
    speed_by_route,
    speed_by_hour,
    speed_by_bus,
)
from distance_analysis import calculate_distances
from temporal_analysis import (
    activity_by_hour,
    activity_by_weekday,
    active_buses_by_hour,
    route_activity_share,
    speed_by_period,
)

_CACHE_TTL = 600
_cache: dict = {"ts": 0.0, "frames": None, "summary": None}
_lock = threading.Lock()

METRICS = {
    "route_usage": "Route usage (records per line)",
    "buses_per_route": "Buses per route",
    "route_activity_share": "Route activity share",
    "speed_by_route": "Average speed by route",
    "speed_by_hour": "Average speed by hour",
    "speed_by_period": "Average speed by period",
    "distance_by_route": "Distance travelled by route",
    "top_buses_by_distance": "Top 10 buses by distance",
    "top_active_buses": "Top 10 active buses",
    "activity_by_hour": "Activity by hour",
    "activity_by_weekday": "Activity by weekday",
    "active_buses_by_hour": "Active buses by hour",
}

_WEEKDAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

def _records(df: pd.DataFrame) -> list:
    """DataFrame -> list[dict] with native JSON types (handles numpy/NaN)."""
    if df is None or df.empty:
        return []
    return json.loads(df.to_json(orient="records"))

def _compute_frames(df: pd.DataFrame) -> dict:
    """Compute every dashboard DataFrame from a single cleaned snapshot."""
    frames: dict = {}

    if df.empty:
        return {key: pd.DataFrame() for key in METRICS}

    frames["route_usage"] = trips_per_route(df)
    frames["buses_per_route"] = buses_per_route(df)
    frames["route_activity_share"] = route_activity_share(df)
    frames["speed_by_route"] = speed_by_route(df)
    frames["speed_by_hour"] = speed_by_hour(df)
    frames["speed_by_period"] = speed_by_period(df)

    dist = calculate_distances(df)

    frames["distance_by_route"] = (
        dist.groupby("line_name")["segment_distance_km"]
        .sum()
        .reset_index()
        .rename(columns={"segment_distance_km": "distance_km"})
        .sort_values(by="distance_km", ascending=False)
    )

    frames["top_buses_by_distance"] = (
        dist.groupby("bus_name")["segment_distance_km"]
        .sum()
        .reset_index()
        .rename(columns={"segment_distance_km": "distance_km"})
        .sort_values(by="distance_km", ascending=False)
        .head(10)
    )

    frames["top_active_buses"] = (
        df.groupby(["bus_id", "bus_name"])
        .size()
        .reset_index(name="records")
        .sort_values(by="records", ascending=False)
        .head(10)
    )

    frames["activity_by_hour"] = activity_by_hour(df)

    weekday = activity_by_weekday(df)
    weekday["weekday"] = pd.Categorical(
        weekday["weekday"], categories=_WEEKDAY_ORDER, ordered=True
    )
    frames["activity_by_weekday"] = weekday.sort_values("weekday")

    frames["active_buses_by_hour"] = active_buses_by_hour(df)

    for key, frame in frames.items():
        for col in frame.select_dtypes(include="float").columns:
            frame[col] = frame[col].round(2)

    return frames

def _compute_summary(df: pd.DataFrame, frames: dict) -> dict:
    """Headline numbers shown in the dashboard cards."""
    if df.empty:
        return {
            "routes": 0,
            "buses": 0,
            "records": 0,
            "total_distance_km": 0.0,
            "avg_speed": 0.0,
            "max_speed": 0.0,
            "median_speed": 0.0,
            "busiest_route": None,
            "busiest_hour": None,
            "fastest_bus": None,
        }

    stats = speed_statistics(df)
    distance_by_route = frames["distance_by_route"]
    route_usage = frames["route_usage"]
    activity_hour = frames["activity_by_hour"]
    speed_bus = speed_by_bus(df)

    busiest_route = (
        route_usage.iloc[0].to_dict() if not route_usage.empty else None
    )
    busiest_hour = (
        activity_hour.loc[activity_hour["records"].idxmax()].to_dict()
        if not activity_hour.empty
        else None
    )
    fastest_bus = speed_bus.iloc[0].to_dict() if not speed_bus.empty else None

    return {
        "routes": int(df["line_id"].nunique()),
        "buses": int(df["bus_id"].nunique()),
        "records": int(len(df)),
        "total_distance_km": round(
            float(distance_by_route["distance_km"].sum()), 2
        ),
        "avg_speed": round(float(stats["avg_speed"]), 2),
        "max_speed": round(float(stats["max_speed"]), 2),
        "median_speed": round(float(stats["median_speed"]), 2),
        "busiest_route": json.loads(json.dumps(busiest_route, default=_native))
        if busiest_route
        else None,
        "busiest_hour": json.loads(json.dumps(busiest_hour, default=_native))
        if busiest_hour
        else None,
        "fastest_bus": json.loads(json.dumps(fastest_bus, default=_native))
        if fastest_bus
        else None,
    }

def _native(value):
    """json default helper: cast numpy scalars to native python."""
    if hasattr(value, "item"):
        return value.item()
    return str(value)

def _get_snapshot(force: bool = False) -> dict:
    """Return cached ``{frames, summary}``, recomputing when stale."""
    now = time.time()
    with _lock:
        fresh = (
            not force
            and _cache["frames"] is not None
            and (now - _cache["ts"]) < _CACHE_TTL
        )
        if fresh:
            return _cache

        df = clean_data(load_bus_locations())

        frames = _compute_frames(df)
        summary = _compute_summary(df, frames)

        _cache["frames"] = frames
        _cache["summary"] = summary
        _cache["ts"] = now
        return _cache

def get_overview(force: bool = False) -> dict:
    """Full payload consumed by the dashboard: summary + every chart series."""
    snapshot = _get_snapshot(force=force)
    frames = snapshot["frames"]

    return {
        "summary": snapshot["summary"],
        "metrics": {
            key: _records(frames.get(key, pd.DataFrame())) for key in METRICS
        },
    }

def get_metric_csv(metric: str) -> str:
    """Return a single metric's data as a CSV string for download."""
    if metric not in METRICS:
        raise KeyError(metric)

    snapshot = _get_snapshot()
    frame = snapshot["frames"].get(metric)

    if frame is None:
        frame = pd.DataFrame()

    return frame.to_csv(index=False)
