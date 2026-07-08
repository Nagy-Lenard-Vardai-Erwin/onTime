import type { LiveBus } from "@/entities/liveBus";
import AnimatedBusMarker from "./AnimatedBusMarker";

type LiveBusesProps = {
  buses?: LiveBus[];
  onBusClick?: (bus: LiveBus) => void;
  highlightBusId?: number;
};

const LiveBuses = ({ buses, onBusClick, highlightBusId }: LiveBusesProps) => {
  if (!buses?.length) return null;

  return (
    <>
      {buses.map((bus) => (
        <AnimatedBusMarker
          key={bus.bus_id}
          bus={bus}
          onClick={onBusClick}
          highlighted={bus.bus_id === highlightBusId}
        />
      ))}
    </>
  );
};

export default LiveBuses;
