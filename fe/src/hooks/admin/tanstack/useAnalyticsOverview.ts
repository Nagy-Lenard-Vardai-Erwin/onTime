import { getAnalyticsOverview } from "@/apis/analytics.api";
import type { AnalyticsOverview } from "@/entities/analytics";
import { queryKeys } from "@/entities/enums/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const useAnalyticsOverview = () => {
  return useQuery<AnalyticsOverview, Error>({
    queryKey: [queryKeys.ANALYTICS, "overview"],
    queryFn: () => getAnalyticsOverview(),
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    gcTime: 30 * 60 * 1000,
  });
};

export default useAnalyticsOverview;
