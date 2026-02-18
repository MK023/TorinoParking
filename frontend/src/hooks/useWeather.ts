import { useEffect, useState } from "react";

export interface Weather {
  temperature: number;
  code: number;
  icon: string;
  label: string;
}

const TORINO_LAT = 45.0703;
const TORINO_LNG = 7.6869;
const REFRESH_MS = 15 * 60 * 1000; // 15 min

const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${TORINO_LAT}&longitude=${TORINO_LNG}&current=temperature_2m,weather_code&timezone=Europe/Rome`;

function decodeWeatherCode(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "\u2600\ufe0f", label: "Sereno" };
  if (code <= 3) return { icon: "\u26c5", label: "Parz. nuvoloso" };
  if (code <= 48) return { icon: "\ud83c\udf2b\ufe0f", label: "Nebbia" };
  if (code <= 57) return { icon: "\ud83c\udf26\ufe0f", label: "Pioggerella" };
  if (code <= 67) return { icon: "\ud83c\udf27\ufe0f", label: "Pioggia" };
  if (code <= 77) return { icon: "\u2744\ufe0f", label: "Neve" };
  if (code <= 82) return { icon: "\ud83c\udf26\ufe0f", label: "Rovesci" };
  if (code <= 86) return { icon: "\ud83c\udf28\ufe0f", label: "Neve" };
  return { icon: "\u26a1", label: "Temporale" };
}

export function useWeather(): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) return;
        const data = await res.json();
        const temp = data.current?.temperature_2m;
        const code = data.current?.weather_code;
        if (temp == null || code == null) return;
        const { icon, label } = decodeWeatherCode(code);
        if (!cancelled) {
          setWeather({ temperature: Math.round(temp), code, icon, label });
        }
      } catch {
        // silently fail - weather is non-critical
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return weather;
}
