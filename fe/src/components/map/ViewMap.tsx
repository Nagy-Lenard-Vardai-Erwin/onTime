import {
  Map,
  NavigationControl,
  Source,
  Layer,
  type MapLayerMouseEvent,
  type MarkerEvent,
  Marker,
  Popup,
} from "@vis.gl/react-maplibre";
import type { FeatureCollection, LineString } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Markers from "../markers/Markers";
import { useThemeContext } from "../contexts/ThemeContextProvider";
import type { BaseCoordinates } from "@/helpers/baseCoordinates";
import type { RouteData, Station } from "@/entities/route";
import axios from "axios";
import { BusStation } from "../station/BusStation";
import LiveBuses from "./LiveBuses";
import type { LiveBus } from "@/entities/liveBus";
import { Button } from "../shadcn/button";

export const MapView = {
  VIEW: "view",
  EDIT: "edit",
  CREATE: "create",
} as const;

export type MapViewMode = (typeof MapView)[keyof typeof MapView];

interface MapComponentProps {
  markerList?: BaseCoordinates[];
  routeData?: RouteData[];
  mode: MapViewMode;
  liveBuses?: LiveBus[];
  userLocation?: { lat: number; lon: number } | null;
  walkingRoute?: [number, number][];
  onSelectStation?: (station: Station) => void;
  onDeselectStation?: () => void;
  selectedStationId?: number | string | null;
  highlightBusId?: number;
}

const ViewMap = ({
  markerList,
  mode,
  routeData,
  liveBuses,
  userLocation,
  walkingRoute,
  onSelectStation,
  onDeselectStation,
  selectedStationId,
  highlightBusId,
}: MapComponentProps) => {
  const { t } = useTranslation();
  const bounds: [[number, number], [number, number]] = [
    [23.439274, 47.617155], // SW [lng, lat]
    [23.729459, 47.686301], // NE [lng, lat]
  ];
  const [route, setRoute] = useState<{ long: number; lat: number }[]>([]);

  const [selectedMarker, setSelectedMarker] = useState<BaseCoordinates[]>([]);
  const { theme } = useThemeContext();

  const [markers, setMarkers] = useState<BaseCoordinates[]>(markerList || []);
  const [coord, setCoord] = useState<BaseCoordinates[]>([]);

  const [selectedBus, setSelectedBus] = useState<LiveBus | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const closeCards = () => {
    setSelectedBus(null);
    setSelectedStation(null);
  };

  const snapLastSegmentToRoad = async () => {
    if (coord.length < 2) return;

    const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY;

    const lastTwo = coord.slice(-2);

    const waypoints = lastTwo.map((c) => `${c.lat},${c.long}`).join("|");

    const response = await axios.get(
      `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=drive&apiKey=${GEOAPIFY_KEY}`,
    );

    const geometry = response.data.features?.[0]?.geometry;

    if (!geometry) return;

    const coords: [number, number][] = geometry.coordinates.flat();

    const newSegment = coords.map((r) => ({
      lat: r[1],
      long: r[0],
      isMarker: true,
    }));

    setRoute((prev) => {
      if (prev.length === 0) return newSegment;

      return [...prev, ...newSegment.slice(1)];
    });
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      snapLastSegmentToRoad();
    }, 400);

    return () => clearTimeout(timeout);
  }, [coord.length]);

  const addMarker = (e: MapLayerMouseEvent) => {
    if (mode === MapView.VIEW) return;

    const { lat, lng } = e.lngLat;

    const newMarker: BaseCoordinates = {
      lat: lat,
      long: lng,
      order_index: markers.length,
    };

    setCoord((prev) => [...prev, newMarker]);
  };

  const handleMapClick = (e: MapLayerMouseEvent) => {
    closeCards();
    addMarker(e);
  };

  const handleMarkerDragEnd = (
    oldMarker: BaseCoordinates,
    newCoords: { lat: number; lng: number },
  ) => {
    setMarkers((prev) =>
      prev.map((m) =>
        m.lat === oldMarker.lat && m.long === oldMarker.long
          ? {
              lat: newCoords.lat,
              long: newCoords.lng,
              order_index: m.order_index,
            }
          : m,
      ),
    );
  };

  const handleOpenedMarkers = (
    e: MarkerEvent<MouseEvent>,
    marker: BaseCoordinates,
  ) => {
    e.originalEvent.stopPropagation();
    setSelectedMarker((prev) => {
      const exists = prev.some(
        (m) => m.lat === marker.lat && m.long === marker.long,
      );
      if (exists) {
        return prev.filter(
          (m) => m.lat !== marker.lat || m.long !== marker.long,
        );
      }
      return [...prev, marker];
    });
  };

  function renderRoute(route: { long: number; lat: number }[]) {
    if (route.length < 1) return;

    const geojson: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: route.map((m) => [Number(m.long), Number(m.lat)]),
          },
          properties: {},
        },
      ],
    };

    return (
      <Source
        key={JSON.stringify(route)}
        id={"1"}
        type="geojson"
        data={geojson}
      >
        <Layer
          id={"2"}
          type="line"
          paint={{
            "line-color": "red",
            "line-width": 4,
          }}
        />
      </Source>
    );
  }

  return (
    <Map
      mapStyle={
        theme === "light"
          ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      }
      initialViewState={{
        latitude: 47.657,
        longitude: 23.578,
        zoom: 12,
      }}
      minZoom={12}
      maxZoom={18}
      maxBounds={bounds}
      onClick={handleMapClick}
      style={{ width: "100%", height: "100%" }}
    >
      <NavigationControl position="bottom-right" />
      <Markers
        markers={markers}
        handleMarkers={handleOpenedMarkers}
        selectedMarkers={selectedMarker}
        onDragEnd={handleMarkerDragEnd}
        mode={mode}
      />
      {routeData?.map((route) =>
        route.stations.map((station) => (
          <BusStation
            station={station}
            key={station.id}
            isSelected={String(selectedStationId) === String(station.id)}
            onClick={(s) => {
              setSelectedBus(null);
              setSelectedStation(s);
            }}
          />
        )),
      )}
      <LiveBuses
        buses={liveBuses}
        highlightBusId={highlightBusId}
        onBusClick={(bus) => {
          setSelectedStation(null);
          setSelectedBus(bus);
        }}
      />

      {selectedBus && (
        <Popup
          latitude={selectedBus.lat}
          longitude={selectedBus.lon}
          anchor="bottom"
          offset={18}
          closeButton={false}
          closeOnClick={false}
          onClose={() => setSelectedBus(null)}
        >
          <div className="flex flex-col items-center text-center">
            <span className="text-base font-semibold">
              {selectedBus.bus_name}
            </span>
          </div>
        </Popup>
      )}

      {selectedStation && (
        <Popup
          latitude={selectedStation.lat}
          longitude={selectedStation.long}
          anchor="bottom"
          offset={22}
          closeButton={false}
          closeOnClick={false}
          onClose={() => setSelectedStation(null)}
          style={{ padding: "2px" }}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-xl text-semibold">
              {selectedStation.name}
            </span>
            {onSelectStation &&
              (String(selectedStationId) === String(selectedStation.id) ? (
                <Button
                  size="sm"
                  className="bg-background text-foreground border border-border hover:opacity-90"
                  onClick={() => {
                    onDeselectStation?.();
                    setSelectedStation(null);
                  }}
                >
                  {t("home.deselect")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-background text-foreground border border-border hover:opacity-90"
                  onClick={() => {
                    onSelectStation(selectedStation);
                    setSelectedStation(null);
                  }}
                >
                  {t("home.select")}
                </Button>
              ))}
          </div>
        </Popup>
      )}

      {userLocation && (
        <Marker latitude={userLocation.lat} longitude={userLocation.lon}>
          {/* "You are here": a teal-blue dot (bus colour) with a yellow pulsing
              ring (same animation as the live-buses indicator) so it stands out
              on the map. */}
          <span className="relative flex size-5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f59e0b] opacity-75" />
            <span className="relative inline-flex size-5 rounded-full border-2 border-white bg-[#00c2cb]" />
          </span>
        </Marker>
      )}

      {walkingRoute && walkingRoute.length > 1 && (
        <Source
          id="walking-route"
          type="geojson"
          data={{
            type: "Feature",
            geometry: { type: "LineString", coordinates: walkingRoute },
            properties: {},
          }}
        >
          <Layer
            id="walking-route-line"
            type="line"
            paint={{
              "line-color": "#00c2cb",
              "line-width": 5,
              "line-dasharray": [1, 1.5],
            }}
          />
        </Source>
      )}

      {coord.map((item, i) => {
        return (
          <Marker
            key={i}
            latitude={item.lat}
            longitude={item.long}
            color="red"
          ></Marker>
        );
      })}
      {renderRoute(route)}
      {routeData?.map((item) => {
        const geojson: FeatureCollection<LineString> = {
          type: "FeatureCollection",
          features:
            item.routes?.length > 1
              ? [
                  {
                    type: "Feature",
                    geometry: {
                      type: "LineString",
                      coordinates: item.routes.map((m) => [
                        Number(m.long),
                        Number(m.lat),
                      ]),
                    },
                    properties: {},
                  },
                ]
              : [],
        };

        const sourceId = `route-${item.id}`;
        const layerId = `route-line-${item.id}`;

        return (
          <Source key={sourceId} id={sourceId} type="geojson" data={geojson}>
            <Layer
              id={layerId}
              type="line"
              paint={{
                "line-color": "red",
                "line-width": 4,
              }}
            />
          </Source>
        );
      })}
    </Map>
  );
};

export default ViewMap;
