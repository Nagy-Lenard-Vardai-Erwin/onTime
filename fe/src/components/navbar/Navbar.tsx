import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useThemeContext } from "../contexts/ThemeContextProvider";
import { useUserLocationContext } from "../contexts/userLocationContext";
import { themedSvg } from "../utils/themedSvg";
import onTimeDark from "@/assets/onTime-dark.svg";
import onTimeLight from "@/assets/onTime-light.svg";
import ENSvg from "@/assets/EN.svg";
import ROSvg from "@/assets/RO.svg";
import darkSvg from "@/assets/dark.svg";
import lightSvg from "@/assets/light.svg";
import crosshairSvg from "@/assets/crosshair.svg";

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useThemeContext();
  const { pathname } = useLocation();
  const { enabled: locationEnabled, toggle: toggleLocation } =
    useUserLocationContext();

  const showLocation = pathname === "/";

  const logo = theme === "light" ? onTimeLight : onTimeDark;
  const themedSvgClass = themedSvg(theme);

  const toggleLanguage = () => {
    const next = i18n.language === "ro" ? "en" : "ro";
    i18n.changeLanguage(next);
    localStorage.setItem("language", next);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language");
    const language = savedLanguage === "en" ? "en" : "ro";
    i18n.changeLanguage(language);
    localStorage.setItem("language", language);
  }, []);

  return (
    <header className="absolute top-0 z-20 flex w-full items-center justify-between bg-background/80 px-6 py-3 shadow-[0_2px_5px_var(--color-shadow)] backdrop-blur-md">
      <Link to="/" className="flex items-center gap-3">
        <img src={logo} alt="onTime logo" className="size-[36px] shrink-0" />
        <span className="text-3xl font-semibold">onTime</span>
      </Link>

      <nav className="flex items-center gap-4">
        {showLocation && (
          <button
            onClick={toggleLocation}
            title={t("home.myLocation")}
            aria-pressed={locationEnabled}
            className={`rounded-md p-1.5 transition-colors hover:cursor-pointer ${
              locationEnabled ? "bg-accent" : "hover:bg-accent"
            }`}
          >
            <img src={crosshairSvg} className={`size-[30px] ${themedSvgClass}`} />
          </button>
        )}

        <button
          onClick={toggleLanguage}
          title={t("admin.language")}
          className="rounded-md p-1.5 transition-colors hover:bg-accent hover:cursor-pointer"
        >
          <img
            src={i18n.language === "ro" ? ROSvg : ENSvg}
            alt="Language Icon"
            className={`size-[30px] ${themedSvgClass}`}
          />
        </button>

        <button
          onClick={toggleTheme}
          title={t("admin.theme")}
          className="rounded-md p-1.5 transition-colors hover:bg-accent hover:cursor-pointer"
        >
          <img
            src={theme === "dark" ? darkSvg : lightSvg}
            alt="Theme Icon"
            className={`size-[30px] ${themedSvgClass}`}
          />
        </button>
      </nav>
    </header>
  );
};

export default Navbar;
