"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import CalendarEventList from "@/features/calendar/components/CalendarEventList";
import CalendarMemoPanel from "@/features/calendar/components/CalendarMemoPanel";
import CalendarToolbar from "@/features/calendar/components/CalendarToolbar";
import { calendarEmptyState, defaultCalendarFilters, filterCalendarEvents } from "@/features/calendar/lib/calendarFilters";
import { addDays, addMonths, isoDate, stripTime, viewTitle } from "@/features/calendar/lib/calendarFormatters";
import { daysForView, groupEventsByDate, materializeEvents, summarizeEvents } from "@/features/calendar/lib/calendarEvents";
import type {
  AcademyCalendarEvent,
  CalendarDisplayMode,
  CalendarEventMemoView,
  CalendarFilterOption,
  CalendarFilterValue,
  CalendarViewMode,
  MaterializedCalendarEvent,
} from "@/features/calendar/types";

type Props = {
  events: AcademyCalendarEvent[];
  staffOptions: CalendarFilterOption[];
  canViewStaffCalendars: boolean;
  privateMemos?: Array<{ date: string; content: string }>;
  eventMemos?: CalendarEventMemoView[];
  activeClassCount: number;
  currentUserId: string;
};

export default function AcademyCalendar({
  events,
  staffOptions,
  canViewStaffCalendars,
  privateMemos = [],
  eventMemos = [],
  activeClassCount,
  currentUserId,
}: Props) {
  const [filters, setFilters] = useState<CalendarFilterValue>(() => defaultCalendarFilters());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>("calendar");
  const [cursorDate, setCursorDate] = useState(() => stripTime(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<MaterializedCalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const memoByDate = useMemo(() => new Map(privateMemos.map((memo) => [memo.date, memo.content])), [privateMemos]);
  const eventMemoByKey = useMemo(() => new Map(eventMemos.map((memo) => [memo.eventKey, memo])), [eventMemos]);
  const todayKey = isoDate(new Date());
  const canShowPrivateMemos = filters.staffId === "all" || filters.staffId === currentUserId;

  const memoEvents = useMemo(
    () => (canShowPrivateMemos ? privateMemos.map((memo) => memoAsEvent(memo, currentUserId)) : []),
    [canShowPrivateMemos, currentUserId, privateMemos]
  );
  const allEvents = useMemo(() => [...events, ...memoEvents], [events, memoEvents]);
  const filteredEvents = useMemo(() => filterCalendarEvents(allEvents, filters), [allEvents, filters]);
  const days = useMemo(() => daysForView(cursorDate, viewMode), [cursorDate, viewMode]);
  const materializedEvents = useMemo(() => materializeEvents(filteredEvents, days), [days, filteredEvents]);
  const eventsByDate = useMemo(() => groupEventsByDate(materializedEvents), [materializedEvents]);
  const summary = useMemo(() => summarizeEvents(materializedEvents, activeClassCount), [activeClassCount, materializedEvents]);
  const emptyState = calendarEmptyState(filters);
  const rangeLabel = viewTitle(cursorDate, viewMode);

  function move(amount: number) {
    setCursorDate((current) => {
      if (viewMode === "month") return addMonths(current, amount);
      if (viewMode === "week") return addDays(current, amount * 7);
      return addDays(current, amount);
    });
  }

  function openEvent(event: MaterializedCalendarEvent) {
    if (event.source === "calendar_private_memo") {
      setSelectedDate(event.dateKey);
      setSelectedEvent(null);
      return;
    }

    setSelectedEvent(event);
    setSelectedDate(null);
  }

  function openDate(dateKey: string) {
    setSelectedDate(dateKey);
    setSelectedEvent(null);
  }

  function applyFilters(nextFilters: CalendarFilterValue) {
    setFilters(nextFilters);
    setSelectedEvent(null);
    setSelectedDate(null);
  }

  const selectedMemo = selectedEvent ? eventMemoByKey.get(selectedEvent.occurrenceKey) : undefined;
  const selectedDateMemo = selectedDate ? memoByDate.get(selectedDate) ?? "" : "";

  return (
    <div style={shell}>
      <div style={header}>
        <div style={headerLayout}>
          <div style={headerText}>
            <p style={eyebrow}>캘린더</p>
            <h1 style={pageTitle}>운영 일정 캘린더</h1>
            <p style={pageDescription}>수업, 업무, 조교 출근, 메모 일정을 한 화면에서 확인합니다.</p>
          </div>
          <div style={summaryStrip} aria-label="캘린더 요약">
            {summary.map((item) => (
              <span key={item.label} style={{ ...summaryStat, ...(item.tone === "danger" ? summaryStatDanger : {}) }}>
                <span>{item.label}</span>
                <b>{item.value}</b>
              </span>
            ))}
          </div>
        </div>
      </div>

      <section style={contentGrid}>
        <div style={leftColumn}>
          <CalendarToolbar
            filters={filters}
            viewMode={viewMode}
            displayMode={displayMode}
            staffOptions={staffOptions}
            canViewStaffCalendars={canViewStaffCalendars}
            onFilterChange={applyFilters}
            onViewModeChange={(mode) => {
              setViewMode(mode);
              setSelectedEvent(null);
            }}
            onDisplayModeChange={(mode) => {
              setDisplayMode(mode);
              setSelectedEvent(null);
            }}
          />

          <div style={calendarCard}>
            <div style={calendarControls}>
              <div style={navGroup}>
                <button type="button" onClick={() => move(-1)} style={navButton} aria-label="이전 기간">‹</button>
                <button
                  type="button"
                  onClick={() => {
                    setCursorDate(stripTime(new Date()));
                    setSelectedDate(todayKey);
                    setSelectedEvent(null);
                  }}
                  style={navButton}
                >
                  오늘
                </button>
                <button type="button" onClick={() => move(1)} style={navButton} aria-label="다음 기간">›</button>
              </div>
              <h2 style={calendarTitle}>{rangeLabel}</h2>
              <span style={eventCount}>{materializedEvents.length}개 항목</span>
            </div>

            <CalendarEventList
              days={days}
              cursorDate={cursorDate}
              viewMode={viewMode}
              displayMode={displayMode}
              eventsByDate={eventsByDate}
              selectedDate={selectedDate}
              todayKey={todayKey}
              emptyTitle={emptyState.title}
              emptyDescription={emptyState.description}
              hasDateMemo={(dateKey) => canShowPrivateMemos && filters.contentTypes.includes("private_memo") && memoByDate.has(dateKey)}
              hasEventMemo={(eventKey) => eventMemoByKey.has(eventKey)}
              onDateSelect={openDate}
              onEventSelect={openEvent}
            />
          </div>
        </div>

        <aside style={sidePanel}>
          <CalendarMemoPanel
            selectedEvent={selectedEvent}
            selectedDate={selectedDate}
            dateMemo={selectedDateMemo}
            eventMemo={selectedMemo}
          />
        </aside>
      </section>
    </div>
  );
}

export type { AcademyCalendarEvent };

function memoAsEvent(memo: { date: string; content: string }, currentUserId: string): AcademyCalendarEvent {
  return {
    id: `private-memo-${memo.date}`,
    sourceKey: memo.date,
    occurrenceKey: `private-memo-${memo.date}`,
    source: "calendar_private_memo",
    status: "scheduled",
    severity: "normal",
    title: "작성한 메모",
    description: memo.content,
    startAt: memo.date,
    isAllDay: true,
    ownerLabel: "내 메모",
    ownerIds: [currentUserId],
  };
}

const shell: CSSProperties = { display: "grid", gap: 10 };
const header: CSSProperties = {
  border: "1px solid var(--asc-border)",
  borderRadius: "var(--asc-radius-lg)",
  background: "var(--asc-surface)",
  padding: 12,
};
const headerLayout: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, minHeight: 82 };
const headerText: CSSProperties = { minWidth: 0, flex: "1 1 auto" };
const eyebrow: CSSProperties = { margin: "0 0 5px", color: "var(--asc-primary)", fontSize: 12, fontWeight: 900 };
const pageTitle: CSSProperties = { margin: 0, color: "var(--asc-text)", fontSize: 28, lineHeight: 1.15, fontWeight: 950, letterSpacing: 0 };
const pageDescription: CSSProperties = { margin: "7px 0 0", color: "var(--asc-text-muted)", fontSize: 13, lineHeight: 1.35 };
const summaryStrip: CSSProperties = { display: "flex", alignItems: "stretch", justifyContent: "flex-end", flexWrap: "wrap", gap: 0, flex: "0 1 auto" };
const summaryStat: CSSProperties = { display: "inline-flex", alignItems: "baseline", gap: 7, padding: "0 18px", borderLeft: "1px solid var(--asc-border-strong)", color: "var(--asc-text-muted)", fontSize: 14, fontWeight: 850, lineHeight: 1.2, whiteSpace: "nowrap" };
const summaryStatDanger: CSSProperties = { color: "#991b1b" };
const contentGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 10, alignItems: "start" };
const leftColumn: CSSProperties = { minWidth: 0, display: "grid", gap: 10 };
const calendarCard: CSSProperties = { minWidth: 0, minHeight: 0, border: "1px solid #dfe3ea", borderRadius: 8, background: "#fff", padding: 10, overflow: "visible" };
const calendarControls: CSSProperties = { display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", alignItems: "center", gap: 8, marginBottom: 8 };
const navGroup: CSSProperties = { display: "inline-flex", gap: 4 };
const navButton: CSSProperties = { height: 30, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", padding: "0 10px", fontSize: 12, fontWeight: 950, cursor: "pointer" };
const calendarTitle: CSSProperties = { margin: 0, textAlign: "center", fontSize: 17, fontWeight: 950 };
const eventCount: CSSProperties = { color: "#111827", fontWeight: 950, fontSize: 12 };
const sidePanel: CSSProperties = { position: "sticky", top: 10 };
