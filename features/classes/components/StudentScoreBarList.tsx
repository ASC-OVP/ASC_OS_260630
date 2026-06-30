"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

type ScoreItem = {
  id: string;
  label: string;
  value: number | null;
};

type Props = {
  data: ScoreItem[];
  initialCount?: number;
};

export default function StudentScoreBarList({ data, initialCount = 12 }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (data.length === 0) return <div style={empty}>표시할 점수가 없습니다.</div>;

  const visibleItems = expanded ? data : data.slice(0, initialCount);
  const max = Math.max(...data.map((item) => item.value ?? 0), 1);
  const hasMore = data.length > initialCount;

  return (
    <div style={wrap}>
      <div style={barList}>
        {visibleItems.map((item) => {
          const score = item.value ?? 0;
          return (
            <div key={item.id} style={barRow}>
              <span style={nameText}>{item.label}</span>
              <div style={barTrack}>
                <div style={{ ...barFill, width: `${Math.max(4, (score / max) * 100)}%` }} />
              </div>
              <b style={scoreText}>{score}점</b>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button type="button" onClick={() => setExpanded((current) => !current)} style={moreButton}>
          {expanded ? "접기" : `더보기 ${data.length - initialCount}명`}
        </button>
      )}
    </div>
  );
}

const wrap: CSSProperties = { display: "grid", gap: 9 };
const barList: CSSProperties = { display: "flex", flexDirection: "column", gap: 7 };
const barRow: CSSProperties = { display: "grid", gridTemplateColumns: "72px 1fr 62px", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 850 };
const nameText: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const scoreText: CSSProperties = { color: "#111827", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const barTrack: CSSProperties = { height: 10, background: "#edf0f3", borderRadius: 999, overflow: "hidden" };
const barFill: CSSProperties = { height: "100%", background: "#0b50d0", borderRadius: 999 };
const moreButton: CSSProperties = { justifySelf: "center", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", color: "#111827", padding: "6px 10px", fontSize: 12, fontWeight: 900, cursor: "pointer" };
const empty: CSSProperties = { padding: 22, textAlign: "center", color: "#6b7280", fontWeight: 800 };
