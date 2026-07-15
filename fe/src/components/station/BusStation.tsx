import type { Station } from "@/entities/route";
import { Marker } from "@vis.gl/react-maplibre";
import BusIcon from "@/assets/bus_station.svg";

type LatLng = {
  lat: number;
  lng: number;
};

type BusStationProps = {
  station: Station;
  onDragEnd?: (station: Station, { lat, lng }: LatLng) => void;
  draggable?: boolean;
  onClick?: (station: Station) => void;
  isSelected?: boolean;
};

function BusStation({
  station,
  onDragEnd,
  draggable = false,
  onClick,
  isSelected = false,
}: BusStationProps) {
  return (
    <Marker
      latitude={station.lat}
      longitude={station.long}
      color="red"
      draggable={draggable}
      onClick={(e) => {
        if (draggable) return;
        e.originalEvent.stopPropagation();
        onClick?.(station);
      }}
      onDragEnd={(e) => {
        if (!draggable) return;
        const { lat, lng } = e.lngLat;
        onDragEnd?.(station, { lat, lng });
      }}
      style={{
        border: isSelected ? "1.5px dashed #00c2cb" : "none",
        borderRadius: "50%",
        padding: `2px`,
      }}
    >
      <img
        src={BusIcon}
        alt={station.name}
        className="size-8 shrink-0 cursor-pointer group-data-[collapsible=icon]:justify-center"
      />
    </Marker>
  );
}

export { BusStation };
