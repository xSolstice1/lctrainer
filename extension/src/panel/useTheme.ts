import { useEffect, useState } from "react";
import { STORAGE_KEY_THEME } from "../lib/constants.js";

export type Theme = "dark" | "light";

export function useTheme(defaultTheme: Theme = "dark") {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY_THEME).then((stored) => {
      if (stored[STORAGE_KEY_THEME] === "light" || stored[STORAGE_KEY_THEME] === "dark") {
        setTheme(stored[STORAGE_KEY_THEME]);
      }
    });
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    chrome.storage.local.set({ [STORAGE_KEY_THEME]: next });
  };

  return { theme, toggleTheme };
}
