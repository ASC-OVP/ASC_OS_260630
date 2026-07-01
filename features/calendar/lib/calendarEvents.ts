import { CALENDAR_EVENT_SOURCE_META } from "@/features/calendar/constants";
import { addDays, displayTimeLabel, isoDate, parseDate, startOfWeek, stripTime, timeFromDateTime } from "@/features/calendar/lib/calendarFormatters";
import type { AcademyCalendarEvent, CalendarEventSource, CalendarEventStatus, CalendarSeverity, CalendarViewMode, MaterializedCalendarEvent } from "@/features/calendar/types";

export type CalendarEventCategoryTone = "blue" | "amber" | "purple" | "green" | "red" | "orange" | "teal";

export const CALENDAR_EVENT_CATEGORY_ITEMS: Array<{ label: string; tone: CalendarEventCategoryTone }> = [
  { label: "수업", tone: "blue" },
  { label: "해야할 일", tone: "amber" },
  { label: "진행 중", tone: "purple" },
  { label: "완료", tone: "green" },
  { label: "지연", tone: "red" },
  { label: "메모", tone: "orange" },
  { label: "출근", tone: "teal" },
];

export function calendarEventKey(type: CalendarEventSource, id: string) {
  return `${type}:${id}`;
}

export function calendarOccurrenceKey(type: CalendarEventSource, id: string, dateKey: string) {
  return `${calendarEventKey(type, id)}:${dateKey}`;
}

export function daysForView(cursor: Date, viewMode: CalendarViewMode) {
  if (viewMode === "day") return [stripTime(cursor)];
  if (viewMode === "week") {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function materializeEvents(events: AcademyCalendarEvent[], days: Date[]) {
  if (days.length === 0) return [];

  const rangeStart = stripTime(days[0]);
  const rangeEnd = stripTime(days[days.length - 1]);
  const result: MaterializedCalendarEvent[] = [];

  for (const event of events) {
    if (event.repeatDaysOfWeek?.length) {
      const startRecur = event.startRecur ? parseDate(event.startRecur) : rangeStart;
      const endRecur = event.endRecur ? parseDate(event.endRecur) : rangeEnd;

      for (const day of days) {
        if (day < startRecur || day > endRecur) continue;
        if (!event.repeatDaysOfWeek.includes(day.getDay())) continue;

        const dateKey = isoDate(day);
        result.push(materializedEvent(event, dateKey, event.startTime || "", event.endTime || ""));
      }
      continue;
    }

    const startDate = parseDate(event.startAt);
    const endDate = event.endAt ? parseDate(event.endAt) : startDate;
    const start = startDate < rangeStart ? rangeStart : startDate;
    const end = endDate > rangeEnd ? rangeEnd : endDate;

    for (let day = stripTime(start); day <= end; day = addDays(day, 1)) {
      const dateKey = isoDate(day);
      result.push(materializedEvent(event, dateKey, timeFromDateTime(event.startAt), timeFromDateTime(event.endAt)));
    }
  }

  return result.sort(compareMaterializedEvents);
}

export function groupEventsByDate(events: MaterializedCalendarEvent[]) {
  const map = new Map<string, MaterializedCalendarEvent[]>();
  for (const event of events) {
    const list = map.get(event.dateKey) ?? [];
    list.push(event);
    map.set(event.dateKey, list);
  }

  for (const list of map.values()) {
    list.sort(compareMaterializedEvents);
  }

  return map;
}

export function summarizeEvents(events: MaterializedCalendarEvent[], activeClassCount: number) {
  const classCount = events.filter((event) => event.source === "class_session").length;
  const taskCount = events.filter((event) => event.source === "internal_task").length;
  const workCount = events.filter((event) => event.source === "assistant_work_shift").length;
  const memoCount = events.filter((event) => event.source === "calendar_private_memo").length;
  const delayedCount = events.filter((event) => event.status === "delayed").length;

  return [
    { label: "표시 항목", value: `${events.length}개`, tone: "default" as const },
    { label: "수업", value: `${classCount}개`, tone: "default" as const },
    { label: "해야할 일", value: `${taskCount}개`, tone: "default" as const },
    { label: "출근", value: `${workCount}개`, tone: "default" as const },
    { label: "메모", value: `${memoCount}개`, tone: "default" as const },
    { label: "지연", value: `${delayedCount}개`, tone: delayedCount ? ("danger" as const) : ("default" as const) },
    { label: "운영중 반 전체", value: `${activeClassCount}개`, tone: "default" as const },
  ];
}

export function statusFromTask(status: string, dueDate: Date | null): CalendarEventStatus {
  if (status === "DONE") return "completed";
  if (status === "OVERDUE") return "delayed";
  if (dueDate && dueDate.getTime() < Date.now()) return "delayed";
  if (status === "IN_PROGRESS") return "in_progress";
  if (status === "HOLD" || status === "REVIEW" || status === "SUBMITTED" || status === "REJECTED") return "needs_review";
  return "scheduled";
}

export function severityFromTask(status: CalendarEventStatus, priority?: string | null): CalendarSeverity {
  if (status === "delayed") return "critical";
  if (priority === "URGENT") return "critical";
  if (priority === "HIGH" || status === "needs_review") return "warning";
  if (status === "completed") return "resolved";
  return "normal";
}

export function statusFromClass(status: string): CalendarEventStatus {
  if (status === "PAUSED") return "cancelled";
  if (status === "ENDED") return "cancelled";
  return "scheduled";
}

export function severityFromClass(status: CalendarEventStatus): CalendarSeverity {
  if (status === "cancelled") return "inactive";
  return "normal";
}

export function eventTone(event: AcademyCalendarEvent | MaterializedCalendarEvent) {
  if (event.status === "delayed" || event.severity === "critical") return "red";
  if (event.status === "needs_review" || event.severity === "warning") return "orange";
  if (event.status === "completed" || event.severity === "resolved") return "green";
  if (event.source === "calendar_private_memo") return "orange";
  if (event.source === "assistant_work_shift") return "green";
  if (event.source === "class_session") return "blue";
  if (event.source === "internal_task") return "cyan";
  return CALENDAR_EVENT_SOURCE_META[event.source].tone;
}

export function eventDisplayCategory(event: AcademyCalendarEvent | MaterializedCalendarEvent) {
  if (event.source === "class_session") return { label: "수업", tone: "blue" as const };
  if (event.source === "assistant_work_shift") return { label: "출근", tone: "teal" as const };
  if (event.source === "calendar_private_memo") return { label: "메모", tone: "orange" as const };
  if (event.status === "delayed") return { label: "지연", tone: "red" as const };
  if (event.status === "completed") return { label: "완료", tone: "green" as const };
  if (event.status === "in_progress") return { label: "진행 중", tone: "purple" as const };
  return { label: "해야할 일", tone: "amber" as const };
}

function materializedEvent(event: AcademyCalendarEvent, dateKey: string, startText: string, endText: string): MaterializedCalendarEvent {
  const occurrenceKey = event.occurrenceKey?.endsWith(`-${dateKey}`) ? event.occurrenceKey : `${event.id}-${dateKey}`;
  const displayTime = displayTimeLabel(startText, endText, event.isAllDay);

  return {
    ...event,
    occurrenceKey,
    dateKey,
    startText,
    endText,
    displayTime,
  };
}

function compareMaterializedEvents(a: MaterializedCalendarEvent, b: MaterializedCalendarEvent) {
  if (a.source !== b.source) {
    if (a.source === "class_session") return -1;
    if (b.source === "class_session") return 1;
  }
  return a.displayTime.localeCompare(b.displayTime) || a.title.localeCompare(b.title, "ko-KR");
}
