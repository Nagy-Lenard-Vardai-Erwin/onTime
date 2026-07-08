import os

from data_loader import load_bus_locations
from cleaning import clean_data

from route_analysis import (
    trips_per_route,
    buses_per_route,
    busiest_route,
    least_used_route
)

from data_loader import (
    load_bus_locations
)

from speed_analysis import (
    speed_statistics,
    speed_by_route,
    speed_by_hour,
    speed_by_bus,
    fastest_bus,
    slowest_bus
)

from distance_analysis import (
    total_system_distance,
    total_distance_per_bus,
    total_distance_per_route,
    top_10_buses_by_distance,
    most_active_bus,
    top_10_active_buses
)

from visualization import (
    route_usage_chart,
    speed_distribution,
    speed_by_route_chart,
    speed_by_hour_chart,
    distance_by_route_chart,
    distance_by_bus_chart,
    top_10_buses_chart,
    congestion_chart,
    route_comparison_chart,
    activity_by_hour_chart,
    activity_by_weekday_chart,
    route_activity_share_chart,
    speed_by_period_chart,
    top_active_buses_chart,
    speed_by_bus_chart,
    speed_boxplot,
    speed_percentiles_chart,
    active_buses_by_hour_chart,
    records_per_day_chart
)

from temporal_analysis import (
    activity_by_hour,
    activity_by_weekday,
    busiest_hour,
    active_buses_by_hour,
    trips_by_hour,
    peak_traffic_windows,
    records_per_day,
    route_activity_share,
    quietest_hour,
    speed_by_period
)

os.makedirs(
    "exports",
    exist_ok=True
)

print("\nLoading data...\n")

df = load_bus_locations()

df = clean_data(df)

print(
    f"Dataset loaded successfully: "
    f"{len(df):,} records"
)

routes_df = trips_per_route(df)

buses_per_route_df = buses_per_route(df)

speed_stats = speed_statistics(df)

speed_route_df = speed_by_route(df)

speed_hour_df = speed_by_hour(df)

distance_route_df = total_distance_per_route(df)

distance_bus_df = total_distance_per_bus(df)

top10_bus_df = top_10_buses_by_distance(df)

activity_hour_df = activity_by_hour(df)

activity_weekday_df = activity_by_weekday(df)

busiest_hour_result = busiest_hour(df)

active_buses_hour_df = active_buses_by_hour(df)

trips_hour_df = trips_by_hour(df)

peak_windows_df = peak_traffic_windows(df)

records_day_df = records_per_day(df)

route_share_df = route_activity_share(df)

speed_bus_df = speed_by_bus(df)

fastest_bus_df = fastest_bus(df)

slowest_bus_df = slowest_bus(df)

most_active_bus_df = most_active_bus(df)

top_active_buses_df = top_10_active_buses(df)

busiest_route_df = busiest_route(df)

least_used_route_df = least_used_route(df)

quietest_hour_df = quietest_hour(df)

speed_period_df = speed_by_period(df)

print("\n========== ROUTE ANALYSIS ==========\n")

print(routes_df)

print("\n========== BUSES PER ROUTE ==========\n")

print(buses_per_route_df)

print("\n========== BUSIEST ROUTE ==========\n")

print(busiest_route_df)

print("\n========== LEAST USED ROUTE ==========\n")

print(least_used_route_df)

print("\n========== SPEED STATISTICS ==========\n")

print(speed_stats)

print("\n========== SPEED BY ROUTE ==========\n")

print(speed_route_df)

print("\n========== SPEED BY HOUR ==========\n")

print(speed_hour_df)

print("\n========== SPEED BY BUS ==========\n")

print(speed_bus_df)

print("\n========== FASTEST BUS ==========\n")

print(fastest_bus_df)

print("\n========== SLOWEST BUS ==========\n")

print(slowest_bus_df)

print("\n========== DISTANCE ANALYSIS ==========\n")

print(
    f"Total system distance: "
    f"{total_system_distance(df):.2f} km"
)

print("\n========== DISTANCE BY ROUTE ==========\n")

print(distance_route_df)

print("\n========== DISTANCE BY BUS ==========\n")

print(distance_bus_df)

print("\n========== TOP 10 BUSES BY DISTANCE ==========\n")

print(top10_bus_df)

print("\n========== MOST ACTIVE BUS ==========\n")

print(most_active_bus_df)

print("\n========== TOP 10 ACTIVE BUSES ==========\n")

print(top_active_buses_df)

print("\n========== ACTIVITY BY HOUR ==========\n")

print(activity_hour_df)

print("\n========== ACTIVITY BY WEEKDAY ==========\n")

print(activity_weekday_df)

print("\n========== BUSIEST HOUR ==========\n")

print(busiest_hour_result)

print("\n========== ACTIVE BUSES BY HOUR ==========\n")

print(active_buses_hour_df)

print("\n========== TRIPS BY HOUR ==========\n")

print(trips_hour_df)

print("\n========== PEAK TRAFFIC WINDOWS ==========\n")

print(peak_windows_df)

print("\n========== RECORDS PER DAY ==========\n")

print(records_day_df)

print("\n========== ROUTE ACTIVITY SHARE ==========\n")

print(route_share_df)

print("\n========== QUIETEST HOUR ==========\n")

print(quietest_hour_df)

print("\n========== SPEED BY PERIOD ==========\n")

print(speed_period_df)

print("\nGenerating charts...\n")

route_usage_chart(routes_df)

route_comparison_chart(routes_df)

speed_distribution(df)

speed_by_route_chart(
    speed_route_df
)

speed_by_hour_chart(
    speed_hour_df
)

distance_by_route_chart(
    distance_route_df
)

distance_by_bus_chart(
    distance_bus_df
)

top_10_buses_chart(
    top10_bus_df
)

congestion_chart(df)

activity_by_hour_chart(
    activity_hour_df
)

activity_by_weekday_chart(
    activity_weekday_df
)

active_buses_by_hour_chart(
    active_buses_hour_df
)

records_per_day_chart(
    records_day_df
)

route_activity_share_chart(
    route_share_df
)

speed_by_period_chart(
    speed_period_df
)

top_active_buses_chart(
    top_active_buses_df
)

speed_by_bus_chart(
    speed_bus_df
)

speed_boxplot(df)

speed_percentiles_chart(df)

print(
    "\nCharts generated successfully "
    "inside exports/ folder."
)

print("\n========== SUMMARY ==========\n")

print(
    f"Routes analyzed: "
    f"{df['line_id'].nunique()}"
)

print(
    f"Buses analyzed: "
    f"{df['bus_id'].nunique()}"
)

print(
    f"Total records: "
    f"{len(df):,}"
)

print(
    f"Total distance travelled: "
    f"{total_system_distance(df):.2f} km"
)

print("\nAnalytics completed successfully.\n")