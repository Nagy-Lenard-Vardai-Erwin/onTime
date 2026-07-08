import { getClosestBus } from "@/apis/simulation.api";
import type { ClosestBusResponse } from "@/entities/liveBus";
import { useQuery } from "@tanstack/react-query";

const LIVE_MAX_AGE_SECONDS = 120;

const useClosestBus = (
  lineId?: number,
  stationId?: number,
  onlyFresh = false,
  enabled = true,
) => {
  return useQuery<ClosestBusResponse, Error>({
    queryKey: ["closestBus", lineId, stationId, onlyFresh],
    queryFn: () =>
      getClosestBus(
        lineId!,
        stationId!,
        onlyFresh ? LIVE_MAX_AGE_SECONDS : undefined,
      ),
    enabled: Boolean(lineId && stationId) && enabled,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
};

export default useClosestBus;
