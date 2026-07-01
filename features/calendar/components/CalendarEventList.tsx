"use client";

import type { CSSProperties } from "react";
import CalendarEventCard from "@/features/calendar/components/CalendarEventCard";
import { dayLabel, isoDate, weekdayLabel } from "@/features/calendar/lib/calendarFormatters";
import type { CalendarDisplayMode, CalendarViewMode, MaterializedCalendarEvent } from "@/features/calendar/types";

type Props = {
  days: Date[];
  cursorDate: Date;
  viewMode: CalendarViewMode;
  displayMode: CalendarDisplayMode;
  eventsByDate: Map<string, MaterializedCalendarEvent[]>;
  selectedDate: string | null;
  todayKey: string;
  emptyTitle: string;
  emptyDescription: string;
  hasDateMemo: (dateKey: string) => boolean;
  hasEventMemo: (eventKey: string) => boolean;
  onDateSelect: (dateKey: string) => void;
  onEventSelect: (event: MaterializedCalendarEvent) => void;
};

export default function CalendarEventList({
  days,
  cursorDate,
  viewMode,
  displayMode,
  eventsByDate,
  selectedDate,
  todayKey,
  emptyTitle,
  emptyDescription,
  hasDateMemo,
  hasEventMemo,
  onDateSelect,
  onEventSelect,
}: Props) {
  const totalCount = days.reduce((count, day) => count + (eventsByDate.get(isoDate(day))?.length ?? 0), 0);

  if (displayMode === "list") {
    return (
      <div style={agendaWrap}>
        {totalCount === 0 && <EmptyCalendarState title={emptyTitle} description={emptyDescription} />}
        {days.map((day) => {
          const dateKey = isoDate(day);
          const list = eventsByDate.get(dateKey) ?? [];
          if (list.length === 0) return null;

          return (
            <section key={dateKey} style={agendaDay}>
              <button type="button" onClick={() => onDateSelect(dateKey)} style={agendaDate}>
                <b>{dayLabel(day, "day")}</b>
                <span>{weekdayLabel(day)}</span>
              </button>
              <div style={agendaItems}>
                {list.map((event) => (
                  <CalendarEventCard key={event.occurrenceKey} event={event} viewMode="week" hasMemo={hasEventMemo(event.occurrenceKey)} onSelect={onEventSelect} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div style={calendarWrap}>
      <div style={weekdayHeader(viewMode)}>
        {(viewMode === "day" ? days : days.slice(0, 7)).map((day) => (
          <div key={`weekday-${isoDate(day)}`} style={weekdayCell}>
            {weekdayLabel(day)}
          </div>
        ))}
      </div>
      <div style={calendarGrid(viewMode)}>
        {days.map((day) => {
          const dateKey = isoDate(day);
          const list = eventsByDate.get(dateKey) ?? [];
          const isCurrentMonth = day.getMonth() === cursorDate.getMonth();
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const visible = viewMode === "month" ? list.slice(0, 4) : list;
          const hiddenCount = list.length - visible.length;

          return (
            <div
              key={dateKey}
              style={{
                ...dayCell,
                ...(viewMode === "day" ? dayCellLarge : {}),
                ...(!isCurrentMonth && viewMode === "month" ? mutedDayCell : {}),
                ...(isToday ? todayCell : {}),
                ...(isSelected ? selectedCell : {}),
              }}
            >
              <button type="button" onClick={() => onDateSelect(dateKey)} style={dayHeaderButton} aria-label={`${dateKey} 날짜 선택`}>
                <b>{dayLabel(day, viewMode)}</b>
                <span style={dayHeaderMeta}>
                  {hasDateMemo(dateKey) && <span style={memoBadge}>메모</span>}
                </span>
              </button>
              <div style={eventList}>
                {visible.map((event) => (
                  <CalendarEventCard key={event.occurrenceKey} event={event} viewMode={viewMode} hasMemo={hasEventMemo(event.occurrenceKey)} onSelect={onEventSelect} />
                ))}
                {hiddenCount > 0 && (
                  <button type="button" onClick={() => onDateSelect(dateKey)} style={moreButton}>
                    +{hiddenCount}개 더 보기
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {totalCount === 0 && <EmptyCalendarState title={emptyTitle} description={emptyDescription} />}
    </div>
  );
}

function EmptyCalendarState({ title, description }: { title: string; description: string }) {
  return (
    <section style={emptyState}>
      <b>{title}</b>
      <span>{description}</span>
    </section>
  );
}

const calendarWrap: CSSProperties = { display: "grid", gap: 0, position: "relative" };
const weekdayHeader = (viewMode: CalendarViewMode): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: viewMode === "day" ? "1fr" : "repeat(7, minmax(0, 1fr))",
  minWidth: 0,
  borderTop: "1px solid #d1d5db",
  borderLeft: "1px solid #d1d5db",
});
const weekdayCell: CSSProperties = { borderRight: "1px solid #d1d5db", borderBottom: "1px solid #d1d5db", background: "#f8fafc", color: "#64748b", padding: "8px 10px", fontSize: 12, fontWeight: 950 };
const calendarGrid = (viewMode: CalendarViewMode): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: viewMode === "day" ? "1fr" : "repeat(7, minmax(0, 1fr))",
  gap: 0,
  borderLeft: "1px solid #d1d5db",
  minWidth: 0,
});
const dayCell: CSSProperties = {
  borderRight: "1px solid #d1d5db",
  borderBottom: "1px solid #d1d5db",
  background: "#fff",
  minHeight: 128,
  padding: 8,
  display: "grid",
  gridTemplateRows: "auto 1fr",
  gap: 6,
  alignContent: "start",
  minWidth: 0,
};
const dayCellLarge: CSSProperties = { minHeight: 430 };
const mutedDayCell: CSSProperties = { background: "#f8fafc", color: "#94a3b8" };
const todayCell: CSSProperties = { boxShadow: "inset 0 0 0 2px #0b50d0" };
const selectedCell: CSSProperties = { background: "#eff6ff" };
const dayHeaderButton: CSSProperties = { border: 0, background: "transparent", color: "inherit", padding: 0, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", fontSize: 13, cursor: "pointer" };
const dayHeaderMeta: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4 };
const memoBadge: CSSProperties = { borderRadius: 999, background: "#fef3c7", color: "#92400e", padding: "2px 5px", fontSize: 10, fontWeight: 950 };
const eventList: CSSProperties = { display: "grid", gap: 5, alignContent: "start", minWidth: 0 };
const moreButton: CSSProperties = { border: "1px dashed #cbd5e1", borderRadius: 6, background: "#fff", color: "#475569", padding: "5px 6px", fontSize: 11, fontWeight: 900, cursor: "pointer" };
const emptyState: CSSProperties = { border: "1px dashed #cbd5e1", borderRadius: 8, background: "#f8fafc", padding: 14, marginTop: 10, display: "grid", gap: 4, color: "#475569", fontSize: 13 };
const agendaWrap: CSSProperties = { display: "grid", gap: 8 };
const agendaDay: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(104px, 140px) minmax(0, 1fr)", gap: 8, border: "1px solid #dfe3ea", borderRadius: 8, background: "#fff", padding: 8 };
const agendaDate: CSSProperties = { border: 0, background: "#f8fafc", borderRadius: 7, padding: 10, textAlign: "left", display: "grid", gap: 4, color: "#111827", fontWeight: 950, cursor: "pointer" };
const agendaItems: CSSProperties = { display: "grid", gap: 6 };
