export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

const PREVIEW_CAP = 500;

export function formatData(data: unknown): string {
  let text: string;
  if (data === undefined) {
    text = "(no data)";
  } else if (data === null) {
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

export function expandedData(data: unknown): string {
  if (data === undefined) return "(no data)";
  if (typeof data === "string") return data;

  try {
    return JSON.stringify(data, null, 2) ?? String(data);
  } catch {
    return String(data);
  }
}

export function formatAgo(from: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 1) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function formatDuration(from: number, now: number = Date.now()): string {
  const totalSeconds = Math.max(0, Math.round((now - from) / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

export function urlLabel(url: string): string {
  try {
    const parsed = new URL(url, "http://localhost");
    const path = `${parsed.pathname}${parsed.search}`;
    return parsed.host === "localhost" ? path : `${parsed.host}${path}`;
  } catch {
    return url;
  }
}
