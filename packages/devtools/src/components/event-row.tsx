import { memo, useMemo, useState } from "react";
import type { DevtoolsEventEntry } from "../registry/types";
import { C, S } from "../theme/tokens";
import { canExpandData, expandedData, fmtData, fmtTime } from "../lib/format";

type EventRowProps = {
  readonly entry: DevtoolsEventEntry;
};

export const EventRow = memo(function EventRow({ entry }: EventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = canExpandData(entry.data);
  const preview = useMemo(() => fmtData(entry.data), [entry.data]);
  const time = useMemo(() => fmtTime(entry.timestamp), [entry.timestamp]);
  const expandedPayload = useMemo(
    () => (expanded ? expandedData(entry.data) : ""),
    [entry.data, expanded]
  );

  return (
    <div
      style={{
        borderBottom: `1px solid ${C.borderLight}`,
        background: expanded ? C.surface : "transparent"
      }}
    >
      <div
        onClick={() => canExpand && setExpanded((e) => !e)}
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
        <span
          style={{
            background: C.accentBg,
            color: C.text,
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            padding: "2px 7px",
            fontSize: 10,
            ...S.mono,
            flexShrink: 0,
            minWidth: 64,
            textAlign: "center"
          }}
        >
          {entry.type}
        </span>
        <span style={{ color: C.textMuted, fontSize: 12, ...S.mono, ...S.ellipsis }}>
          {preview}
        </span>
        {canExpand && (
          <span
            style={{
              color: C.textMuted,
              fontSize: 10,
              flexShrink: 0,
              marginLeft: "auto",
              paddingLeft: 8
            }}
          >
            {expanded ? "Hide" : "View"}
          </span>
        )}
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
