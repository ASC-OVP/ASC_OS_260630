"use client";

import type { CSSProperties } from "react";
import { eventDisplayCategory, type CalendarEventCategoryTone } from "@/features/calendar/lib/calendarEvents";
import type { CalendarViewMode, MaterializedCalendarEvent } from "@/features/calendar/types";

type Props = {
  event: MaterializedCalendarEvent;
  viewMode: CalendarViewMode;
  hasMemo?: boolean;
  onSelect: (event: MaterializedCalendarEvent) => void;
};

export default function CalendarEventCard({ event, viewMode, hasMemo = false, onSelect }: Props) {
  const category = eventDisplayCategory(event);
  const compact = viewMode === "month";

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      style={{ ...card, ...toneStyle(category.tone), ...(compact ? compactCard : {}) }}
      title={`${category.label} · ${event.title}`}
    >
      <span style={chipRow}>
        <span style={{ ...chip, ...chipTone(category.tone) }}>{category.label}</span>
        {hasMemo && <span style={memoChip}>메모</span>}
      </span>
      <b style={title}>{event.title}</b>
      {!compact && event.ownerLabel && <span style={meta}>{event.ownerLabel}</span>}
    </button>
  );
}

function toneStyle(tone: CalendarEventCategoryTone): CSSProperties {
  if (tone === "red") return { borderColor: "#fecaca", background: "#fff1f2" };
  if (tone === "orange") return { borderColor: "#fed7aa", background: "#fff7ed" };
  if (tone === "green") return { borderColor: "#bbf7d0", background: "#f0fdf4" };
  if (tone === "purple") return { borderColor: "#ddd6fe", background: "#f5f3ff" };
  if (tone === "amber") return { borderColor: "#fde68a", background: "#fffbeb" };
  if (tone === "teal") return { borderColor: "#99f6e4", background: "#f0fdfa" };
  return { borderColor: "#bfdbfe", background: "#eff6ff" };
}

function chipTone(tone: CalendarEventCategoryTone): CSSProperties {
  if (tone === "red") return { color: "#b91c1c", background: "#fee2e2" };
  if (tone === "orange") return { color: "#9a3412", background: "#ffedd5" };
  if (tone === "green") return { color: "#166534", background: "#dcfce7" };
  if (tone === "purple") return { color: "#6d28d9", background: "#ede9fe" };
  if (tone === "amber") return { color: "#92400e", background: "#fef3c7" };
  if (tone === "teal") return { color: "#0f766e", background: "#ccfbf1" };
  return { color: "#0b50d0", background: "#dbeafe" };
}

const card: CSSProperties = {
  width: "100%",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#bfdbfe",
  borderRadius: 6,
  padding: "5px 6px",
  display: "grid",
  gap: 2,
  textAlign: "left",
  cursor: "pointer",
  color: "#111827",
  minWidth: 0,
};
const compactCard: CSSProperties = { padding: "4px 5px", gap: 2 };
const chipRow: CSSProperties = { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", minWidth: 0 };
const chip: CSSProperties = { borderRadius: 4, padding: "2px 5px", fontSize: 10, fontWeight: 900, lineHeight: 1.2 };
const memoChip: CSSProperties = { ...chip, color: "#92400e", background: "#fef3c7" };
const title: CSSProperties = { fontSize: 12, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" };
const meta: CSSProperties = { color: "#64748b", fontSize: 10, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
