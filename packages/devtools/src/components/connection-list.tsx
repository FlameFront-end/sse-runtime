import { memo, useCallback, useMemo } from "react";
import type { RegistrySnapshot } from "../registry/types";
import type { DevtoolsClientRecord } from "../registry/types";
import { C, S, statusColor, statusLabel } from "../theme/tokens";
import { urlLabel } from "../lib/format";
import type { ThemePreference } from "../lib/persistence";
import { StatusDot } from "./status-dot";

type ConnectionListProps = {
  readonly clients: RegistrySnapshot;
  readonly selectedId: string | null;
  readonly isCompact: boolean;
  readonly themePreference: ThemePreference;
  readonly onSelect: (id: string) => void;
  readonly onSetTheme: (theme: ThemePreference) => void;
};

const THEME_CYCLE: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system"
};

const THEME_LABEL: Record<ThemePreference, string> = {
  system: "Auto",
  light: "Light",
  dark: "Dark"
};

export const ConnectionList = memo(function ConnectionList({
  clients,
  selectedId,
  isCompact,
  themePreference,
  onSelect,
  onSetTheme
}: ConnectionListProps) {
  const nextTheme = THEME_CYCLE[themePreference];
  const records = useMemo(() => Array.from(clients.values()), [clients]);
  const cycleTheme = useCallback(() => onSetTheme(nextTheme), [nextTheme, onSetTheme]);

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
        overscrollBehavior: "contain",
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
          onClick={cycleTheme}
          title={`Theme: ${THEME_LABEL[themePreference]} — click for ${THEME_LABEL[nextTheme]}`}
          aria-label={`Theme: ${THEME_LABEL[themePreference]}. Switch to ${THEME_LABEL[nextTheme]}`}
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            color: C.textMuted,
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 500,
            height: 22,
            lineHeight: 1,
            padding: "0 8px"
          }}
        >
          {THEME_LABEL[themePreference]}
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
            overflowY: isCompact ? "hidden" : undefined,
            overscrollBehavior: "contain"
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
    <button
      type="button"
      className="sse-dt-connection-item"
      onClick={select}
      title={record.url}
      aria-pressed={isSelected}
      style={{
        width: isCompact ? compactWidth : "100%",
        flex: isCompact ? `0 0 ${compactWidth}` : undefined,
        textAlign: "left",
        font: "inherit",
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
          {urlLabel(record.url)}
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
    </button>
  );
});
