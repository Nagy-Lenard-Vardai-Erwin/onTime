import { useTranslation } from "react-i18next";
import useLines from "@/hooks/admin/tanstack/useLines";
import useStartSimulation from "@/hooks/tanstack/useStartSimulation";
import useStopSimulation from "@/hooks/tanstack/useStopSimulation";
import { Button } from "@/components/shadcn/button";
import { Radio, FlaskConical } from "lucide-react";

export type DataSource = "live" | "simulation";

type HomeControlsProps = {
  selectedLineId?: number;
  onSelectLine: (lineId?: number) => void;
  running: boolean;
  onStarted?: () => void;
  onStopped?: () => void;
  dataSource: DataSource;
  onChangeDataSource: (source: DataSource) => void;
  busCount?: number;
};

const HomeControls = ({
  selectedLineId,
  onSelectLine,
  running,
  onStarted,
  onStopped,
  dataSource,
  onChangeDataSource,
  busCount,
}: HomeControlsProps) => {
  const { t } = useTranslation();
  const { data: lines } = useLines();
  const startSimulation = useStartSimulation();
  const stopSimulation = useStopSimulation();

  const isLive = dataSource === "live";

  const switchSource = (source: DataSource) => {
    if (source === dataSource) return;

    if (source === "live" && running) {
      stopSimulation.mutate(undefined, { onSuccess: () => onStopped?.() });
    }
    onChangeDataSource(source);
  };

  const sourceOptions: {
    value: DataSource;
    labelKey: string;
    icon: typeof Radio;
  }[] = [
    { value: "live", labelKey: "home.liveMode", icon: Radio },
    { value: "simulation", labelKey: "home.simulationMode", icon: FlaskConical },
  ];

  return (
    <div className="absolute top-24 left-4 z-30 flex w-80 flex-col gap-4 rounded-2xl border bg-background/90 p-5 shadow-xl backdrop-blur">
      <div className="grid gap-2">
        <label className="text-lg font-medium">{t("home.selectLine")}</label>
        <select
          className="h-12 rounded-md border border-input bg-background px-3 text-lg text-foreground outline-none"
          value={selectedLineId ?? ""}
          onChange={(e) =>
            onSelectLine(e.target.value ? Number(e.target.value) : undefined)
          }
        >
          <option value="">{t("home.linePlaceholder")}</option>
          {(Array.isArray(lines) ? lines : []).map((line) => (
            <option key={line.id} value={line.id}>
              {line.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-lg font-medium">{t("home.dataSource")}</label>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {sourceOptions.map((option) => {
            const Icon = option.icon;
            const isActive = dataSource === option.value;

            return (
              <button
                key={option.value}
                onClick={() => switchSource(option.value)}
                className={`flex items-center justify-center gap-2 rounded-md px-2 py-2 text-lg transition-all hover:cursor-pointer ${
                  isActive
                    ? "bg-background font-medium shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-5" />
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {isLive ? (
        <div className="flex items-center gap-3 rounded-lg border border-input bg-background/60 px-4 py-3">
          <span className="relative flex size-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-green-500" />
          </span>
          <div className="text-base leading-snug">
            <p className="font-medium">
              {t("home.busesOnline", { count: busCount ?? 0 })}
            </p>
            <p className="text-muted-foreground">{t("home.liveHint")}</p>
          </div>
        </div>
      ) : running ? (
        <Button
          variant="destructive"
          className="text-lg"
          onClick={() =>
            stopSimulation.mutate(undefined, { onSuccess: () => onStopped?.() })
          }
          disabled={stopSimulation.isPending}
        >
          {stopSimulation.isPending
            ? t("home.stopping")
            : t("home.stopSimulation")}
        </Button>
      ) : (
        <Button
          className="text-lg"
          onClick={() =>
            startSimulation.mutate(undefined, {
              onSuccess: () => onStarted?.(),
            })
          }
          disabled={startSimulation.isPending}
        >
          {startSimulation.isPending
            ? t("home.starting")
            : t("home.startSimulation")}
        </Button>
      )}
    </div>
  );
};

export default HomeControls;
