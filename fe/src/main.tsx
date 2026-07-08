import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import router from "./routes";
import "../i18n";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import "maplibre-gl/dist/maplibre-gl.css";
import { AuthContextProvider } from "./components/contexts/authContext";
import { ThemeContextProvider } from "./components/contexts/ThemeContextProvider";
import { UserLocationProvider } from "./components/contexts/userLocationContext";
import { Toaster } from "./components/shadcn/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemeContextProvider>
        <AuthContextProvider>
          <QueryClientProvider client={queryClient}>
            <UserLocationProvider>
              <RouterProvider router={router} />
              <Toaster />
            </UserLocationProvider>
          </QueryClientProvider>
        </AuthContextProvider>
      </ThemeContextProvider>
    </I18nextProvider>
  </StrictMode>,
);
