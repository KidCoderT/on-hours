import { useState } from "react";
import { onWindows, type Release } from "../lib/release";

const WindowsMark = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" width="15" height="15">
    <path fill="currentColor" d="M1 2.5 7.2 1.6v5.9H1zM8.2 1.5 15 .5v7H8.2zM1 8.5h6.2v5.9L1 13.5zM8.2 8.5H15v7l-6.8-1z" />
  </svg>
);

/** On Windows: the installer. Anywhere else: a way to get this page onto the visitor's PC. */
export function DownloadButton({ release }: { release: Release }) {
  const [copied, setCopied] = useState(false);
  if (onWindows()) {
    return (
      <a className="btn btn-primary" href={release.url}>
        <WindowsMark />
        Download for Windows
      </a>
    );
  }
  const send = async () => {
    const url = location.origin + location.pathname;
    if (navigator.share) {
      await navigator.share({ title: "On Hours", url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" className="btn btn-primary" onClick={() => void send()}>
      <WindowsMark />
      {copied ? "Link copied" : "Send the link to your PC"}
    </button>
  );
}
