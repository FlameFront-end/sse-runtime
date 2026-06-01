import { MAX_EVENTS } from "../constants";

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

const PREVIEW_CAP = 500;

export function fmtData(data: unknown): string {
  let text: string;
  if (data === null || data === undefined) {
    text = "null";
  } else if (typeof data === "string") {
    text = data;
  } else {
    try {
      text = JSON.stringify(data) ?? String(data);
    } catch {
      text = String(data);
    }
  }
  text = text.replace(/\s+/g, " ");
  return text.length > PREVIEW_CAP ? `${text.slice(0, PREVIEW_CAP)}...` : text;
}

export function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function canExpandData(data: unknown): boolean {
  return typeof data !== "string" || data.length > 100;
}

export function expandedData(data: unknown): string {
  return typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

export const MAX_EVENTS_LABEL = MAX_EVENTS;
