import { memo } from "react";
import type { CoordinationRole } from "@flamefrontend/sse-runtime-core";
import { C, S } from "../theme/tokens";

type RoleBadgeProps = {
  readonly role: CoordinationRole | null;
};

const TITLE: Record<CoordinationRole, string> = {
  leader: "This tab owns the real SSE connection and forwards events to other tabs",
  follower: "This tab mirrors the leader's connection over a BroadcastChannel"
};

export const RoleBadge = memo(function RoleBadge({ role }: RoleBadgeProps) {
  if (role === null) {
    return null;
  }

  const isLeader = role === "leader";

  return (
    <span
      title={TITLE[role]}
      style={{
        ...S.caption,
        ...S.mono,
        flexShrink: 0,
        lineHeight: 1,
        padding: "2px 5px",
        borderRadius: 4,
        fontWeight: 600,
        color: isLeader ? C.bg : C.textMuted,
        background: isLeader ? C.accent : "transparent",
        border: `1px solid ${isLeader ? C.accent : C.border}`
      }}
    >
      {isLeader ? "Leader" : "Follower"}
    </span>
  );
});
