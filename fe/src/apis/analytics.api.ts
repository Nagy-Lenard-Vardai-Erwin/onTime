import { axiosInstance, request } from "@/apiConfig";
import type { AnalyticsOverview } from "@/entities/analytics";

const analyticsApi = {
  OVERVIEW: "/analytics/overview",
  DOWNLOAD: (metric: string) => `/analytics/download/${metric}`,
} as const;

export const getAnalyticsOverview = async () =>
  request<AnalyticsOverview>("get", analyticsApi.OVERVIEW, undefined, true);

export const downloadMetricCsv = async (metric: string, filename: string) => {
  const response = await axiosInstance.get(analyticsApi.DOWNLOAD(metric), {
    withCredentials: true,
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};
