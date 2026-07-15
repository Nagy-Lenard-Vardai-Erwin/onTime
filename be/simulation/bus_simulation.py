import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import time
import random
from datetime import datetime, timedelta

from db import SessionLocal
from simulation.geo import distance_m
from simulation.route_loader import load_route, load_stations
from simulation.station_logic import is_near_station
from models.db_schemas.BusLocation import BusLocation
from models.db_schemas.Bus import Bus
from models.db_schemas.Route import Route


STEP_SECONDS = 5
LOOP_INTERVAL_SECONDS = 5
BUSES_PER_ROUTE = 5

SPEED_KMH = 30
STATION_THRESHOLD_M = 30
STATION_STOP_SECONDS = (5, 15)
RANDOM_STOP_PROB = 0.05
RANDOM_STOP_SECONDS = (10, 30)


def build_buses(db):
    line_ids = [row[0] for row in db.query(Route.line_id).distinct().all()]
    all_buses = db.query(Bus).all()
    used_bus_ids: set = set()

    buses = []
    for line_id in line_ids:
        waypoints = load_route(db, line_id)
        if len(waypoints) < 2:
            continue

        own = [
            b for b in all_buses
            if b.line_id == line_id and b.id not in used_bus_ids
        ]
        chosen = own[:BUSES_PER_ROUTE]
        if not chosen:
            continue

        stations = load_stations(db, line_id)
        count = len(chosen)

        for i, bus_record in enumerate(chosen):
            used_bus_ids.add(bus_record.id)
            start_index = min((i * len(waypoints)) // count, len(waypoints) - 1)
            buses.append({
                "bus_id": bus_record.id,
                "bus_name": bus_record.name,
                "line_id": line_id,
                "waypoints": waypoints,
                "stations": stations,
                "current_index": start_index,
                "position": (
                    waypoints[start_index].lat,
                    waypoints[start_index].long,
                ),
                "visited_stations": set(),
                "wait_seconds": 0,
                "vel": SPEED_KMH,
                "time": datetime.now(),
            })
    return buses


def advance(bus):
    if bus["wait_seconds"] > 0:
        bus["wait_seconds"] = max(0, bus["wait_seconds"] - STEP_SECONDS)
        bus["vel"] = 0
        return

    bus["vel"] = SPEED_KMH
    budget_m = (SPEED_KMH / 3.6) * STEP_SECONDS
    waypoints = bus["waypoints"]

    while budget_m > 0:
        next_index = bus["current_index"] + 1
        if next_index > len(waypoints) - 1:
            bus["current_index"] = 0
            bus["position"] = (waypoints[0].lat, waypoints[0].long)
            bus["visited_stations"].clear()
            break

        target = (waypoints[next_index].lat, waypoints[next_index].long)
        seg = distance_m(bus["position"], target)

        if seg > budget_m:
            ratio = budget_m / seg
            bus["position"] = (
                bus["position"][0] + (target[0] - bus["position"][0]) * ratio,
                bus["position"][1] + (target[1] - bus["position"][1]) * ratio,
            )
            break

        bus["position"] = target
        budget_m -= seg
        bus["current_index"] = next_index

    for station in bus["stations"]:
        if station.station_id in bus["visited_stations"]:
            continue
        if is_near_station(bus["position"], station, STATION_THRESHOLD_M):
            bus["visited_stations"].add(station.station_id)
            bus["wait_seconds"] = random.randint(*STATION_STOP_SECONDS)
            bus["vel"] = 0
            return

    if random.random() < RANDOM_STOP_PROB:
        bus["wait_seconds"] = random.randint(*RANDOM_STOP_SECONDS)
        bus["vel"] = 0


def main():
    db = SessionLocal()
    buses = build_buses(db)

    while True:
        for bus in buses:
            advance(bus)
            db.add(BusLocation(
                bus_id=bus["bus_id"],
                bus_name=bus["bus_name"],
                line_id=bus["line_id"],
                lat=bus["position"][0],
                lon=bus["position"][1],
                vel=bus["vel"],
                time=bus["time"],
            ))
            bus["time"] += timedelta(seconds=STEP_SECONDS)

        db.commit()
        time.sleep(LOOP_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
