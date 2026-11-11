import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";

const EVERY = 6 * 60 * 60 * 1000; // re-check every 6 hours; the app runs for days

/**
 * Silent auto-update from GitHub Releases. Checks at launch and every 6h, downloads in the
 * background, and installs only while the timer is paused, so a running session is never cut.
 * On Windows the installer closes the app, updates it and starts it again.
 */
export function useAutoUpdate(running: boolean) {
  const ready = useRef<Update | null>(null);
  const installing = useRef(false);

  const install = () => {
    const update = ready.current;
    if (!update || installing.current) return;
    installing.current = true;
    update.install().catch((e) => {
      installing.current = false;
      console.error("could not install update", e);
    });
  };

  // Find and download.
  useEffect(() => {
    if (!isTauri() || import.meta.env.DEV) return; // dev builds are never updated
    const look = async () => {
      if (ready.current) return;
      try {
        const update = await check();
        if (!update) return;
        await update.download();
        ready.current = update;
      } catch (e) {
        console.error("update check failed", e); // offline or no release yet: try again later
      }
    };
    void look();
    const id = setInterval(() => void look(), EVERY);
    return () => clearInterval(id);
  }, []);

  // Install at the first moment the timer is paused (checked each minute, and on every pause).
  useEffect(() => {
    if (running) return;
    install();
    const id = setInterval(install, 60_000);
    return () => clearInterval(id);
  }, [running]);
}
