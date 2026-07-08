import { Source, Layer, type MapLayerMouseEvent } from "@vis.gl/react-maplibre";
import type { FeatureCollection, LineString } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BaseCoordinates } from "@/helpers/baseCoordinates";
import { useEffect, useMemo, useRef, useState } from "react";
import useCreateRoute from "@/hooks/admin/tanstack/useCreateRoute";
import { Button } from "../shadcn/button";
import axios from "axios";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import useRoute from "@/hooks/admin/tanstack/useRoute";
import type { RouteUpdateType, Station } from "@/entities/route";
import { BusStation } from "../station/BusStation";
import { Waypoint } from "../waypoint/Waypoint";
import BaseMap from "./BaseMap";
import {
  MapEditModeEnum,
  useMapEditorContext,
} from "../contexts/mapEditorContext";

const ManageMap = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { id } = useParams();

  const [waypoints, setWaypoints] = useState<BaseCoordinates[]>([]);
  const [coord, setCoord] = useState<BaseCoordinates[]>([]);
  const [stations, setStations] = useState<Station[]>([]);

  const {
    justClosed,
    setJustClosed,
    mode,
    setMode,
    selectedWaypoint,
    setSelectedWaypoint,
  } = useMapEditorContext();

  const routeUpdateTypeRef = useRef<RouteUpdateType>("append");

  const initialLoadDone = useRef(false);

  const setUpdate = (type: RouteUpdateType) => {
    routeUpdateTypeRef.current = type;
  };

  const isEdit = useMemo(() => location.pathname.includes("/edit"), []);

  const isInsertionMode =
    mode === MapEditModeEnum.InsertBefore ||
    mode === MapEditModeEnum.InsertAfter;
  const isDeleteNode = mode === MapEditModeEnum.Delete;

  const {
    data,
    // isLoading,
    // isError,
    // error
  } = useRoute({ line_ids: [id!] });

  useEffect(() => {
    const routeData = data?.response?.[0];
    if (!isEdit || !routeData) return;

    initialLoadDone.current = false;
    setCoord(routeData.routes);
    setStations(routeData.stations);
    setWaypoints(routeData.waypoints);
  }, [data?.response, isEdit]);

  const { mutateAsync: createRoute } = useCreateRoute();

  const handleCreateRoute = async (
    coord: BaseCoordinates[],
    waypoints: BaseCoordinates[],
  ) => {
    const lineId = Number(id);
    const routeData = {
      routes: coord.map((p, i) => ({
        lat: p.lat,
        long: p.long,
        line_id: lineId,
        order_index: i,
      })),
      waypoints: waypoints.map((w, i) => ({
        lat: w.lat,
        long: w.long,
        line_id: lineId,
        order_index: i,
      })),
    };
    try {
      await createRoute({ lineId: id!, routeData });
      toast.success(
        t(isEdit ? "routesPage.routeUpdated" : "routesPage.routeCreated"),
      );
    } catch (err: any) {
      toast.warning(t(err?.message ?? err));
    }
  };

  const handleInsertWaypoint = (e: MapLayerMouseEvent) => {
    const { lat, lng } = e.lngLat;

    if (isInsertionMode) {
      if (!selectedWaypoint) return;

      const selectedIndex = waypoints.findIndex(
        (w) =>
          w.lat === selectedWaypoint?.lat && w.long === selectedWaypoint?.long,
      );
      if (selectedIndex === -1) return;

      const insertIndex =
        mode === MapEditModeEnum.InsertBefore
          ? selectedIndex
          : selectedIndex + 1;

      const newMarker = {
        lat,
        long: lng,
        line_id: selectedWaypoint.line_id,
        order_index: insertIndex,
      };
      setUpdate("full");
      setWaypoints((prev) => {
        const newWaypoints = [...prev];
        newWaypoints.splice(insertIndex, 0, newMarker);

        return newWaypoints.map((w, i) => ({
          ...w,
          order_index: i,
        }));
      });
      setMode(MapEditModeEnum.Idle);
      return;
    }

    if (mode !== MapEditModeEnum.Idle) {
      setMode(MapEditModeEnum.Idle);
      return;
    }

    addMarker(e);
  };

  const addMarker = (e: MapLayerMouseEvent) => {
    if (justClosed) {
      setJustClosed(false);
      return;
    }

    if (isInsertionMode) setMode(MapEditModeEnum.Idle);

    setUpdate("append");

    const { lat, lng } = e.lngLat;

    const newMarker: BaseCoordinates = {
      lat: lat,
      long: lng,
      order_index: waypoints.length,
      line_id: Number(id!),
    };

    setWaypoints((prev) => [...prev, newMarker]);
  };
















  const drawBusRoute = async () => {
    if (waypoints.length < 2) return;

    const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY;
    const updateType = routeUpdateTypeRef.current;

    const coordinates =
      updateType === "append"
        ? waypoints
            .slice(-2)
            .map((c) => `${c.lat},${c.long}`)
            .join("|")
        : waypoints.map((c) => `${c.lat},${c.long}`).join("|");

    const response = await axios.get(
      `https://api.geoapify.com/v1/routing?waypoints=${coordinates}&mode=drive&apiKey=${GEOAPIFY_KEY}`,
    );

    const geometry = response.data.features?.[0]?.geometry;
    if (!geometry) return;

    const flat: [number, number][] =
      geometry.type === "MultiLineString"
        ? geometry.coordinates.flat(1)
        : geometry.coordinates;

    const newSegment = flat.map((r, i) => ({
      lat: r[1],
      long: r[0],
      line_id: Number(id!),
      order_index: i,
    }));

    if (updateType === "append") {
      setCoord((prev) => {
        const merged =
          prev.length === 0 ? newSegment : [...prev, ...newSegment.slice(1)];
        return merged.map((p, i) => ({ ...p, order_index: i }));
      });
    } else {
      setCoord(newSegment);
    }
  };

  useEffect(() => {
    if (waypoints.length < 2) return;

    if (isEdit && !initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }

    const timeout = setTimeout(() => {
      drawBusRoute();
    }, 400);

    return () => clearTimeout(timeout);
  }, [waypoints]);

  const renderRoute = (
    route: { long: number; lat: number; order_index: number }[],
  ) => {
    if (route.length < 1) return;

    const geojson: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: route?.map((m) => [Number(m.long), Number(m.lat)]),
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
          id={"1"}
          type="line"
          paint={{
            "line-color": "red",
            "line-width": 4,
          }}
        />
      </Source>
    );
  };

  const handleStationDragEnd = (
    station: Station,
    coords: { lat: number; lng: number },
  ) => {
    setStations((prev) =>
      prev.map((s) =>
        s.lat === station.lat && s.long === station.long
          ? { ...s, lat: coords.lat, long: coords.lng }
          : s,
      ),
    );
  };

  const handleWaypointDragEnd = (
    waypoint: BaseCoordinates,
    coords: { lat: number; lng: number },
  ) => {
    setUpdate("full");
    setWaypoints((prev) =>
      prev.map((s) =>
        s.lat === waypoint.lat && s.long === waypoint.long
          ? { ...s, lat: coords.lat, long: coords.lng }
          : s,
      ),
    );
  };

  const handleDeleteWaypoint = (selectedWaypoint: BaseCoordinates) => {
    setWaypoints((prev) => {
      const remainingWaypoints = prev.filter(
        (waypoint) =>
          !(
            waypoint.lat === selectedWaypoint?.lat &&
            waypoint.long === selectedWaypoint?.long
          ),
      );

      const reorderedWaypoints = remainingWaypoints.map((waypoint) => ({
        ...waypoint,
        order_index:
          waypoint.order_index > selectedWaypoint.order_index
            ? waypoint.order_index - 1
            : waypoint.order_index,
      }));
      return reorderedWaypoints;
    });

    setSelectedWaypoint(null);
    setMode(MapEditModeEnum.Idle);
    setUpdate("full");
  };

  useEffect(() => {
    if (isDeleteNode && selectedWaypoint) {
      handleDeleteWaypoint(selectedWaypoint);
    }
  }, [mode]);

  return (
    <>
      <div className="flex absolute z-20 p-2.5">
        <Button
          className="z-100"
          onClick={async () => await handleCreateRoute(coord, waypoints)}
        >
          {isEdit ? t("routesPage.updateRoute") : t("routesPage.createRoute")}
        </Button>
      </div>
      <BaseMap
        handleAddMarker={isInsertionMode ? handleInsertWaypoint : addMarker}
      >
        {waypoints.map((item) => {
          return (
            <Waypoint
              key={item.id}
              waypoint={item}
              draggable
              onDragEnd={handleWaypointDragEnd}
            />
          );
        })}
        {stations.map((item, index) => (
          <BusStation
            key={item.id || index}
            station={item}
            draggable
            onDragEnd={handleStationDragEnd}
          />
        ))}
        {renderRoute(coord)}
      </BaseMap>
    </>
  );
};

export default ManageMap;
