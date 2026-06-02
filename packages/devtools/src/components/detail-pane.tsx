import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DevtoolsClientRecord, DevtoolsEventEntry } from "../registry/types";
import { C, S, statusColor, statusLabel } from "../theme/tokens";
import { fmtAgo, fmtData, fmtDuration, fmtTime } from "../lib/format";
import { RATE_WINDOW_MS } from "../constants";
import { Btn } from "./btn";
import { EventRow } from "./event-row";
import { RoleBadge } from "./role-badge";
import { StatusDot } from "./status-dot";

type DetailPaneProps = {
  readonly record: DevtoolsClientRecord;
  readonly isCompact: boolean;
  readonly onClear: () => void;
};

export const DetailPane = memo(function DetailPane({
  record,
  isCompact,
  onClear
}: DetailPaneProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(record.events.length);
  const frozenRef = useRef<readonly DevtoolsEventEntry[]>(record.events);
  const frozenTotalRef = useRef(record.totalEvents);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const now = useNow(1000);

  if (!paused) {
    frozenRef.current = record.events;
    frozenTotalRef.current = record.totalEvents;
  }
  const sourceEvents = paused ? frozenRef.current : record.events;
  const bufferedWhilePaused = paused ? record.totalEvents - frozenTotalRef.current : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? sourceEvents.filter(
          (e) => e.type.toLowerCase().includes(q) || fmtData(e.data).toLowerCase().includes(q)
        )
      : sourceEvents;
  }, [query, sourceEvents]);

  useEffect(() => {
    if (paused) return;
    if (autoScroll && filtered.length !== prevLenRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevLenRef.current = filtered.length;
  }, [filtered.length, autoScroll, paused]);

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setAutoScroll(scrollTop + clientHeight >= scrollHeight - 10);
  }, []);

  const togglePause = useCallback(() => setPaused((p) => !p), []);
  const filterByType = useCallback((type: string) => setQuery(type), []);
  const exportLog = useCallback(() => exportEvents(record), [record]);

  const handleClear = useCallback(() => {
    frozenRef.current = [];
    frozenTotalRef.current = 0;
    onClear();
  }, [onClear]);

  const eventsPerSec = useMemo(() => {
    if (record.lastEventAt === null) return 0;
    const since = now - RATE_WINDOW_MS;
    let count = 0;
    for (const t of record.recentEventTimestamps) if (t >= since) count += 1;
    return Math.round((count / (RATE_WINDOW_MS / 1000)) * 10) / 10;
  }, [record.recentEventTimestamps, record.lastEventAt, now]);

  const metrics: ReadonlyArray<readonly [string, string | number, number?]> = [
    ["Events received", record.totalEvents],
    ["Events / sec", eventsPerSec],
    ["Uptime", record.connectedAt ? fmtDuration(record.connectedAt, now) : "—"],
    ["Reconnects", record.reconnectCount],
    ["In log", sourceEvents.length],
    ["Last event", record.lastEventAt ? fmtAgo(record.lastEventAt, now) : "—", 108]
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        className="sse-dt-detail-header"
        style={{
          padding: isCompact ? "10px 14px" : "12px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: isCompact ? "flex-start" : "center",
          justifyContent: "space-between",
          flexDirection: isCompact ? "column" : "row",
          gap: 10,
          flexShrink: 0
        }}
      >
        <div style={{ overflow: "hidden", minWidth: 0 }}>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 600, ...S.mono, ...S.ellipsis }}>
            {record.url}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 6
            }}
          >
            <StatusDot status={record.status} size={7} />
            <span style={{ color: statusColor(record.status), fontSize: 11, fontWeight: 500 }}>
              {statusLabel(record.status)}
            </span>
            <RoleBadge role={record.role} />
            {record.connectedAt && (
              <span style={{ color: C.textDim, fontSize: 11 }}>
                connected {fmtTime(record.connectedAt)}
              </span>
            )}
            <span
              style={{ color: C.textDim, fontSize: 11, ...S.mono }}
              title="Connection key (serialized SSE key)"
            >
              key {record.key}
            </span>
          </div>
        </div>
        <div
          className="sse-dt-detail-actions"
          style={{
            display: "flex",
            gap: 6,
            flexShrink: 0,
            width: isCompact ? "100%" : undefined
          }}
        >
          <Btn
            variant="primary"
            onClick={() => void record.client.connect().catch(() => undefined)}
            style={{ flex: isCompact ? 1 : undefined, height: isCompact ? 30 : undefined }}
          >
            Connect
          </Btn>
          <Btn
            onClick={() => record.client.disconnect()}
            style={{ flex: isCompact ? 1 : undefined, height: isCompact ? 30 : undefined }}
          >
            Disconnect
          </Btn>
        </div>
      </div>

      {record.error && (
        <div
          style={{
            margin: "10px 16px 0",
            padding: "8px 10px",
            background: C.errorBg,
            borderRadius: 6,
            border: `1px solid ${C.error}40`,
            flexShrink: 0
          }}
        >
          <span style={{ color: C.error, fontSize: 11, ...S.mono }}>
            {record.error.kind}: {record.error.message}
            {record.error.status != null && ` (HTTP ${record.error.status})`}
          </span>
        </div>
      )}

      <div
        className="sse-dt-metrics"
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          overscrollBehavior: "contain",
          padding: isCompact ? "8px 14px" : "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0
        }}
      >
        {metrics.map(([label, val, fixedWidth]) => (
          <div
            key={label}
            style={{
              flex: isCompact ? "0 0 auto" : undefined,
              width: fixedWidth,
              minWidth: fixedWidth ?? 92,
              flexShrink: fixedWidth ? 0 : undefined,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: isCompact ? "7px 10px" : "8px 10px",
              background: C.surfaceRaised
            }}
          >
            <div style={{ color: C.textMuted, ...S.caption }}>{label}</div>
            <div
              style={{
                color: C.text,
                fontSize: isCompact ? 15 : 17,
                fontWeight: 600,
                marginTop: 2,
                ...S.mono
              }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: isCompact ? "7px 14px" : "8px 16px",
          borderBottom: `1px solid ${C.borderLight}`,
          flexShrink: 0
        }}
      >
        <span style={{ color: C.textMuted, fontWeight: 500, fontSize: 12 }}>
          Events log{" "}
          {record.totalEvents > sourceEvents.length && (
            <span style={{ color: C.textDim }}>
              (last {sourceEvents.length} of {record.totalEvents})
            </span>
          )}
          {paused && bufferedWhilePaused > 0 && (
            <span style={{ color: C.connecting }}> · {bufferedWhilePaused} new while paused</span>
          )}
        </span>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <Btn
            onClick={togglePause}
            variant={paused ? "primary" : "secondary"}
            style={{ height: isCompact ? 30 : undefined }}
          >
            {paused ? "Resume" : "Pause"}
          </Btn>
          <Btn onClick={exportLog} style={{ height: isCompact ? 30 : undefined }}>
            Export
          </Btn>
          <Btn onClick={handleClear} style={{ height: isCompact ? 30 : undefined }}>
            Clear
          </Btn>
        </div>
      </div>

      <div
        style={{
          padding: isCompact ? "7px 14px" : "8px 16px",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
          display: "flex",
          gap: 6
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by type or payload..."
          aria-label="Filter events"
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            color: C.text,
            fontSize: 12,
            ...S.mono,
            height: 32,
            padding: "0 10px",
            outline: "none"
          }}
        />
        {query && (
          <Btn onClick={() => setQuery("")} style={{ flexShrink: 0 }}>
            Clear filter
          </Btn>
        )}
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain"
        }}
      >
        {sourceEvents.length === 0 ? (
          <EmptyLog text="No events yet - waiting for the stream..." />
        ) : filtered.length === 0 ? (
          <EmptyLog text={`No events match "${query}".`} />
        ) : (
          filtered.map((entry) => (
            <EventRow key={entry.id} entry={entry} onSelectType={filterByType} />
          ))
        )}
      </div>
    </div>
  );
});

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function exportEvents(record: DevtoolsClientRecord): void {
  if (typeof document === "undefined") return;
  const payload = {
    url: record.url,
    key: record.key,
    status: record.status,
    role: record.role,
    totalEvents: record.totalEvents,
    eventsInLog: record.events.length,
    truncated: record.totalEvents > record.events.length,
    exportedAt: new Date().toISOString(),
    events: record.events.map((e) => ({
      type: e.type,
      data: e.data,
      timestamp: new Date(e.timestamp).toISOString()
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sse-events-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function EmptyLog({ text }: { text: string }) {
  return (
    <div style={{ padding: "28px 16px", color: C.textMuted, fontSize: 12, textAlign: "center" }}>
      {text}
    </div>
  );
}

export function EmptyDetail() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: C.textMuted,
        fontSize: 12
      }}
    >
      Select a connection to inspect it
    </div>
  );
}
