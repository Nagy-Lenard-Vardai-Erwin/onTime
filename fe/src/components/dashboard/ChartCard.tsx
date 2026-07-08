import { useRef, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { AnalyticsMetricKey } from "@/entities/analytics";
import { Button } from "@/components/shadcn/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";

type ChartCardProps = {
  title: string;
  description?: string;
  metricKey?: AnalyticsMetricKey;
  children: ReactNode;
  className?: string;
};

const resolveColor = (css: string): [number, number, number] => {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [255, 255, 255];
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
};

const ChartCard = ({
  title,
  description,
  children,
  className,
}: ChartCardProps) => {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    const chartNode = chartRef.current;
    const headerNode = headerRef.current;
    const cardNode = cardRef.current;
    if (!chartNode || !headerNode || !cardNode) return;

    setIsDownloading(true);
    try {
      const [{ toPng }, { default: jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const cardStyle = getComputedStyle(cardNode);
      const bg = cardStyle.backgroundColor;
      const cardRgb = resolveColor(bg);
      const pageRgb = resolveColor(
        getComputedStyle(document.body).backgroundColor,
      );
      const borderRgb = resolveColor(cardStyle.borderTopColor);

      const capture = (node: HTMLElement) =>
        toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: bg });

      const loadImg = async (url: string) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
      };

      const headerW = headerNode.offsetWidth;
      const chartW = chartNode.offsetWidth;

      const headerUrl = await capture(headerNode);
      const headerImg = await loadImg(headerUrl);
      const chartUrl = await capture(chartNode);
      const chartImg = await loadImg(chartUrl);

      const margin = 28;
      const pad = 32;
      const radius = 20;
      const gap = 16;
      const headerH = (headerImg.height / headerImg.width) * headerW;
      const chartH = (chartImg.height / chartImg.width) * chartW;

      const panelW = chartW + pad * 2;
      const panelH = pad + headerH + gap + chartH + pad;
      const pageW = panelW + margin * 2;
      const pageH = panelH + margin * 2;

      const pdf = new jsPDF({
        orientation: pageW >= pageH ? "landscape" : "portrait",
        unit: "px",
        format: [pageW, pageH],
      });

      pdf.setFillColor(pageRgb[0], pageRgb[1], pageRgb[2]);
      pdf.rect(0, 0, pageW, pageH, "F");

      pdf.setFillColor(cardRgb[0], cardRgb[1], cardRgb[2]);
      pdf.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      pdf.setLineWidth(1);
      pdf.roundedRect(margin, margin, panelW, panelH, radius, radius, "FD");

      const cx = margin + pad;
      pdf.addImage(headerUrl, "PNG", cx, margin + pad, headerW, headerH);
      pdf.addImage(chartUrl, "PNG", cx, margin + pad + headerH + gap, chartW, chartH);
      pdf.save(`${title}.pdf`);

      toast.success(t("dashboard.downloadStarted", { name: title }));
    } catch {
      toast.warning(t("dashboard.downloadFailed"));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className={className} ref={cardRef}>
      <CardHeader>
        <div ref={headerRef} className="grid gap-1.5">
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && (
            <CardDescription className="text-lg">
              {description}
            </CardDescription>
          )}
        </div>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            className="text-base"
            onClick={handleDownload}
            disabled={isDownloading}
            aria-label={t("dashboard.downloadPdf")}
          >
            <Download className="!size-4" />
            {t("dashboard.pdf")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent ref={chartRef}>{children}</CardContent>
    </Card>
  );
};

export default ChartCard;
