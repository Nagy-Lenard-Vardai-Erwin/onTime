import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
import time
from datetime import datetime, timedelta
from db import SessionLocal
from simulation.geo import distance_m
from models.db_schemas.BusLocation import BusLocation
import random
from simulation.route_loader import load_route, load_stations
from simulation.station_logic import is_near_station
from models.db_schemas.Bus import Bus
from models.db_schemas.Route import Route


STEP_SECONDS = 5
LOOP_INTERVAL_SECONDS = 5

BUSES_PER_ROUTE = 5

INITIAL_SPEED_KMH = 25
CRUISE_SPEED_KMH = 40
ACCEL_RANGE_KMH = (3, 6)
CRUISE_JITTER_KMH = (-2, 2)

TRAFFIC_FACTOR_RANGE = (0.8, 1.2)
TRAFFIC_CHANGE_PROB = 0.05

RED_LIGHT_PROB = 0.05
RED_LIGHT_DECEL_KMH = (5, 10)
RED_LIGHT_STOP_SPEED_KMH = 5
RED_LIGHT_WAIT_SECONDS = (15, 60)

STATION_WAIT_SECONDS = (5, 15)


def passenger_probability(time):

    current_hour = time.hour
    if 6 <= current_hour < 8:
        return 1.00
    elif 8 <= current_hour < 12:
        return 0.95
    elif 12 <= current_hour < 15:
        return 0.80
    elif 15 <= current_hour < 18:
        return 0.75
    elif 18 <= current_hour < 21:
        return 0.60
    else:
        return 0.50

db = SessionLocal()

line_ids = [row[0] for row in db.query(Route.line_id).distinct().all()]

all_buses = db.query(Bus).all()
used_bus_ids: set = set()

buses = []

for line_id in line_ids:

    waypoints = load_route(
        db,
        line_id
    )

    if len(waypoints) < 2:
        continue

    own = [
        b for b in all_buses
        if b.line_id == line_id and b.id not in used_bus_ids
    ]
    chosen = own[:BUSES_PER_ROUTE]
    count = len(chosen)
    if count == 0:
        continue

    stations = load_stations(db, line_id)

    for i, bus_record in enumerate(chosen):

        used_bus_ids.add(bus_record.id)

        start_index = min((i * len(waypoints)) // count, len(waypoints) - 1)

        buses.append(
            {
                "bus_id": bus_record.id,
                "bus_name": bus_record.name,
                "line_id": line_id,
                "waypoints": waypoints,
                "stations": stations,
                "current_index": start_index,
                "current_speed": INITIAL_SPEED_KMH,
                "visited_stations": set(),
                "traffic_factor": random.uniform(*TRAFFIC_FACTOR_RANGE),
                "time": datetime.now(),
                "position": (
                    waypoints[start_index].lat,
                    waypoints[start_index].long
                ),
                "completed_routes": 0
            }
        )

while True:
    for bus in buses:
        if bus['current_speed'] < CRUISE_SPEED_KMH:
            bus['current_speed'] += random.uniform(*ACCEL_RANGE_KMH)
        else:
            bus['current_speed'] += random.uniform(*CRUISE_JITTER_KMH)

        if random.random() < TRAFFIC_CHANGE_PROB:
            bus['traffic_factor'] = random.uniform(*TRAFFIC_FACTOR_RANGE)

        speed = (
            bus['current_speed'] * bus['traffic_factor']
        )

        budget_m = (speed / 3.6) * STEP_SECONDS
        arrived = False

        while budget_m > 0:
            next_index = bus['current_index'] + 1
            target = (
                bus['waypoints'][next_index].lat,
                bus['waypoints'][next_index].long
            )
            seg = distance_m(bus['position'], target)

            if seg > budget_m:
                ratio = budget_m / seg
                bus['position'] = (
                    bus['position'][0] + (target[0] - bus['position'][0]) * ratio,
                    bus['position'][1] + (target[1] - bus['position'][1]) * ratio,
                )
                break

            bus['position'] = target
            budget_m -= seg
            bus['current_index'] = next_index
            arrived = True

            if bus['current_index'] >= len(bus['waypoints']) - 1:
                bus['completed_routes'] += 1
                print(
                    f"Bus {bus['bus_name']} completed "
                    f"{bus['completed_routes']} routes"
                )
                bus['current_index'] = 0
                bus['position'] = (
                    bus['waypoints'][0].lat,
                    bus['waypoints'][0].long
                )
                bus['visited_stations'].clear()
                bus['traffic_factor'] = random.uniform(*TRAFFIC_FACTOR_RANGE)
                break

        if random.random() < RED_LIGHT_PROB:
            print("Approaching red light...")
            bus['current_speed'] = max(bus['current_speed'] - random.uniform(*RED_LIGHT_DECEL_KMH), 0)

            if bus['current_speed'] < RED_LIGHT_STOP_SPEED_KMH:
                red_light_time = random.randint(*RED_LIGHT_WAIT_SECONDS)
                print(f"Red light. Waiting {red_light_time} seconds...")
                bus['time'] += timedelta(seconds=red_light_time)

        location = BusLocation(
            bus_id=bus['bus_id'],
            bus_name=bus['bus_name'],
            line_id=bus['line_id'],
            lat=bus['position'][0],
            lon=bus['position'][1],
            vel=speed,
            time=bus['time']
        )

        db.add(location)

        print(
            f"Line: {bus['line_id']} | "
            f"Bus: {bus['bus_name']} |"
            f"SimTime: {bus['time'].strftime('%H:%M:%S')} | "
            f"Speed: {round(speed,1)} km/h | "
            f"Arrived: {arrived}"
        )

        for station in bus['stations']:

            if station.station_id in bus['visited_stations']:
                continue

            if is_near_station(
                bus['position'],
                station
            ):

                print(
                    "Station ID:",
                    station.id
                )

                bus['visited_stations'].add(
                    station.station_id
                )

                has_passenger = (
                    random.random() < passenger_probability(bus['time'])
                )

                if has_passenger:
                    bus['current_speed'] = 0
                    wait_time = random.randint(*STATION_WAIT_SECONDS)
                    print(f"Station reached: {station.name}")
                    print(f"Waiting {wait_time} seconds...")
                    bus['time'] += timedelta(seconds=wait_time)

                else:
                    print(f"Station skipped: {station.name}")

        bus['time'] += timedelta(seconds=STEP_SECONDS)

    db.commit()
    time.sleep(LOOP_INTERVAL_SECONDS)
