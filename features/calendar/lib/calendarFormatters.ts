import type { CalendarViewMode } from "@/features/calendar/types";

export function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfWeek(date: Date) {
  const start = stripTime(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDate(value: string) {
  const [datePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function parseDateTime(value: string) {
  if (!value.includes("T")) return parseDate(value);
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;
  return parseDate(value);
}

export function formatCalendarDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return isoDate(date);
}

export function formatDateShort(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" }).format(date);
}

export function formatDateFull(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(date);
}

export function viewTitle(date: Date, viewMode: CalendarViewMode) {
  if (viewMode === "month") {
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(date);
  }

  if (viewMode === "week") {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    return `${formatDateShort(start)} - ${formatDateShort(end)}`;
  }

  return formatDateFull(date);
}

export function dayLabel(date: Date, viewMode: CalendarViewMode) {
  if (viewMode === "day") return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date);
  if (date.getDate() === 1) return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
  return String(date.getDate());
}

export function weekdayLabel(date: Date) {
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
}

export function displayTimeLabel(startText: string, endText: string, isAllDay?: boolean) {
  if (isAllDay) return "종일";
  if (startText && endText) return `${startText}-${endText}`;
  return startText || endText || "시간 미정";
}

export function timeFromDateTime(value?: string) {
  if (!value) return "";
  const [, timePart] = value.split("T");
  if (!timePart) return "";
  return timePart.slice(0, 5);
}
