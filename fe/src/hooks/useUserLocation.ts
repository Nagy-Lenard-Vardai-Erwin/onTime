import { useEffect, useRef, useState } from "react";

export type UserLocation = { lat: number; lon: number };

const describeGeolocationError = (err: GeolocationPositionError): string => {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location blocked. Allow it for this site (tap the icon left of the address bar → Permissions → Location) and make sure your browser has location access in the phone settings, then reload.";
    case err.POSITION_UNAVAILABLE:
      return "Location unavailable. Turn on your device's GPS / Location and try again.";
    case err.TIMEOUT:
      return "Couldn't get your location in time. Try again near a window or outdoors.";
    default:
      return err.message || "Could not get your location.";
  }
};

const useUserLocation = () => {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => setError(describeGeolocationError(err)),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [enabled]);

  return {
    location,
    enabled,
    error,
    enable: () => setEnabled(true),
    toggle: () => setEnabled((prev) => !prev),
  };
};

export default useUserLocation;
