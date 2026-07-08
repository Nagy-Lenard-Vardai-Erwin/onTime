import axios from "axios";

export type LatLng = { lat: number; lon: number };

export type WalkingRoute = {
  coordinates: [number, number][];
  durationSec: number | null;
  distanceM: number | null;
};

export const getWalkingRoute = async (
  from: LatLng,
  to: LatLng,
): Promise<WalkingRoute> => {
  const key = import.meta.env.VITE_GEOAPIFY_KEY;
  const waypoints = `${from.lat},${from.lon}|${to.lat},${to.lon}`;

  const response = await axios.get(
    `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=walk&apiKey=${key}`,
  );

  const feature = response.data.features?.[0];
  const geometry = feature?.geometry;
  if (!geometry) return { coordinates: [], durationSec: null, distanceM: null };

  const coordinates: [number, number][] =
    geometry.type === "MultiLineString"
      ? geometry.coordinates.flat()
      : geometry.coordinates;

  return {
    coordinates,
    durationSec: feature?.properties?.time ?? null,
    distanceM: feature?.properties?.distance ?? null,
  };
};
