import { memo } from "react";
import type { SSEConnectionStatus } from "@flamefrontend/sse-runtime-core";
import { C, statusColor } from "../theme/tokens";

type StatusDotProps = {
  readonly status: SSEConnectionStatus;
  readonly size?: number;
};

export const StatusDot = memo(function StatusDot({ status, size = 8 }: StatusDotProps) {
  const isPulse = status === "connecting" || status === "reconnecting";
  const color = statusColor(status);

  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 0 2px ${C.bg}, 0 0 0 3px ${color}33`,
        flexShrink: 0,
        animation: isPulse ? "sse-dt-pulse 1.4s ease-in-out infinite" : undefined
      }}
    />
  );
});
