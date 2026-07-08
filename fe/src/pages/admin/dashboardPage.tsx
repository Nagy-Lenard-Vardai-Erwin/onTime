import {
  Activity,
  Bus,
  Gauge,
  RefreshCw,
  Route as RouteIcon,
  Waypoints,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import ChartCard from "@/components/dashboard/ChartCard";
import StatCard from "@/components/dashboard/StatCard";
import PageLoader from "@/components/loaders/PageLoader";
import { Button } from "@/components/shadcn/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/shadcn/chart";
import useAnalyticsOverview from "@/hooks/admin/tanstack/useAnalyticsOverview";
import useErrorMessage from "@/hooks/admin/useFetchSideEffects";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const chartClass = "aspect-auto h-[280px] w-full";
const axisTick = { fontSize: 12 };

const DashboardPage = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch, isFetching } =
    useAnalyticsOverview();

  useErrorMessage({ isError, error });

  if (isLoading) return <PageLoader />;
  if (!data) return null;

  const { summary, metrics } = data;

  if (summary.records === 0) {
    return (
      <div className="grid place-items-center p-12 text-2xl text-muted-foreground">
        {t("dashboard.noData")}
      </div>
    );
  }

  const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

  const shareConfig = Object.fromEntries(
    metrics.route_activity_share.map((item) => [
      item.line_name,
      { label: item.line_name },
    ]),
  ) satisfies ChartConfig;

  return (
    <div className="grid gap-6 p-6">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          className="text-lg"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`!size-4 ${isFetching ? "animate-spin" : ""}`} />
          {t("dashboard.refresh")}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          label={t("dashboard.routes")}
          value={summary.routes}
          icon={RouteIcon}
          hint={
            summary.busiest_route
              ? t("dashboard.busiestRouteHint", {
                  name: summary.busiest_route.line_name,
                })
              : undefined
          }
        />
        <StatCard
          label={t("dashboard.buses")}
          value={summary.buses}
          icon={Bus}
          hint={
            summary.fastest_bus
              ? t("dashboard.fastestBusHint", {
                  name: summary.fastest_bus.bus_name,
                })
              : undefined
          }
        />
        <StatCard
          label={t("dashboard.gpsRecords")}
          value={summary.records.toLocaleString()}
          icon={Activity}
          hint={
            summary.busiest_hour
              ? t("dashboard.busiestHourHint", {
                  hour: hourLabel(summary.busiest_hour.hour),
                })
              : undefined
          }
        />
        <StatCard
          label={t("dashboard.totalDistance")}
          value={`${summary.total_distance_km.toLocaleString()} km`}
          icon={Waypoints}
        />
        <StatCard
          label={t("dashboard.avgSpeed")}
          value={`${summary.avg_speed} km/h`}
          icon={Gauge}
          hint={t("dashboard.maxSpeedHint", { value: summary.max_speed })}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 2xl:grid-cols-2">
        <ChartCard
          title={t("dashboard.routeUsage")}
          description={t("dashboard.routeUsageDesc")}
          metricKey="route_usage"
        >
          <ChartContainer
            config={
              {
                records: {
                  label: t("dashboard.records"),
                  color: CHART_COLORS[0],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <BarChart data={metrics.route_usage}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="line_name" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="records" fill="var(--color-records)" radius={6} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.routeShare")}
          description={t("dashboard.routeShareDesc")}
          metricKey="route_activity_share"
        >
          <ChartContainer
            config={shareConfig}
            className={`${chartClass} [&_.recharts-pie-label-text]:fill-foreground`}
          >
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="line_name"
                    hideLabel
                    formatter={(value, name) => (
                      <span className="text-muted-foreground">
                        {name}: {Number(value).toFixed(1)}%
                      </span>
                    )}
                  />
                }
              />
              <Pie
                data={metrics.route_activity_share}
                dataKey="percentage"
                nameKey="line_name"
                outerRadius={100}
              >
                {metrics.route_activity_share.map((_, index) => (
                  <Cell
                    key={index}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="line_name" />}
                className="flex-wrap gap-2"
              />
            </PieChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.activityByHour")}
          description={t("dashboard.activityByHourDesc")}
          metricKey="activity_by_hour"
        >
          <ChartContainer
            config={
              {
                records: {
                  label: t("dashboard.records"),
                  color: CHART_COLORS[1],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <AreaChart data={metrics.activity_by_hour}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={hourLabel}
              />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(_, payload) => hourLabel(Number(payload?.[0]?.payload?.hour))} />}
              />
              <Area
                dataKey="records"
                type="monotone"
                stroke="var(--color-records)"
                fill="var(--color-records)"
                fillOpacity={0.25}
              />
            </AreaChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.activityByWeekday")}
          description={t("dashboard.activityByWeekdayDesc")}
          metricKey="activity_by_weekday"
        >
          <ChartContainer
            config={
              {
                records: {
                  label: t("dashboard.records"),
                  color: CHART_COLORS[2],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <BarChart data={metrics.activity_by_weekday}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="weekday" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="records" fill="var(--color-records)" radius={6} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.speedByRoute")}
          description={t("dashboard.speedByRouteDesc")}
          metricKey="speed_by_route"
        >
          <ChartContainer
            config={
              {
                avg_speed: {
                  label: t("dashboard.avgSpeed"),
                  color: CHART_COLORS[3],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <BarChart data={metrics.speed_by_route}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="line_name" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="avg_speed" fill="var(--color-avg_speed)" radius={6} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.speedByHour")}
          description={t("dashboard.speedByHourDesc")}
          metricKey="speed_by_hour"
        >
          <ChartContainer
            config={
              {
                avg_speed: {
                  label: t("dashboard.avgSpeed"),
                  color: CHART_COLORS[4],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <LineChart data={metrics.speed_by_hour}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={hourLabel}
              />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(_, payload) => hourLabel(Number(payload?.[0]?.payload?.hour))} />}
              />
              <Line
                dataKey="avg_speed"
                type="monotone"
                stroke="var(--color-avg_speed)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.speedByPeriod")}
          description={t("dashboard.speedByPeriodDesc")}
          metricKey="speed_by_period"
        >
          <ChartContainer
            config={
              {
                avg_speed: {
                  label: t("dashboard.avgSpeed"),
                  color: CHART_COLORS[0],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <BarChart data={metrics.speed_by_period}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="avg_speed" fill="var(--color-avg_speed)" radius={6} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.activeBusesByHour")}
          description={t("dashboard.activeBusesByHourDesc")}
          metricKey="active_buses_by_hour"
        >
          <ChartContainer
            config={
              {
                active_buses: {
                  label: t("dashboard.activeBuses"),
                  color: CHART_COLORS[1],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <LineChart data={metrics.active_buses_by_hour}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={hourLabel}
              />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} allowDecimals={false} />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(_, payload) => hourLabel(Number(payload?.[0]?.payload?.hour))} />}
              />
              <Line
                dataKey="active_buses"
                type="monotone"
                stroke="var(--color-active_buses)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.distanceByRoute")}
          description={t("dashboard.distanceByRouteDesc")}
          metricKey="distance_by_route"
        >
          <ChartContainer
            config={
              {
                distance_km: {
                  label: t("dashboard.distanceKm"),
                  color: CHART_COLORS[2],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <BarChart data={metrics.distance_by_route}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="line_name" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} width={56} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="distance_km" fill="var(--color-distance_km)" radius={6} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.busesPerRoute")}
          description={t("dashboard.busesPerRouteDesc")}
          metricKey="buses_per_route"
        >
          <ChartContainer
            config={
              {
                bus_count: {
                  label: t("dashboard.buses"),
                  color: CHART_COLORS[3],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <BarChart data={metrics.buses_per_route}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="line_name" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis tickLine={false} axisLine={false} tick={axisTick} width={48} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="bus_count" fill="var(--color-bus_count)" radius={6} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.topBusesByDistance")}
          description={t("dashboard.topBusesByDistanceDesc")}
          metricKey="top_buses_by_distance"
        >
          <ChartContainer
            config={
              {
                distance_km: {
                  label: t("dashboard.distanceKm"),
                  color: CHART_COLORS[4],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <BarChart data={metrics.top_buses_by_distance} layout="vertical">
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis
                type="category"
                dataKey="bus_name"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={90}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="distance_km" fill="var(--color-distance_km)" radius={6} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.topActiveBuses")}
          description={t("dashboard.topActiveBusesDesc")}
          metricKey="top_active_buses"
        >
          <ChartContainer
            config={
              {
                records: {
                  label: t("dashboard.records"),
                  color: CHART_COLORS[0],
                },
              } satisfies ChartConfig
            }
            className={chartClass}
          >
            <BarChart data={metrics.top_active_buses} layout="vertical">
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis
                type="category"
                dataKey="bus_name"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={90}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="records" fill="var(--color-records)" radius={6} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

      </div>
    </div>
  );
};

export default DashboardPage;
