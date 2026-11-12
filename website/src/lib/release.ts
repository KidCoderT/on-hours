import { useEffect, useState } from "react";

export const REPO = "https://github.com/KidCoderT/on-hours";
const LATEST = `${REPO}/releases/latest`;

export type Release = { version: string | null; url: string };

/** The newest installer on GitHub. Falls back to the releases page if the API can't be reached. */
export function useRelease(): Release {
  const [release, setRelease] = useState<Release>({ version: null, url: LATEST });
  useEffect(() => {
    fetch("https://api.github.com/repos/KidCoderT/on-hours/releases/latest")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { tag_name: string; assets: { name: string; browser_download_url: string }[] }) => {
        const setup = data.assets.find((a) => a.name.endsWith("-setup.exe"));
        setRelease({ version: data.tag_name, url: setup?.browser_download_url ?? LATEST });
      })
      .catch(() => {}); // rate-limited or offline: the releases page still works
  }, []);
  return release;
}

export const onWindows = () => /Windows/i.test(navigator.userAgent);
