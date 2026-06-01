export function formatTime(timestamp: string | undefined): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}
