import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
import time
from datetime import datetime, timedelta
from db import SessionLocal
from simulation.movement import move_toward
from models.db_schemas.BusLocation import BusLocation
import random
from simulation.route_loader import load_route, load_stations
from simulation.station_logic import is_near_station
from models.db_schemas.Bus import Bus

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
line_ids = [8, 13, 40, 50, 54]

buses = []

for line_id in line_ids:

    db_buses = db.query(
        Bus
    ).filter(
        Bus.line_id == line_id
    ).all()

    waypoints = load_route(
        db,
        line_id
    )

    for bus_record, start_index in zip(db_buses, [0, 25, 50, 75, 100]):

        if start_index >= len(waypoints):
            continue

        buses.append(
            {
                "bus_id": bus_record.id,
                "bus_name": bus_record.name,
                "line_id": line_id,
                "waypoints": waypoints,
                "stations": load_stations(
                    db,
                    line_id
                ),
                "current_index": start_index,
                "current_speed": 0,
                "visited_stations": set(),
                "traffic_factor": random.uniform(
                    0.8,
                    1.2
                ),
                "time": datetime(2026,6,1,6,0,0),
                "position": (
                    waypoints[start_index].lat,
                    waypoints[start_index].long
                ),
                "completed_routes": 0
            }
        )

while any(bus['completed_routes'] < 3 for bus in buses):
    for bus in buses:
        if bus['completed_routes'] >= 3:
                    continue
        if bus['current_speed'] < 40:
            bus['current_speed'] += random.uniform(1,3)
        else:
            bus['current_speed'] += random.uniform(-2,2)
                
        if random.random() < 0.05:
            bus['traffic_factor'] = random.uniform(
                0.8,
                1.2
            )

        speed = (
            bus['current_speed'] * bus['traffic_factor']
        )
        
        target = (
            bus['waypoints'][bus['current_index']+1].lat,
            bus['waypoints'][bus['current_index']+1].long
        )

        new_position, arrived = move_toward(
            bus['position'],
            target,
            speed,
            5
        )
        
        bus['position']=new_position

        if random.random() < 0.05:
            print("Approaching red light...")
            bus['current_speed'] = max(bus['current_speed'] - random.uniform(5,10),0)
            
            if bus['current_speed'] < 5:
                red_light_time = random.randint(15,60)
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
        db.commit()
        
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
                    wait_time = random.randint(5,15)
                    print(f"Station reached: {station.name}")
                    print(f"Waiting {wait_time} seconds...")
                    bus['time'] += timedelta(seconds=wait_time)
                    
                else:
                    print(f"Station skipped: {station.name}")
            
        

        
        if arrived:
            bus['current_index'] += 1
            print(
                f"Waypoint {bus['current_index']} reached"
            )
            
            if bus['current_index'] >= len(bus['waypoints'])-1:
                bus['completed_routes'] += 1
                print(
                    f"Line {bus['line_id']} "
                    f"Bus {bus['bus_name']} "
                    f"Completed routes: {bus['completed_routes']}"
                )
                print(
                    f"Bus {bus['bus_name']} completed "
                    f"{bus['completed_routes']}/3 routes"
                )

                if bus['completed_routes'] >= 3:
                    print(
                        f"Bus {bus['bus_name']} finished all routes."
                    )
                    continue
                

                bus['current_index'] = 0

                bus['position'] = (
                    bus['waypoints'][0].lat,
                    bus['waypoints'][0].long
                )

                bus['visited_stations'].clear()

                bus['current_speed'] = 0
                
                bus['traffic_factor'] = random.uniform(
                    0.8,
                    1.2
                )
                
        bus['time'] += timedelta(
            seconds=5
        )