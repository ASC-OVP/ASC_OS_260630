import type { SheetCustomColumn } from "@/lib/studentSheetCustomColumns";
import type {
  InsertedLesson,
  Lesson,
  LessonClassGroupOption,
  LessonTimeOverride,
} from "@/features/students/lib/studentLessonSpreadsheetTypes";
import {
  addDays,
  DEFAULT_MAX_GENERATED_LESSONS,
  firstUpcomingClassDate,
  formatDateInput,
  parseDaysOfWeek,
  parseLocalDate,
} from "@/features/classes/lib/lessonScheduleCore";

export { addDays, formatDateInput, parseLocalDate };

export const fallbackLessonCount = 12;
export const maxGeneratedLessons = DEFAULT_MAX_GENERATED_LESSONS;

export function buildLessonsForClass(classGroup: LessonClassGroupOption | null, extraCount: number, customColumns: SheetCustomColumn[]) {
  const scheduled = classGroup ? scheduledLessons(classGroup) : [];
  const stored = storedLessons(classGroup);
  const storedByPosition = new Map(stored.map((lesson) => [lesson.index, lesson]));
  const storedMaxPosition = stored.length > 0 ? Math.max(...stored.map((lesson) => lesson.index)) : 0;
  const generatedBaseCount = scheduled.length || fallbackLessonCount;
  const baseCount = Math.max(storedMaxPosition, generatedBaseCount);
  const baseLessons = scheduled.length > 0 ? scheduled.slice(0, baseCount) : fallbackLessons(baseCount, classGroup ? "manual" : "fallback");
  const totalCount = Math.min(maxGeneratedLessons, baseCount + extraCount);
  const lessons: Lesson[] = [];

  for (let index = 1; index <= totalCount; index += 1) {
    lessons.push(storedByPosition.get(index) ?? baseLessons[index - 1] ?? manualLesson(index, classGroup, customColumns));
  }

  for (const storedLesson of stored) {
    if (storedLesson.index > totalCount) lessons.push(storedLesson);
  }

  return lessons.sort((a, b) => a.index - b.index);
}

export function mergeInsertedLessons(baseLessons: Lesson[], insertedLessons: InsertedLesson[]) {
  if (insertedLessons.length === 0) return baseLessons;
  const byAfter = new Map<string | null, InsertedLesson[]>();
  for (const lesson of insertedLessons) {
    const key = lesson.afterId || null;
    byAfter.set(key, [...(byAfter.get(key) ?? []), lesson]);
  }
  for (const [key, group] of byAfter) {
    byAfter.set(key, [...group].sort((a, b) => a.createdAt - b.createdAt));
  }

  const result: Lesson[] = [];
  const visited = new Set<string>();
  const appendInserted = (afterId: string | null) => {
    for (const inserted of byAfter.get(afterId) ?? []) {
      if (visited.has(inserted.id)) continue;
      visited.add(inserted.id);
      result.push({
        id: inserted.id,
        index: inserted.index,
        defaultLabel: inserted.label,
        date: inserted.date || undefined,
        dateLabel: inserted.date ? formatShortDateFromInput(inserted.date) : "날짜 미정",
        scheduleLabel: inserted.startTime || inserted.endTime ? `${inserted.startTime || "--:--"}-${inserted.endTime || "--:--"}` : "",
        startTime: inserted.startTime || undefined,
        endTime: inserted.endTime || undefined,
        memo: inserted.memo || undefined,
        source: "manual",
      });
      appendInserted(inserted.id);
    }
  };

  appendInserted(null);
  for (const lesson of baseLessons) {
    result.push(lesson);
    appendInserted(lesson.id);
  }
  for (const inserted of insertedLessons) {
    if (!visited.has(inserted.id)) appendInserted(inserted.afterId);
  }
  return result;
}

export function applyLessonOverrides(
  lessons: Lesson[],
  dateOverrides: Record<string, string>,
  timeOverrides: Record<string, LessonTimeOverride>,
  memoOverrides: Record<string, string>
) {
  return lessons.map((lesson) => {
    const hasDate = Object.prototype.hasOwnProperty.call(dateOverrides, lesson.id);
    const hasTime = Object.prototype.hasOwnProperty.call(timeOverrides, lesson.id);
    const hasMemo = Object.prototype.hasOwnProperty.call(memoOverrides, lesson.id);
    if (!hasDate && !hasTime && !hasMemo) return lesson;

    const date = hasDate ? dateOverrides[lesson.id] : lesson.date ?? "";
    const time = hasTime ? timeOverrides[lesson.id] : { startTime: lesson.startTime ?? "", endTime: lesson.endTime ?? "" };
    const memo = hasMemo ? memoOverrides[lesson.id] : lesson.memo ?? "";

    return {
      ...lesson,
      date: date || undefined,
      dateLabel: date ? formatShortDateFromInput(date) : "날짜 미정",
      startTime: time.startTime || undefined,
      endTime: time.endTime || undefined,
      scheduleLabel: time.startTime || time.endTime ? `${time.startTime || "--:--"}-${time.endTime || "--:--"}` : "",
      memo,
    };
  });
}

export function lessonId(index: number) {
  return `lesson_${index}`;
}

export function legacyLessonId(index: number) {
  return `lesson_${index}`;
}

function storedLessons(classGroup: LessonClassGroupOption | null): Lesson[] {
  const stored = classGroup?.lessons ?? [];
  const fallbackStartTime = classGroup?.startTime ?? undefined;
  const fallbackEndTime = classGroup?.endTime ?? undefined;
  return [...stored]
    .sort((a, b) => a.position - b.position)
    .map((lesson) => {
      const startTime = lesson.startTime ?? fallbackStartTime;
      const endTime = lesson.endTime ?? fallbackEndTime;
      return {
        id: lesson.id,
        index: lesson.position,
        defaultLabel: lesson.title,
        date: lesson.lessonDate ?? undefined,
        dateLabel: lesson.lessonDate ? formatShortDateFromInput(lesson.lessonDate) : "날짜 미정",
        scheduleLabel: startTime || endTime ? `${startTime || "--:--"}-${endTime || "--:--"}` : "",
        startTime,
        endTime,
        memo: lesson.memo ?? undefined,
        source: "schedule" as const,
      };
    });
}

function scheduledLessons(classGroup: LessonClassGroupOption): Lesson[] {
  const days = parseDaysOfWeek(classGroup.daysOfWeek, classGroup.schedule);
  const start = parseLocalDate(classGroup.startDate) ?? firstUpcomingClassDate(days);
  const end = parseLocalDate(classGroup.endDate) ?? addDays(start, 90);
  if (!start || !end || days.length === 0) return [];

  const daySet = new Set(days);
  const lessons: Lesson[] = [];
  const scheduleLabel = classGroup.startTime || classGroup.endTime ? `${classGroup.startTime || "--:--"}-${classGroup.endTime || "--:--"}` : "";

  for (let cursor = start; cursor <= end && lessons.length < maxGeneratedLessons; cursor = addDays(cursor, 1)) {
    if (!daySet.has(cursor.getDay())) continue;
    const index = lessons.length + 1;
    lessons.push({
      id: lessonId(index),
      index,
      defaultLabel: `${index}차시`,
      date: formatDateInput(cursor),
      dateLabel: formatShortDate(cursor),
      scheduleLabel,
      startTime: classGroup.startTime ?? undefined,
      endTime: classGroup.endTime ?? undefined,
      source: "schedule",
    });
  }

  return lessons;
}

function fallbackLessons(count: number, source: Lesson["source"]): Lesson[] {
  return Array.from({ length: count }, (_, index) => {
    const lessonIndex = index + 1;
    return {
      id: lessonId(lessonIndex),
      index: lessonIndex,
      defaultLabel: `${lessonIndex}차시`,
      dateLabel: "날짜 미정",
      scheduleLabel: "",
      source,
    };
  });
}

function manualLesson(index: number, classGroup: LessonClassGroupOption | null, customColumns: SheetCustomColumn[]): Lesson {
  const fallbackStartTime = classGroup?.startTime ?? "";
  const fallbackEndTime = classGroup?.endTime ?? "";
  return {
    id: lessonId(index),
    index,
    defaultLabel: customColumns.find((column) => column.id === legacyLessonId(index))?.label || `${index}차시`,
    dateLabel: "날짜 미정",
    scheduleLabel: fallbackStartTime || fallbackEndTime ? `${fallbackStartTime || "--:--"}-${fallbackEndTime || "--:--"}` : "",
    startTime: fallbackStartTime || undefined,
    endTime: fallbackEndTime || undefined,
    source: "manual",
  };
}

function formatShortDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatShortDateFromInput(value: string) {
  const date = parseLocalDate(value);
  return date ? formatShortDate(date) : value;
}
