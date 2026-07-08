import type { MenuItem } from "@/hooks/useUserUtilities";
import { useThemeContext } from "../contexts/ThemeContextProvider";
import { themedSvg } from "../utils/themedSvg";
import chevronSvg from "@/assets/chevron.svg";
import UtilityIcon from "../Icons/UtilityIcon";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useLines from "@/hooks/admin/tanstack/useLines";

const PageTitle = () => {
  const { theme } = useThemeContext();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: lines } = useLines();

  const segments = location.pathname.split("/").filter(Boolean);

  const crumbs = segments
    .map((segment, index) => ({
      segment: decodeURIComponent(segment),
      path: "/" + segments.slice(0, index + 1).join("/"),
    }))
    .filter(({ segment }, index) => {
      if (index === 0 && segment === "admin") return false;
      return true;
    });

  if (crumbs.length === 0) return null;

  const themedSvgClass = themedSvg(theme);

  const chevronItem: MenuItem = {
    key: "back",
    src: chevronSvg,
    alt: "Back Button",
  };

  const segmentOverrides: Record<string, string> = { routes: "lines" };

  const label = (segment: string) => {
    if (/^\d+$/.test(segment)) {
      const line = lines?.find((l) => String(l.id) === segment);
      return line?.name ?? segment;
    }
    const key = segmentOverrides[segment] ?? segment;
    return t(`admin.${key}`, {
      defaultValue: segment.charAt(0).toUpperCase() + segment.slice(1),
    });
  };

  return (
    <div className="flex gap-4 items-center">
      <div className="flex items-center gap-2 ml-8">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <div key={crumb.path} className="flex items-center gap-2">
              <span
                onClick={isLast ? undefined : () => navigate(crumb.path)}
                className={`${isLast ? "text-light-blue underline" : "cursor-pointer hover:underline"} text-2xl font-bold`}
              >
                {label(crumb.segment)}
              </span>

              {!isLast && (
                <UtilityIcon
                  neutral={true}
                  buttonClass="!hover:cursor-normal !hover:bg-background !active:bg-background"
                  item={chevronItem}
                  className={`w-4 h-4 ${themedSvgClass} flex items-center rotate-180 `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PageTitle;
