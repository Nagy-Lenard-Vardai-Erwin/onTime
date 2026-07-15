from fastapi import APIRouter
import math
import os
import signal
import subprocess
import sys
import tempfile
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

_PID_FILE = Path(tempfile.gettempdir()) / "ontime_simulation.pid"


def _terminate_simulation():
    global _sim_process

    if _sim_process is not None and _sim_process.poll() is None:
        _sim_process.terminate()
        try:
            _sim_process.wait(timeout=5)
        except Exception:
            _sim_process.kill()
    _sim_process = None

    try:
        if _PID_FILE.exists():
            old_pid = int(_PID_FILE.read_text().strip())
            try:
                os.kill(old_pid, signal.SIGTERM)
            except OSError:
                pass
            _PID_FILE.unlink(missing_ok=True)
    except Exception:
        pass


@router.post("/start")
def start_simulation():
    global _sim_process, _sim_watermark_id

    _terminate_simulation()

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

    try:
        _PID_FILE.write_text(str(_sim_process.pid))
    except Exception:
        pass

    return {
        "message": "Simulation started"
    }


@router.post("/stop")
def stop_simulation():
    _terminate_simulation()

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
    ref = math.radians(a[0])
    dx = (b[1] - a[1]) * 111320 * math.cos(ref)
    dy = (b[0] - a[0]) * 110540
    return dx, dy


def _heading_vector(points):
    dx, dy = _local_vector(points[0], points[-1])
    norm = math.hypot(dx, dy)
    if norm < _MIN_HEADING_DISPLACEMENT_M:
        return None
    return dx / norm, dy / norm


def _route_direction(route, i):
    a = route[max(i - 1, 0)]
    b = route[min(i + 1, len(route) - 1)]
    dx, dy = _local_vector(a, b)
    norm = math.hypot(dx, dy) or 1.0
    return dx / norm, dy / norm


def _candidate_clusters(route, point, slack_m=40, index_gap=5):
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
