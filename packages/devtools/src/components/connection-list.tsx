import { memo, useCallback, useMemo } from "react";
import type { RegistrySnapshot } from "../registry/types";
import type { DevtoolsClientRecord } from "../registry/types";
import { C, S, statusColor, statusLabel } from "../theme/tokens";
import { urlPath } from "../lib/format";
import { StatusDot } from "./status-dot";

type ConnectionListProps = {
  readonly clients: RegistrySnapshot;
  readonly selectedId: string | null;
  readonly isCompact: boolean;
  readonly theme: "light" | "dark";
  readonly onSelect: (id: string) => void;
  readonly onSetTheme: (theme: "light" | "dark") => void;
};

export const ConnectionList = memo(function ConnectionList({
  clients,
  selectedId,
  isCompact,
  theme,
  onSelect,
  onSetTheme
}: ConnectionListProps) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const records = useMemo(() => Array.from(clients.values()), [clients]);
  const setNextTheme = useCallback(() => onSetTheme(nextTheme), [nextTheme, onSetTheme]);

  return (
    <div
      className="sse-dt-sidebar"
      style={{
        width: isCompact ? "100%" : 260,
        height: isCompact ? 112 : undefined,
        flexShrink: 0,
        borderRight: isCompact ? "none" : `1px solid ${C.border}`,
        borderBottom: isCompact ? `1px solid ${C.border}` : undefined,
        overflowY: isCompact ? "hidden" : "auto",
        display: "flex",
        flexDirection: "column",
        background: C.surface
      }}
    >
      <div
        style={{
          padding: isCompact ? "8px 12px" : "10px 12px",
          color: C.textMuted,
          ...S.caption,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexShrink: 0
        }}
      >
        <span>Connections</span>
        <button
          className="sse-dt-soft-button"
          onClick={setNextTheme}
          title={`Use ${nextTheme} theme`}
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            color: C.textMuted,
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 500,
            height: isCompact ? 22 : 22,
            lineHeight: 1,
            padding: "0 8px",
            textTransform: "capitalize"
          }}
        >
          {theme}
        </button>
      </div>

      {records.length === 0 ? (
        <div
          style={{ padding: "28px 16px", color: C.textMuted, fontSize: 12, textAlign: "center" }}
        >
          No active connections.
          <br />
          Wrap your app with <code style={{ color: C.textMuted }}>SSEDevtoolsProvider</code>.
        </div>
      ) : (
        <div
          className="sse-dt-connection-items"
          style={{
            display: "flex",
            flexDirection: isCompact ? "row" : "column",
            minHeight: 0,
            overflowX: isCompact ? "auto" : undefined,
            overflowY: isCompact ? "hidden" : undefined
          }}
        >
          {records.map((record) => (
            <ConnectionItem
              key={record.id}
              record={record}
              isCompact={isCompact}
              isOnlyItem={records.length === 1}
              isSelected={record.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
});

type ConnectionItemProps = {
  readonly record: DevtoolsClientRecord;
  readonly isCompact: boolean;
  readonly isOnlyItem: boolean;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
};

const ConnectionItem = memo(function ConnectionItem({
  record,
  isCompact,
  isOnlyItem,
  isSelected,
  onSelect
}: ConnectionItemProps) {
  const compactWidth = isOnlyItem ? "100%" : 240;
  const select = useCallback(() => onSelect(record.id), [record.id, onSelect]);

  return (
    <div
      className="sse-dt-connection-item"
      onClick={select}
      title={record.url}
      style={{
        width: isCompact ? compactWidth : undefined,
        flex: isCompact ? `0 0 ${compactWidth}` : undefined,
        padding: isCompact ? "8px 12px" : "10px 12px",
        borderRight: isCompact ? `1px solid ${C.borderLight}` : undefined,
        borderTop: "none",
        borderBottom: isCompact ? "none" : `1px solid ${C.borderLight}`,
        background: isSelected ? C.bg : "transparent",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderLeft: isCompact
          ? "none"
          : isSelected
            ? `2px solid ${C.accent}`
            : "2px solid transparent"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <StatusDot status={record.status} />
        <span
          style={{
            color: C.text,
            fontSize: 12,
            fontWeight: 500,
            flex: 1,
            ...S.mono,
            ...S.ellipsis
          }}
        >
          {urlPath(record.url)}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 14 }}>
        <span style={{ color: statusColor(record.status), fontSize: 10 }}>
          {statusLabel(record.status)}
        </span>
        <span style={{ color: C.textMuted, fontSize: 10, ...S.mono }}>
          {record.totalEvents} evt
        </span>
      </div>
    </div>
  );
});
