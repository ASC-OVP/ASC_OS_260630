import { CALENDAR_CONTENT_FILTERS, CALENDAR_DEFAULT_FILTERS } from "@/features/calendar/constants";
import type { AcademyCalendarEvent, CalendarContentFilter, CalendarFilterValue } from "@/features/calendar/types";

export function defaultCalendarFilters(): CalendarFilterValue {
  return {
    contentTypes: [...CALENDAR_DEFAULT_FILTERS.contentTypes],
    staffId: CALENDAR_DEFAULT_FILTERS.staffId,
  };
}

export function filterCalendarEvents(events: AcademyCalendarEvent[], filters: CalendarFilterValue) {
  const enabledTypes = new Set(filters.contentTypes);

  return events.filter((event) => {
    if (!enabledTypes.has(contentTypeForEvent(event))) return false;

    if (filters.staffId !== "all") {
      if (event.source === "calendar_private_memo") return false;

      const staffMatch =
        event.ownerIds?.includes(filters.staffId) ||
        event.assistantId === filters.staffId ||
        event.assigneeId === filters.staffId ||
        event.assigneeIds?.includes(filters.staffId) ||
        event.teacherId === filters.staffId;

      if (!staffMatch) return false;
    }

    return true;
  });
}

export function contentTypeForEvent(event: AcademyCalendarEvent): CalendarContentFilter {
  if (event.source === "assistant_work_shift") return "assistant_work_shift";
  if (event.source === "calendar_private_memo") return "private_memo";
  return "lesson_schedule";
}

export function toggleContentType(filters: CalendarFilterValue, contentType: CalendarContentFilter): CalendarFilterValue {
  const next = filters.contentTypes.includes(contentType)
    ? filters.contentTypes.filter((item) => item !== contentType)
    : [...filters.contentTypes, contentType];

  return { ...filters, contentTypes: next };
}

export function calendarEmptyState(filters: CalendarFilterValue) {
  if (filters.contentTypes.length === 0) {
    return {
      title: "표시할 일정 유형이 선택되지 않았습니다.",
      description: "회차 일정, 조교 출근 일정, 작성한 메모 중 하나 이상을 선택해 주세요.",
    };
  }

  if (filters.contentTypes.length === 1) {
    const meta = CALENDAR_CONTENT_FILTERS.find((item) => item.id === filters.contentTypes[0]);
    return {
      title: `${meta?.label ?? "선택한 유형"}이 없습니다.`,
      description: "선택한 기간이나 직원 화면을 바꾸면 다른 결과를 볼 수 있습니다.",
    };
  }

  return {
    title: "선택한 기간에 표시할 항목이 없습니다.",
    description: "기간을 이동하거나 필터 선택을 조정해 주세요.",
  };
}
