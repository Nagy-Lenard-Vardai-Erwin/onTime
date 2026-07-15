import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ViewMap from "../components/map/ViewMap";
import HomeControls, {
  type DataSource,
} from "../components/home/HomeControls";
import useRoute from "../hooks/admin/tanstack/useRoute";
import useLiveBuses from "../hooks/tanstack/useLiveBuses";
import useClosestBus from "../hooks/tanstack/useClosestBus";
import { useThemeContext } from "../components/contexts/ThemeContextProvider";
import { themedSvg } from "../components/utils/themedSvg";
import busSvg from "@/assets/buses.svg";
import footPrintsSvg from "@/assets/foot_prints.svg";
import { toast } from "sonner";
import { useUserLocationContext } from "../components/contexts/userLocationContext";
import useWalkingRoute from "../hooks/tanstack/useWalkingRoute";
import type { Station } from "../entities/route";
import { axiosInstance } from "../apiConfig";
import "../css/HomePage.css";

const HomePage = () => {
  const { t } = useTranslation();
  const { theme } = useThemeContext();
  const themedIcon = themedSvg(theme);
  const [selectedLineId, setSelectedLineId] = useState<number | undefined>();
  const [targetStation, setTargetStation] = useState<Station | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>("live");

  const runningRef = useRef(false);
  runningRef.current = simulationRunning;
  useEffect(() => {
    const stopOnUnload = () => {
      if (runningRef.current) {
        navigator.sendBeacon(
          `${axiosInstance.defaults.baseURL}simulation/stop`,
        );
      }
    };
    window.addEventListener("beforeunload", stopOnUnload);
    return () => window.removeEventListener("beforeunload", stopOnUnload);
  }, []);

  const { data: routeResponse } = useRoute({
    line_ids: selectedLineId ? [selectedLineId] : undefined,
  });
  const shouldPoll =
    dataSource === "live" ? Boolean(selectedLineId) : simulationRunning;
  const { data: liveBuses } = useLiveBuses(
    shouldPoll ? selectedLineId : undefined,
    dataSource === "live",
  );

  const { data: closestBusData } = useClosestBus(
    selectedLineId,
    targetStation ? Number(targetStation.id) : undefined,
    dataSource === "live",
    shouldPoll,
  );
  const closestBus = shouldPoll ? closestBusData?.bus : null;

  const { location, enable, error: locationError } = useUserLocationContext();

  useEffect(() => {
    if (locationError) toast.error(locationError);
  }, [locationError]);

  const { data: walking } = useWalkingRoute(
    location,
    targetStation ? { lat: targetStation.lat, lon: targetStation.long } : null,
  );
  const AVG_WALKING_SPEED_MPS = 1.4;
  const walkingMinutes =
    walking?.distanceM != null
      ? Math.max(1, Math.round(walking.distanceM / AVG_WALKING_SPEED_MPS / 60))
      : null;

  const handleSelectStation = (station: Station) => {
    setTargetStation(station);
    enable();
  };

  const handleSelectLine = (lineId?: number) => {
    setSelectedLineId(lineId);
    setTargetStation(null);
  };

  const formatDistance = (meters: number) =>
    meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;

  return (
    <div className="home-map relative h-screen">
      <div className="absolute inset-0 z-0">
        <ViewMap
          mode="view"
          routeData={routeResponse?.response}
          liveBuses={liveBuses}
          userLocation={location}
          walkingRoute={walking?.coordinates}
          onSelectStation={handleSelectStation}
          onDeselectStation={() => setTargetStation(null)}
          selectedStationId={targetStation?.id}
          highlightBusId={closestBus?.bus_id}
        />
      </div>

      <HomeControls
        selectedLineId={selectedLineId}
        onSelectLine={handleSelectLine}
        running={simulationRunning}
        onStarted={() => setSimulationRunning(true)}
        onStopped={() => setSimulationRunning(false)}
        dataSource={dataSource}
        onChangeDataSource={setDataSource}
        busCount={liveBuses?.length ?? 0}
      />

      {targetStation && (
        <div className="absolute bottom-8 left-1/2 z-30 flex w-[min(92vw,28rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border bg-popover/95 text-popover-foreground px-5 py-4 shadow-xl backdrop-blur">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-2xl font-semibold">{targetStation.name}</p>

            {closestBus ? (
              <p className="flex items-center gap-2 text-xl">
                <img src={busSvg} className={`size-5 shrink-0 ${themedIcon}`} />
                <span>
                  <span className="font-semibold">
                    {t("home.busMinutes", {
                      minutes: Math.max(
                        1,
                        Math.round(closestBus.eta_seconds / 60),
                      ),
                    })}
                  </span>{" "}
                  · {closestBus.bus_name} ·{" "}
                  {formatDistance(closestBus.distance_m)}
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-2 text-xl text-muted-foreground">
                <img src={busSvg} className={`size-5 shrink-0 ${themedIcon}`} />
                {t("home.noBusApproaching")}
              </p>
            )}

            {walkingMinutes != null ? (
              <p className="flex items-center gap-2 text-xl">
                <img src={footPrintsSvg} className={`size-5 shrink-0 ${themedIcon}`} />
                <span>
                  <span className="font-semibold">
                    {t("home.walkMinutes", { minutes: walkingMinutes })}
                  </span>{" "}
                  · {formatDistance(walking?.distanceM ?? 0)}
                </span>
              </p>
            ) : location ? (
              <p className="text-xl text-muted-foreground">
                {t("home.walkingCalculating")}
              </p>
            ) : null}
          </div>
          <button
            onClick={() => setTargetStation(null)}
            title={t("admin.cancel")}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground hover:cursor-pointer"
          >
            <span className="relative block size-5">
              <span className="absolute top-1/2 left-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current" />
              <span className="absolute top-1/2 left-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default HomePage;
