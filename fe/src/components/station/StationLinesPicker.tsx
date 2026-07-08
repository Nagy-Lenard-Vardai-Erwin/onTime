import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Line } from "@/entities/line";
import type { LineStation } from "@/entities/lineStation";
import type { Station } from "@/entities/route";
import useAttachLineStation from "@/hooks/admin/tanstack/useAttachLineStation";
import useDetachLineStation from "@/hooks/admin/tanstack/useDetachLineStation";

type StationLinesPickerProps = {
  station: Station;
  lines: Line[];
  attachments: LineStation[];
};

const StationLinesPicker = ({
  station,
  lines,
  attachments,
}: StationLinesPickerProps) => {
  const { t } = useTranslation();
  const { mutateAsync: attach } = useAttachLineStation();
  const { mutateAsync: detach } = useDetachLineStation();
  const [pendingLineId, setPendingLineId] = useState<number | null>(null);

  const stationId = Number(station.id);
  const attachmentFor = (lineId: number) =>
    attachments.find((a) => a.line_id === lineId && a.station_id === stationId);

  const attachedCount = lines.filter((line) => attachmentFor(line.id)).length;

  const toggleLine = async (line: Line) => {
    const attachment = attachmentFor(line.id);
    setPendingLineId(line.id);
    try {
      if (attachment) {
        await detach(attachment.id);
        toast.success(
          t("stationsPage.lineDetached", {
            line: line.name,
            name: station.name,
          }),
        );
      } else {
        await attach({ station_id: stationId, line_id: line.id });
        toast.success(
          t("stationsPage.lineAttached", {
            line: line.name,
            name: station.name,
          }),
        );
      }
    } catch (err: any) {
      toast.warning(t(err.message ?? err));
    } finally {
      setPendingLineId(null);
    }
  };

  return (
    <div className="grid gap-2">
      <label className="text-xl">
        {t("stationsPage.attachedLines")}
        <span className="ml-2 text-base text-muted-foreground">
          {t("stationsPage.manageLinesHint", { count: attachedCount })}
        </span>
      </label>

      <ul className="grid max-h-64 gap-2 overflow-y-auto pr-1">
        {lines.length === 0 && (
          <li className="text-lg text-muted-foreground">
            {t("stationsPage.noLines")}
          </li>
        )}
        {lines.map((line) => {
          const attached = Boolean(attachmentFor(line.id));
          const isPending = pendingLineId === line.id;

          return (
            <li key={line.id}>
              <button
                type="button"
                onClick={() => toggleLine(line)}
                disabled={isPending}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-xl transition-colors hover:bg-muted/40 disabled:opacity-60",
                  attached ? "border-primary bg-primary/5" : "border-input",
                )}
              >
                <span>{line.name}</span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md border",
                    attached
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input",
                  )}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : attached ? (
                    <Check className="size-4" />
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default StationLinesPicker;
