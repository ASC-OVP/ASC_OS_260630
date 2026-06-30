export type LessonScheduleSource = {
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  schedule?: string | null;
};

export type StoredLessonLike = {
  id: string;
  position: number;
  title: string;
  lessonDate: string | null;
};

export type LessonCandidate = {
  id: string | null;
  position: number;
  title: string;
  lessonDate: string | null;
  startTime: string | null;
  endTime: string | null;
};

export const DEFAULT_MAX_GENERATED_LESSONS = 80;

export function lessonPositionFromKey(value: string | null | undefined, max = DEFAULT_MAX_GENERATED_LESSONS) {
  if (!value) return null;
  const match = /^(?:lesson_|generated_)?(\d{1,3})$/.exec(value);
  if (!match) return null;
  const position = Number(match[1]);
  return Number.isInteger(position) && position >= 1 && position <= max ? position : null;
}

export function storedLessonCandidate(lesson: StoredLessonLike): LessonCandidate {
  return {
    id: lesson.id,
    position: lesson.position,
    title: lesson.title,
    lessonDate: lesson.lessonDate,
    startTime: null,
    endTime: null,
  };
}

export function resolveLessonCandidate(
  classGroup: LessonScheduleSource & { lessons: StoredLessonLike[] },
  lessonId: string | null | undefined,
  lessonPosition?: number | null,
  max = DEFAULT_MAX_GENERATED_LESSONS
) {
  const requestedPosition = lessonPosition ?? lessonPositionFromKey(lessonId, max);
  const storedLesson =
    (lessonId ? classGroup.lessons.find((lesson) => lesson.id === lessonId) ?? null : null) ??
    (requestedPosition ? classGroup.lessons.find((lesson) => lesson.position === requestedPosition) ?? null : null);

  if (storedLesson) return storedLessonCandidate(storedLesson);
  if (!requestedPosition) return null;

  const lessonDate = generatedLessonDates(classGroup, max).get(requestedPosition) ?? null;
  return {
    id: null,
    position: requestedPosition,
    title: `${requestedPosition}차시`,
    lessonDate,
    startTime: classGroup.startTime ?? null,
    endTime: classGroup.endTime ?? null,
  } satisfies LessonCandidate;
}

export function generatedLessonDates(classGroup: LessonScheduleSource, max = DEFAULT_MAX_GENERATED_LESSONS) {
  const days = parseDaysOfWeek(classGroup.daysOfWeek, classGroup.schedule);
  const start = parseLocalDate(classGroup.startDate) ?? firstUpcomingClassDate(days);
  const end = parseLocalDate(classGroup.endDate) ?? addDays(start, 90);
  const lessons = new Map<number, string | null>();
  if (!start || !end || days.length === 0) return lessons;

  const daySet = new Set(days);
  for (let cursor = start; cursor <= end && lessons.size < max; cursor = addDays(cursor, 1)) {
    if (!daySet.has(cursor.getDay())) continue;
    lessons.set(lessons.size + 1, formatDateInput(cursor));
  }
  return lessons;
}

export function parseDaysOfWeek(daysOfWeek?: string | null, schedule?: string | null) {
  const source = `${daysOfWeek ?? ""} ${schedule ?? ""}`;
  const days = new Set<number>();
  const koreanDayMap: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

  for (const char of source) {
    if (char in koreanDayMap) days.add(koreanDayMap[char]);
  }

  const tokenMap: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };

  for (const token of source.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    if (token in tokenMap) days.add(tokenMap[token]);
    const numeric = Number(token);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) days.add(numeric);
  }

  return [...days].sort((a, b) => a - b);
}

export function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addDays(date: Date | null, days: number) {
  const base = date ? new Date(date) : new Date();
  base.setDate(base.getDate() + days);
  return base;
}

export function firstUpcomingClassDate(days: number[]) {
  if (days.length === 0) return null;
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = addDays(base, offset);
    if (days.includes(candidate.getDay())) return candidate;
  }
  return base;
}

export function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
