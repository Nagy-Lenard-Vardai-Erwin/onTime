import { request } from "@/apiConfig";
import type { Line } from "@/entities/line";
import type {
  CreateStationPayload,
  RouteFilters,
  StationsResponse,
} from "@/entities/route";
import { buildQueryParams } from "@/helpers/buildQueryParams";

const adminApi = {
  LINE: "/line",
  GET_LINE_DETAILS: (id: string) => `/line/${id}`,
  GET_STATION_DETAILS: (id: string) => `/station/${id}`,
  ROUTE: "/route",
  ROUTE_ID: (id: string) => `/route/${id}`,
  STATIONS: "/stations",
  STATION_ID: (id: string | number) => `/stations/${id}`,
} as const;

const urls = {
  getLines: adminApi.LINE,
};

export const getLines = async (): Promise<Line[]> => {
  const data = await request<Line[]>("get", urls.getLines, undefined, true);
  if (!Array.isArray(data)) {
    throw new Error("Unexpected /line response");
  }
  return data;
};

export const getLineDetails = async (id: string) => {
  return await request("get", adminApi.GET_LINE_DETAILS(id), undefined, true);
};

export const getRouteDetails = async (filters: RouteFilters) => {
  return await request(
    "get",
    adminApi.ROUTE,
    undefined,
    true,
    buildQueryParams(filters),
  );
};

export const getStationDetails = async (id: string) => {
  return await request(
    "get",
    adminApi.GET_STATION_DETAILS(id),
    undefined,
    true,
  );
};

export const createLine = async (line_name: string) => {
  return await request("post", adminApi.LINE, { name: line_name }, true);
};

export const deleteLine = async (id: string | number) => {
  return await request(
    "delete",
    adminApi.GET_LINE_DETAILS(String(id)),
    undefined,
    true,
  );
};

export const createRoute = async ({ lineId, routeData }: { lineId: string; routeData: any }) => {
  return await request("post", adminApi.ROUTE_ID(lineId), routeData, true);
};

export const deleteRoute = async (id: string) => {
  return await request("delete", adminApi.ROUTE_ID(id), undefined, true);
};

export const getStations = async () => {
  return await request<StationsResponse>(
    "get",
    adminApi.STATIONS,
    undefined,
    true,
  );
};

export const createStation = async (payload: CreateStationPayload) => {
  return await request<StationsResponse>(
    "post",
    adminApi.STATIONS,
    payload,
    true,
  );
};

export const updateStation = async ({
  id,
  payload,
}: {
  id: string | number;
  payload: Partial<CreateStationPayload>;
}) => {
  return await request<StationsResponse>(
    "put",
    adminApi.STATION_ID(id),
    payload,
    true,
  );
};

export const deleteStation = async (id: string | number) => {
  return await request("delete", adminApi.STATION_ID(id), undefined, true);
};