import {
  getWalkingRoute,
  type LatLng,
  type WalkingRoute,
} from "@/apis/geoapify.api";
import { useQuery } from "@tanstack/react-query";

const round = (n: number) => Math.round(n * 1e5) / 1e5;

const useWalkingRoute = (from?: LatLng | null, to?: LatLng | null) => {
  return useQuery<WalkingRoute, Error>({
    queryKey: [
      "walkingRoute",
      from ? round(from.lat) : null,
      from ? round(from.lon) : null,
      to?.lat,
      to?.lon,
    ],
    queryFn: () => getWalkingRoute(from!, to!),
    enabled: Boolean(from && to),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
};

export default useWalkingRoute;
