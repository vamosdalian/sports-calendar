"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isSupportedTimeZone, SERVER_TIME_ZONE, TIME_ZONE_STORAGE_KEY } from "../lib/timezone";

type TimeZoneContextValue = {
  timeZone: string;
  browserTimeZone: string;
  setTimeZone: (timeZone: string) => void;
};

const TimeZoneContext = createContext<TimeZoneContextValue | null>(null);

function getBrowserTimeZone() {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (detected && isSupportedTimeZone(detected)) {
    return detected;
  }

  return SERVER_TIME_ZONE;
}

function readStoredTimeZone() {
  try {
    return window.localStorage.getItem(TIME_ZONE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistTimeZone(timeZone: string) {
  try {
    window.localStorage.setItem(TIME_ZONE_STORAGE_KEY, timeZone);
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.)
  }
}

export function TimeZoneProvider({ children }: { children: ReactNode }) {
  const [timeZone, setTimeZoneState] = useState(SERVER_TIME_ZONE);
  const [browserTimeZone, setBrowserTimeZone] = useState(SERVER_TIME_ZONE);

  useEffect(() => {
    const detected = getBrowserTimeZone();
    setBrowserTimeZone(detected);

    const stored = readStoredTimeZone();
    if (stored && isSupportedTimeZone(stored)) {
      setTimeZoneState(stored);
      return;
    }

    setTimeZoneState(detected);
    persistTimeZone(detected);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== TIME_ZONE_STORAGE_KEY || !event.newValue) {
        return;
      }

      if (isSupportedTimeZone(event.newValue)) {
        setTimeZoneState(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setTimeZone = useCallback((nextTimeZone: string) => {
    if (!isSupportedTimeZone(nextTimeZone)) {
      return;
    }

    setTimeZoneState(nextTimeZone);
    persistTimeZone(nextTimeZone);
  }, []);

  const contextValue = useMemo(
    () => ({
      timeZone,
      browserTimeZone,
      setTimeZone,
    }),
    [browserTimeZone, setTimeZone, timeZone],
  );

  return <TimeZoneContext.Provider value={contextValue}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone() {
  const context = useContext(TimeZoneContext);
  if (!context) {
    throw new Error("useTimeZone must be used within TimeZoneProvider");
  }

  return context;
}
