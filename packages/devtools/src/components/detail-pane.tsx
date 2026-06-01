import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DevtoolsClientRecord } from "../registry/types";
import { MAX_EVENTS_LABEL } from "../lib/format";
import { C, S, statusColor, statusLabel } from "../theme/tokens";
import { fmtData, fmtTime } from "../lib/format";
import { Btn } from "./btn";
import { EventRow } from "./event-row";
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
  const [autoScroll, setAutoScroll] = useState(true);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? record.events.filter(
          (e) => e.type.toLowerCase().includes(q) || fmtData(e.data).toLowerCase().includes(q)
        )
      : record.events;
  }, [query, record.events]);

  useEffect(() => {
    if (autoScroll && record.events.length !== prevLenRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevLenRef.current = record.events.length;
  }, [record.events.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setAutoScroll(scrollTop + clientHeight >= scrollHeight - 10);
  }, []);

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
        <div style={{ overflow: "hidden" }}>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 600, ...S.mono, ...S.ellipsis }}>
            {record.url}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <StatusDot status={record.status} size={7} />
            <span style={{ color: statusColor(record.status), fontSize: 11, fontWeight: 500 }}>
              {statusLabel(record.status)}
            </span>
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
            onClick={() => void record.client.connect()}
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
          overflowX: isCompact ? "auto" : undefined,
          padding: isCompact ? "8px 14px" : "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0
        }}
      >
        {(
          [
            ["Events received", record.totalEvents],
            ["In log", record.events.length]
          ] as const
        ).map(([label, val]) => (
          <div
            key={label}
            style={{
              flex: isCompact ? 1 : undefined,
              minWidth: isCompact ? 0 : 118,
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
                fontSize: isCompact ? 16 : 18,
                fontWeight: 600,
                marginTop: 2
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
          padding: isCompact ? "7px 14px" : "8px 16px",
          borderBottom: `1px solid ${C.borderLight}`,
          flexShrink: 0
        }}
      >
        <span style={{ color: C.textMuted, fontWeight: 500, fontSize: 12 }}>
          Events log{" "}
          {record.events.length === MAX_EVENTS_LABEL && (
            <span style={{ color: C.textDim }}>(last {MAX_EVENTS_LABEL})</span>
          )}
        </span>
        <Btn onClick={onClear} style={{ height: isCompact ? 30 : undefined }}>
          Clear
        </Btn>
      </div>

      <div
        style={{
          padding: isCompact ? "7px 14px" : "8px 16px",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by type or payload..."
          style={{
            width: "100%",
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
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}
      >
        {record.events.length === 0 ? (
          <EmptyLog text="No events yet - waiting for the stream..." />
        ) : filtered.length === 0 ? (
          <EmptyLog text={`No events match "${query}".`} />
        ) : (
          filtered.map((entry) => <EventRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
});

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
