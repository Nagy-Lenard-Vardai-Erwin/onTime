from fastapi import APIRouter
import math
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from db import SessionLocal
from sqlalchemy import text
from fastapi import Query
import pytz

from simulation.geo import distance_m
from models.errors.Errors import RouteNotFoundError, StationNotFoundError

router = APIRouter(
    prefix="/simulation",
    tags=["Simulation"]
)

_sim_process: subprocess.Popen | None = None
_sim_watermark_id: int | None = None


@router.post("/start")
def start_simulation():
    global _sim_process, _sim_watermark_id

    if _sim_process is not None and _sim_process.poll() is None:
        _sim_process.terminate()
        try:
            _sim_process.wait(timeout=5)
        except Exception:
            _sim_process.kill()

    db = SessionLocal()
    try:
        _sim_watermark_id = db.execute(
            text("SELECT COALESCE(MAX(id), 0) FROM bus_locations")
        ).scalar()
    finally:
        db.close()

    simulation_path = (
        Path(__file__)
        .resolve()
        .parents[1]
        / "simulation"
        / "bus_simulation.py"
    )

    _sim_process = subprocess.Popen(
        [
            sys.executable,
            str(simulation_path)
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    return {
        "message": "Simulation started"
    }


@router.post("/stop")
def stop_simulation():
    global _sim_process

    if _sim_process is not None and _sim_process.poll() is None:
        _sim_process.terminate()
        try:
            _sim_process.wait(timeout=5)
        except Exception:
            _sim_process.kill()

    _sim_process = None

    return {
        "message": "Simulation stopped"
    }


@router.get("/live")
def get_live_buses(
    line_id: int | None = Query(default=None),
    max_age_seconds: int | None = Query(default=None),
):
    db = SessionLocal()

    params: dict = {}
    conditions: list[str] = []

    if line_id:
        conditions.append("line_id = :line_id")
        params["line_id"] = line_id

    # Simulation view: the caller sends no max_age_seconds. Keep only rows
    # written by the simulation that is running right now.
    if max_age_seconds is None and _sim_watermark_id:
        conditions.append("id > :watermark")
        params["watermark"] = _sim_watermark_id

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    freshness_filter = ""
    if max_age_seconds:
        now = datetime.now(pytz.timezone("Europe/Bucharest")
                           ).replace(tzinfo=None)
        window = timedelta(seconds=max_age_seconds)
        freshness_filter = "WHERE latest.time BETWEEN :oldest AND :newest"
        params["oldest"] = now - window
        params["newest"] = now + window

    query = f"""
    SELECT * FROM (
        SELECT DISTINCT ON (bus_id)
            bus_id,
            bus_name,
            line_id,
            lat,
            lon,
            vel,
            time
        FROM bus_locations
        {where_clause}
        ORDER BY
            bus_id,
            id DESC
    ) latest
    {freshness_filter}
    """

    result = db.execute(text(query), params)

    return [
        dict(row._mapping)
        for row in result
    ]


_SAMPLE_INTERVAL_S = 5.0
_MIN_HEADING_DISPLACEMENT_M = 8.0


def _local_vector(a, b):
    """Flat-earth vector (meters east, meters north) from point a to b."""
    ref = math.radians(a[0])
    dx = (b[1] - a[1]) * 111320 * math.cos(ref)
    dy = (b[0] - a[0]) * 110540
    return dx, dy


def _heading_vector(points):
    """Unit direction of travel from the oldest to the newest sample."""
    dx, dy = _local_vector(points[0], points[-1])
    norm = math.hypot(dx, dy)
    if norm < _MIN_HEADING_DISPLACEMENT_M:
        return None
    return dx / norm, dy / norm


def _route_direction(route, i):
    """Unit direction of the route around point i."""
    a = route[max(i - 1, 0)]
    b = route[min(i + 1, len(route) - 1)]
    dx, dy = _local_vector(a, b)
    norm = math.hypot(dx, dy) or 1.0
    return dx / norm, dy / norm


def _candidate_clusters(route, point, slack_m=40, index_gap=5):
    """Indices of the route points nearest to `point`, one per pass.

    An out-and-back route passes the same street twice, so the near-minimum
    distances form several clusters of consecutive indices (one per leg).
    Returns one representative index per cluster plus all distances."""
    dists = [distance_m(point, rp) for rp in route]
    d_min = min(dists)
    candidates = [i for i, d in enumerate(dists) if d <= d_min + slack_m]

    clusters = []
    current = [candidates[0]]
    for i in candidates[1:]:
        if i - current[-1] <= index_gap:
            current.append(i)
        else:
            clusters.append(current)
            current = [i]
    clusters.append(current)

    return [min(c, key=lambda i: dists[i]) for c in clusters], dists


def _project_bus(route, point, heading):
    """Snap a bus to the route leg whose direction matches its heading.

    This is what tells apart the two sides of the road on an out-and-back
    route. Without a usable heading (bus standing still) fall back to the
    nearest point."""
    reps, dists = _candidate_clusters(route, point)
    if heading is None or len(reps) == 1:
        return min(reps, key=lambda i: dists[i])
    return max(
        reps,
        key=lambda i: (
            _route_direction(route, i)[0] * heading[0]
            + _route_direction(route, i)[1] * heading[1]
        ),
    )


def _assign_station_indices(route, stations):
    """Map every station of the line to a single route index.

    Stations are walked in order_index order and each must land further along
    the route than the previous one, which picks the correct leg for stations
    sitting between the two directions of travel."""
    assigned = {}
    prev = -1
    for st in stations:
        reps, dists = _candidate_clusters(route, (st.lat, st.long))
        ahead = [i for i in reps if i > prev]
        pool = ahead if ahead else reps
        idx = min(pool, key=lambda i: dists[i])
        assigned[st.id] = idx
        prev = idx
    return assigned


@router.get("/closest-bus")
def get_closest_bus(
    line_id: int = Query(...),
    station_id: int = Query(...),
    max_age_seconds: int | None = Query(default=None),
):
    db = SessionLocal()

    route_rows = db.execute(
        text(
            "SELECT lat, long FROM routes "
            "WHERE line_id = :line_id ORDER BY order_index"
        ),
        {"line_id": line_id},
    ).all()
    route = [(r.lat, r.long) for r in route_rows]
    if len(route) < 2:
        raise RouteNotFoundError()

    station_rows = db.execute(
        text(
            "SELECT id, lat, long, order_index FROM stations "
            "WHERE line_id = :line_id ORDER BY order_index"
        ),
        {"line_id": line_id},
    ).all()
    if not any(s.id == station_id for s in station_rows):
        raise StationNotFoundError()

    cum = [0.0]
    for a, b in zip(route, route[1:]):
        cum.append(cum[-1] + distance_m(a, b))
    total_length = cum[-1] or 1.0

    target_idx = _assign_station_indices(route, station_rows)[station_id]

    sample_params: dict = {"line_id": line_id}
    watermark_condition = ""
    if max_age_seconds is None and _sim_watermark_id:
        watermark_condition = "AND id > :watermark"
        sample_params["watermark"] = _sim_watermark_id

    rows = db.execute(
        text(
            f"""
            SELECT bus_id, bus_name, lat, lon, time, rn FROM (
                SELECT bus_id, bus_name, lat, lon, time,
                       ROW_NUMBER() OVER (
                           PARTITION BY bus_id ORDER BY id DESC
                       ) AS rn
                FROM bus_locations
                WHERE line_id = :line_id
                {watermark_condition}
            ) t WHERE rn <= 3
            """
        ),
        sample_params,
    ).all()

    samples_by_bus: dict = {}
    for r in rows:
        samples_by_bus.setdefault(r.bus_id, []).append(r)

    freshness_window = None
    if max_age_seconds:
        now = datetime.now(pytz.timezone("Europe/Bucharest")
                           ).replace(tzinfo=None)
        freshness_window = (
            now - timedelta(seconds=max_age_seconds),
            now + timedelta(seconds=max_age_seconds),
        )

    best = None
    best_distance = float("inf")

    for samples in samples_by_bus.values():
        samples.sort(key=lambda r: r.rn)
        newest = samples[0]

        if freshness_window and not (
            freshness_window[0] <= newest.time <= freshness_window[1]
        ):
            continue

        points = [(s.lat, s.lon) for s in reversed(samples)]
        heading = _heading_vector(points) if len(points) >= 2 else None

        bus_idx = _project_bus(route, points[-1], heading)
        forward_m = cum[target_idx] - cum[bus_idx]
        if forward_m < 0:
            forward_m += total_length

        speed_mps = 6.0
        if len(points) >= 2:
            step = distance_m(points[-2], points[-1]) / _SAMPLE_INTERVAL_S
            if step > 0.5:
                speed_mps = min(max(step, 2.0), 20.0)

        if forward_m < best_distance:
            best_distance = forward_m
            best = {
                "bus_id": newest.bus_id,
                "bus_name": newest.bus_name,
                "lat": newest.lat,
                "lon": newest.lon,
                "distance_m": round(forward_m),
                "eta_seconds": round(forward_m / speed_mps),
                "heading_known": heading is not None,
            }

    return {"bus": best}
