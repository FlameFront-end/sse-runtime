import { memo, useCallback, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { DevtoolsEventEntry } from "../registry/types";
import { C, S } from "../theme/tokens";
import { canExpandData, expandedData, fmtData, fmtTime } from "../lib/format";

type EventRowProps = {
  readonly entry: DevtoolsEventEntry;
  readonly onSelectType: (type: string) => void;
};

export const EventRow = memo(function EventRow({ entry, onSelectType }: EventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const canExpand = canExpandData(entry.data);
  const preview = useMemo(() => fmtData(entry.data), [entry.data]);
  const time = useMemo(() => fmtTime(entry.timestamp), [entry.timestamp]);
  const expandedPayload = useMemo(
    () => (expanded ? expandedData(entry.data) : ""),
    [entry.data, expanded]
  );

  const toggle = useCallback(() => {
    if (canExpand) setExpanded((e) => !e);
  }, [canExpand]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!canExpand) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setExpanded((v) => !v);
      }
    },
    [canExpand]
  );

  const selectType = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onSelectType(entry.type);
    },
    [entry.type, onSelectType]
  );

  const copyPayload = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      const text = expandedData(entry.data);
      void navigator.clipboard?.writeText(text).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        },
        () => undefined
      );
    },
    [entry.data]
  );

  return (
    <div
      style={{
        borderBottom: `1px solid ${C.borderLight}`,
        background: expanded ? C.surface : "transparent"
      }}
    >
      <div
        onClick={toggle}
        onKeyDown={onKeyDown}
        role={canExpand ? "button" : undefined}
        tabIndex={canExpand ? 0 : undefined}
        aria-expanded={canExpand ? expanded : undefined}
        style={{
          minHeight: 34,
          padding: "6px 16px",
          cursor: canExpand ? "pointer" : "default",
          display: "flex",
          gap: 8,
          alignItems: "center"
        }}
      >
        <span style={{ color: C.textMuted, fontSize: 11, ...S.mono, flexShrink: 0 }}>{time}</span>
        <button
          type="button"
          className="sse-dt-soft-button"
          onClick={selectType}
          title={`Filter by "${entry.type}"`}
          style={{
            background: C.accentBg,
            color: C.text,
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            padding: "2px 7px",
            fontSize: 10,
            cursor: "pointer",
            ...S.mono,
            flexShrink: 0,
            minWidth: 64,
            textAlign: "center"
          }}
        >
          {entry.type}
        </button>
        <span style={{ color: C.textMuted, fontSize: 12, ...S.mono, ...S.ellipsis }}>
          {preview}
        </span>
        <span style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
          <button
            type="button"
            className="sse-dt-soft-button"
            onClick={copyPayload}
            title="Copy payload"
            style={{
              background: "transparent",
              border: "none",
              color: copied ? C.open : C.textMuted,
              cursor: "pointer",
              fontSize: 10,
              padding: "0 2px"
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          {canExpand && (
            <span style={{ color: C.textMuted, fontSize: 10 }}>{expanded ? "Hide" : "View"}</span>
          )}
        </span>
      </div>

      {expanded && (
        <div
          style={{
            margin: "0 16px 10px",
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.surfaceRaised,
            overflow: "hidden"
          }}
        >
          <pre
            style={{
              margin: 0,
              padding: "12px",
              color: C.text,
              fontSize: 11,
              ...S.mono,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.6
            }}
          >
            {expandedPayload}
          </pre>
        </div>
      )}
    </div>
  );
});
