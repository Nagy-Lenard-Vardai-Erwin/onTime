import { Layer, Map, Marker, NavigationControl, Source, type MapLayerMouseEvent } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Theme } from "../../entities/theme";
import { useState } from "react";

interface MapComponentProps {
  theme: Theme;
}

type Marker = {
  latitude: number
  longitude: number
}

type MapClick = {
  lngLast: { lat: number, lng: number },
  point: { x: number, y: number }
}

const MapComponent = ({ theme }: MapComponentProps) => {
  const bounds: [[number, number], [number, number]] = [
    [23.439274, 47.617155], // SW [lng, lat]
    [23.729459, 47.686301], // NE [lng, lat]
  ];

  const [markers, setMarkets] = useState<Marker[]>([])

  const addMarker = (marker: MapLayerMouseEvent) => {
    console.log(marker.lngLat)
    const { lat, lng } = marker.lngLat

    const newMarker: Marker = {
      latitude: lat,
      longitude: lng
    }

    setMarkets((prev) => [...prev, newMarker])
  }
  const pointA = { longitude: 23.579052, latitude: 47.662278 };
  const pointB = { longitude: 23.595779, latitude: 47.671174 };

  const drawRoad = () => {

    if (markers.length < 2) {
      console.log("no points")
      return
    }
    const routeGeoJSON = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          ...markers.map(marker => [marker.longitude, marker.latitude]),
        ],
      },
    };

    return routeGeoJSON
  }
  return (
    <div className="w-screen h-screen rounded-xl">
      <Map
        // mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json" // colorful light
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
        // maxZoom={18}
        maxBounds={bounds}
        onClick={(e) => addMarker(e)}
      >
        <NavigationControl position="top-right" />
        {markers.map((marker, i) => {
          return (<Marker
            key={i}
            longitude={marker.longitude}
            latitude={marker.latitude}
            color="red"
            className="z-10"
            onClick={(e) => { console.log(e) }}
          />)
        })}
        {markers.length > 1 && <Source id="route" type="geojson" data={drawRoad()}>
          <Layer
            id="route-line"
            type="line"
            paint={{
              "line-color": "#007bff",
              "line-width": 4,
            }}
          />
        </Source>}

      </Map>
    </div>
  );
};

export default MapComponent;
