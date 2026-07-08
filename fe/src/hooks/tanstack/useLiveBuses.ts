import { getLiveBuses } from "@/apis/simulation.api";
import type { LiveBus } from "@/entities/liveBus";
import { useQuery } from "@tanstack/react-query";

const LIVE_MAX_AGE_SECONDS = 120;

const useLiveBuses = (lineId?: number, onlyFresh = false) => {
  return useQuery<LiveBus[], Error>({
    queryKey: ["liveBuses", lineId, onlyFresh],
    queryFn: () =>
      getLiveBuses(lineId!, onlyFresh ? LIVE_MAX_AGE_SECONDS : undefined),
    enabled: Boolean(lineId),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
};

export default useLiveBuses;
