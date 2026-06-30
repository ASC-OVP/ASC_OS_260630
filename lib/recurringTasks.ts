import { Prisma, TaskStatus } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

type RecurringTaskSeed = {
  id: string;
  academyId: string;
  title: string;
  description: string | null;
  type: string;
  assigneeId: string;
  creatorId: string;
  studentId: string | null;
  classGroupId: string | null;
  priority: string;
  recurrenceType: string;
  daysOfWeek: string | null;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  dueTime: string | null;
};

const recurringChecklistMarker = "\n\n---ASC_RECURRING_CHECKLIST---\n";

export const weekdayOptions = [
  { value: "1", label: "월" },
  { value: "2", label: "화" },
  { value: "3", label: "수" },
  { value: "4", label: "목" },
  { value: "5", label: "금" },
  { value: "6", label: "토" },
  { value: "0", label: "일" },
];

export function parseDaysOfWeek(value: string | null | undefined) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );
}

export function recurringTypeText(value: string) {
  if (value === "DAILY") return "매일";
  if (value === "MONTHLY") return "매월";
  return "매주";
}

export function daysOfWeekText(value: string | null | undefined) {
  const days = parseDaysOfWeek(value);
  if (days.size === 0) return "-";
  return weekdayOptions.filter((option) => days.has(Number(option.value))).map((option) => option.label).join("/");
}

export function parseMonthlyDays(value: string | null | undefined) {
  const days = new Set<number>();
  String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const range = part.match(/^(\d{1,2})-(\d{1,2})$/);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        if (start >= 1 && end <= 31 && start <= end) {
          for (let day = start; day <= end; day += 1) days.add(day);
        }
        return;
      }

      const day = Number(part);
      if (Number.isInteger(day) && day >= 1 && day <= 31) days.add(day);
    });
  return days;
}

export function monthlyDaysText(value: string | null | undefined, fallbackDay?: number | null) {
  const compact = String(value ?? "").replace(/\s+/g, "");
  if (compact) return compact;
  return fallbackDay ? String(fallbackDay) : "-";
}

export function splitRecurringDescription(value: string | null | undefined) {
  const raw = String(value ?? "");
  const markerIndex = raw.indexOf(recurringChecklistMarker);
  if (markerIndex < 0) return { description: raw, checklist: [] as string[] };

  const description = raw.slice(0, markerIndex).trim();
  const checklist = raw
    .slice(markerIndex + recurringChecklistMarker.length)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return { description, checklist };
}

export function composeRecurringDescription(description: string | null | undefined, checklist: string[]) {
  const cleanDescription = String(description ?? "").trim();
  const cleanChecklist = checklist.map((line) => line.trim()).filter(Boolean);
  if (cleanChecklist.length === 0) return cleanDescription || null;
  return `${cleanDescription}${recurringChecklistMarker}${cleanChecklist.join("\n")}`;
}

export function getNextRecurringDate(task: Pick<RecurringTaskSeed, "recurrenceType" | "daysOfWeek" | "dayOfMonth" | "startDate" | "endDate">, from = new Date()) {
  const start = parseDateOnly(task.startDate);
  if (!start) return null;
  const end = task.endDate ? parseDateOnly(task.endDate) : null;
  const first = maxDate(stripTime(from), start);
  for (let offset = 0; offset <= 370; offset += 1) {
    const date = addDays(first, offset);
    if (end && date.getTime() > end.getTime()) return null;
    if (isRecurringOnDate(task, date)) return toYmd(date);
  }
  return null;
}

export async function generateDueRecurringTasks(user: { id: string; academyId: string }, until = new Date()) {
  const today = stripTime(until);
  const lookbackStart = addDays(today, -370);
  const templates = await prisma.recurringTask.findMany({
    where: {
      academyId: user.academyId,
      isActive: true,
      startDate: { lte: toYmd(today) },
      OR: [{ endDate: null }, { endDate: { gte: toYmd(lookbackStart) } }],
    },
    orderBy: { createdAt: "asc" },
  });

  let createdCount = 0;

  for (const template of templates) {
    const dates = dueDatesForTemplate(template, today, lookbackStart);
    for (const scheduledDate of dates) {
      const exists = await prisma.task.findUnique({
        where: {
          recurringTaskId_scheduledDate: {
            recurringTaskId: template.id,
            scheduledDate,
          },
        },
        select: { id: true },
      });
      if (exists) continue;

      await prisma.$transaction(async (tx) => {
        const templateDescription = splitRecurringDescription(template.description);
        const task = await tx.task.create({
          data: {
            academyId: template.academyId,
            title: `${scheduledDate} ${template.title}`,
            description: templateDescription.description || null,
            type: template.type,
            studentId: template.studentId,
            classGroupId: template.classGroupId,
            assigneeId: template.assigneeId,
            creatorId: template.creatorId,
            reviewerId: template.creatorId,
            priority: template.priority,
            startDate: dateAtTime(scheduledDate, "00:00"),
            dueDate: dateAtTime(scheduledDate, template.dueTime || "23:59"),
            recurringTaskId: template.id,
            scheduledDate,
          },
        });

        await tx.taskAssignee.create({
          data: {
            academyId: template.academyId,
            taskId: task.id,
            assigneeId: template.assigneeId,
          },
        });

        await tx.taskStatusHistory.create({
          data: {
            taskId: task.id,
            fromStatus: null,
            toStatus: TaskStatus.TODO,
            changedById: user.id,
            memo: `정기 업무 자동 생성: ${scheduledDate}`,
          },
        });

        if (templateDescription.checklist.length > 0) {
          await tx.taskChecklistItem.createMany({
            data: templateDescription.checklist.map((title, order) => ({
              taskId: task.id,
              title,
              order,
            })),
          });
        }
      });
      createdCount += 1;
    }
  }

  return createdCount;
}

function dueDatesForTemplate(template: RecurringTaskSeed, until: Date, lookbackStart: Date) {
  const start = parseDateOnly(template.startDate);
  if (!start) return [];
  const end = template.endDate ? parseDateOnly(template.endDate) : null;
  const first = maxDate(start, lookbackStart);
  const last = end ? minDate(end, until) : until;
  if (first.getTime() > last.getTime()) return [];

  const dates: string[] = [];
  for (let current = first; current.getTime() <= last.getTime(); current = addDays(current, 1)) {
    if (isRecurringOnDate(template, current)) dates.push(toYmd(current));
  }
  return dates;
}

function isRecurringOnDate(template: Pick<RecurringTaskSeed, "recurrenceType" | "daysOfWeek" | "dayOfMonth" | "startDate">, date: Date) {
  if (template.recurrenceType === "DAILY") return true;
  if (template.recurrenceType === "MONTHLY") {
    const monthlyDays = parseMonthlyDays(template.daysOfWeek);
    if (monthlyDays.size > 0) return monthlyDays.has(date.getDate());
    const day = template.dayOfMonth ?? parseDateOnly(template.startDate)?.getDate() ?? 1;
    return date.getDate() === day;
  }
  const days = parseDaysOfWeek(template.daysOfWeek);
  if (days.size === 0) {
    const start = parseDateOnly(template.startDate);
    return start ? date.getDay() === start.getDay() : false;
  }
  return days.has(date.getDay());
}

function parseDateOnly(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateAtTime(dateValue: string, timeValue: string) {
  const date = parseDateOnly(dateValue) ?? new Date();
  const [hour, minute] = timeValue.split(":").map(Number);
  date.setHours(Number.isFinite(hour) ? hour : 23, Number.isFinite(minute) ? minute : 59, 0, 0);
  return date;
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function maxDate(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

export type RecurringTaskWhere = Prisma.RecurringTaskWhereInput;
