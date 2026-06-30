import type { CSSProperties } from "react";
import AcademyCalendar from "@/features/calendar/components/AcademyCalendar";
import { addDays, formatDateShort, isoDate, stripTime } from "@/features/calendar/lib/calendarFormatters";
import { severityFromClass, severityFromTask, statusFromClass, statusFromTask } from "@/features/calendar/lib/calendarEvents";
import type { AcademyCalendarEvent, CalendarEventStatus, CalendarSeverity } from "@/features/calendar/types";
import { requireUser, roleText } from "@/lib/auth";
import {
  effectiveClassStatus,
  formatClassSchedule,
  formatOperatingPeriod,
  parseClassDaysOfWeek,
} from "@/lib/classGroups";
import { generateDueRecurringTasks } from "@/lib/recurringTasks";
import type { TaskStatus } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await requireUser();
  const canViewStaffCalendars = user.role !== "ASSISTANT";
  await generateDueRecurringTasks(user, addDays(new Date(), 45));

  const [classGroups, tasks, classRoomRows, taskStartRows, privateMemos, eventMemos, workShifts, staffRows] = await Promise.all([
    prisma.classGroup.findMany({
      where: classGroupWhereForCalendar(user),
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        teacher: { select: { id: true, name: true } },
        assistant: { select: { id: true, name: true } },
        classAssistants: {
          orderBy: { createdAt: "asc" },
          include: { assistant: { select: { id: true, name: true } } },
        },
        _count: { select: { studentClasses: true } },
        lessons: {
          orderBy: { position: "asc" },
          select: { id: true, position: true, title: true, lessonDate: true, startTime: true, endTime: true },
        },
      },
    }),
    prisma.task.findMany({
      where: taskWhereForCalendar(user),
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: { select: { id: true, name: true } },
        assignees: {
          orderBy: { createdAt: "asc" },
          include: { assignee: { select: { id: true, name: true } } },
        },
        classGroup: { select: { id: true, name: true, subject: true, teacherId: true, teacher: { select: { id: true, name: true } } } },
        student: { select: { id: true, name: true, teacherId: true } },
      },
    }),
    prisma.$queryRaw<Array<{ id: string; room: string | null }>>`SELECT "id", "room" FROM "ClassGroup" WHERE "academyId" = ${user.academyId}`,
    prisma.$queryRaw<Array<{ id: string; startDate: Date | string | null }>>`SELECT "id", "startDate" FROM "Task" WHERE "academyId" = ${user.academyId}`,
    prisma.calendarPrivateMemo.findMany({
      where: { academyId: user.academyId, userId: user.id },
      orderBy: { date: "asc" },
      select: { date: true, content: true },
    }),
    prisma.calendarEventMemo.findMany({
      where: { academyId: user.academyId },
      orderBy: { updatedAt: "desc" },
      select: {
        eventKey: true,
        eventDate: true,
        content: true,
        updatedAt: true,
        writer: { select: { name: true } },
      },
    }),
    prisma.assistantWorkShift.findMany({
      where: {
        academyId: user.academyId,
        ...(canViewStaffCalendars ? {} : { assistantId: user.id }),
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
      include: {
        assistant: { select: { id: true, name: true } },
      },
    }),
    canViewStaffCalendars
      ? prisma.user.findMany({
          where: { academyId: user.academyId, role: { in: ["ASSISTANT", "MANAGER"] }, isActive: true },
          orderBy: [{ role: "asc" }, { name: "asc" }],
          select: { id: true, name: true, role: true },
        })
      : Promise.resolve([]),
  ]);

  const roomByClassId = new Map(classRoomRows.map((row) => [row.id, row.room]));
  const startDateByTaskId = new Map(taskStartRows.map((row) => [row.id, coerceDate(row.startDate)]));
  const classGroupsWithRoom = classGroups.map((classGroup) => ({ ...classGroup, room: roomByClassId.get(classGroup.id) ?? null }));
  const tasksWithStartDate = tasks.map((task) => ({ ...task, startDate: startDateByTaskId.get(task.id) ?? null }));

  const classEvents = classGroupsWithRoom.flatMap((classGroup) => classEventsFromClassGroup(classGroup));
  const taskEvents = tasksWithStartDate.map((task) => taskEvent(task));
  const workShiftEvents = workShifts.map((shift) => workShiftEvent(shift));
  const activeClassCount = classGroups.filter((classGroup) => effectiveClassStatus(classGroup) === "ACTIVE").length;

  return (
    <main style={page}>
      <section style={container}>
        <AcademyCalendar
          events={[...classEvents, ...taskEvents, ...workShiftEvents]}
          staffOptions={staffRows.map((staff) => ({ id: staff.id, label: `${staff.name} · ${roleText(staff.role)}` }))}
          canViewStaffCalendars={canViewStaffCalendars}
          privateMemos={privateMemos}
          eventMemos={eventMemos.map((memo) => ({
            eventKey: memo.eventKey,
            eventDate: memo.eventDate,
            content: memo.content,
            updatedAt: memo.updatedAt.toISOString(),
            writerName: memo.writer?.name ?? null,
          }))}
          activeClassCount={activeClassCount}
          currentUserId={user.id}
        />
      </section>
    </main>
  );
}

function classGroupWhereForCalendar(user: { id: string; academyId: string; role: string }) {
  if (user.role === "ASSISTANT") {
    return {
      academyId: user.academyId,
      OR: [
        { assistantId: user.id },
        { classAssistants: { some: { assistantId: user.id } } },
      ],
    };
  }

  return { academyId: user.academyId };
}

function taskWhereForCalendar(user: { id: string; academyId: string; role: string }) {
  if (user.role === "ASSISTANT") {
    return {
      academyId: user.academyId,
      OR: [
        { assigneeId: user.id },
        { assignees: { some: { assigneeId: user.id } } },
      ],
    };
  }

  return { academyId: user.academyId };
}

function classEventsFromClassGroup(classGroup: {
  id: string;
  name: string;
  subject: string | null;
  grade: string | null;
  daysOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  endDate: string | null;
  room: string | null;
  schedule: string | null;
  description: string | null;
  status: string;
  teacher: { id: string; name: string } | null;
  assistant: { id: string; name: string } | null;
  classAssistants: Array<{ assistantId: string; assistant: { id: string; name: string } }>;
  _count: { studentClasses: number };
  lessons: Array<{ id: string; position: number; title: string; lessonDate: string | null; startTime: string | null; endTime: string | null }>;
}): AcademyCalendarEvent[] {
  const effectiveStatus = effectiveClassStatus(classGroup);
  if (effectiveStatus === "PAUSED") return [];

  const status = statusFromClass(effectiveStatus);
  const severity = severityFromClass(status);
  const daysOfWeek = parseClassDaysOfWeek(classGroup.daysOfWeek);
  const assistantNames =
    classGroup.classAssistants.length > 0
      ? classGroup.classAssistants.map((link) => link.assistant.name).join(", ")
      : classGroup.assistant?.name ?? null;
  const firstAssistant = classGroup.classAssistants[0]?.assistant ?? classGroup.assistant;
  const ownerLabel = [classGroup.teacher?.name, assistantNames].filter(Boolean).join(" / ") || null;
  const ownerIds = uniqueIds([
    classGroup.teacher?.id,
    classGroup.assistant?.id,
    ...classGroup.classAssistants.map((link) => link.assistant.id),
  ]);
  const common = {
    source: "class_session" as const,
    status,
    severity,
    sourceKey: classGroup.id,
    subtitle: [classGroup.subject, classGroup.grade, classGroup.room].filter(Boolean).join(" / "),
    description: classGroup.description,
    ownerLabel,
    ownerIds,
    teacherId: classGroup.teacher?.id ?? null,
    assistantId: firstAssistant?.id ?? null,
    classGroupId: classGroup.id,
    className: classGroup.name,
    subject: classGroup.subject,
    grade: classGroup.grade,
    room: classGroup.room,
    expectedStudentCount: classGroup._count.studentClasses,
    sourceStatusRaw: effectiveStatus,
    metadata: {
      teacherName: classGroup.teacher?.name ?? null,
      assistantName: assistantNames,
      scheduleText: formatClassSchedule(classGroup),
      operationPeriod: formatOperatingPeriod(classGroup),
    },
  };

  const savedLessons = classGroup.lessons.filter((lesson) => lesson.lessonDate);
  if (savedLessons.length > 0) {
    return savedLessons.map((lesson) => {
      const lessonDate = lesson.lessonDate || isoDate(new Date());
      const lessonTitle = lesson.title || `${lesson.position}차시`;
      const startTime = lesson.startTime || classGroup.startTime || "09:00";
      const endTime = lesson.endTime || classGroup.endTime || undefined;
      const id = `class-lesson-${lesson.id}`;

      return {
        ...common,
        id,
        occurrenceKey: `${id}-${lessonDate}`,
        title: `${lessonTitle} · ${classGroup.name}`,
        startAt: `${lessonDate}T${startTime}`,
        endAt: endTime ? `${lessonDate}T${endTime}` : undefined,
        isAllDay: false,
        isRecurring: false,
        recurrenceLabelKo: "저장된 수업 회차",
        metadata: {
          ...common.metadata,
          scheduleText: `${lessonTitle} / ${lessonDate}${startTime ? ` ${[startTime, endTime].filter(Boolean).join("-")}` : ""}`,
        },
      };
    });
  }

  if (daysOfWeek.length === 0) return [];

  const startTime = classGroup.startTime || "09:00";
  const startRecur = classGroup.startDate || isoDate(addDays(new Date(), -120));
  const endRecur = classGroup.endDate || isoDate(addDays(new Date(), 240));
  const id = `class-${classGroup.id}`;

  return [
    {
      ...common,
      id,
      occurrenceKey: id,
      title: classGroup.name,
      startAt: `${startRecur}T${startTime}`,
      endAt: classGroup.endTime ? `${startRecur}T${classGroup.endTime}` : undefined,
      isAllDay: false,
      isRecurring: true,
      recurrenceLabelKo: `${formatClassSchedule(classGroup)} · ${formatOperatingPeriod(classGroup)}`,
      repeatDaysOfWeek: daysOfWeek,
      startRecur,
      endRecur,
      startTime,
      endTime: classGroup.endTime || undefined,
    },
  ];
}

function taskEvent(task: {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  color: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  assignee: { id: string; name: string };
  assignees: Array<{ assigneeId: string; color: string | null; assignee: { id: string; name: string } }>;
  classGroup: { id: string; name: string; subject: string | null; teacherId: string | null; teacher: { id: string; name: string } | null } | null;
  student: { id: string; name: string; teacherId: string | null } | null;
}): AcademyCalendarEvent {
  const range = normalizeTaskRange(task.startDate, task.dueDate, task.createdAt);
  const status = statusFromTask(task.status, task.dueDate);
  const severity = severityFromTask(status, task.priority);
  const taskAssignees = task.assignees.length > 0 ? task.assignees : [{ assigneeId: task.assignee.id, color: null, assignee: task.assignee }];
  const assigneeIds = uniqueIds(taskAssignees.map((assignment) => assignment.assigneeId));
  const assigneeName = taskAssignees.map((assignment) => assignment.assignee.name).join(", ");
  const teacherId = task.classGroup?.teacher?.id ?? task.classGroup?.teacherId ?? task.student?.teacherId ?? null;

  return {
    id: `task-${task.id}`,
    sourceKey: task.id,
    occurrenceKey: `task-${task.id}`,
    source: "internal_task",
    status,
    severity,
    title: task.title,
    subtitle: [task.classGroup?.name, task.student?.name].filter(Boolean).join(" / "),
    description: task.description,
    startAt: range.start,
    endAt: range.end,
    isAllDay: true,
    ownerLabel: assigneeName || null,
    ownerIds: assigneeIds,
    assigneeId: assigneeIds[0] ?? task.assignee.id,
    assigneeIds,
    teacherId,
    classGroupId: task.classGroup?.id ?? undefined,
    className: task.classGroup?.name ?? null,
    studentId: task.student?.id ?? undefined,
    studentName: task.student?.name ?? null,
    subject: task.classGroup?.subject ?? null,
    sourceStatusRaw: task.status,
    sourceColor: task.color,
    metadata: {
      priorityLabel: taskPriorityLabel(task.priority),
      scheduleText: `${formatDateShort(range.startDate)} 시작 / ${formatDateShort(range.endDate)} 마감`,
    },
  };
}

function workShiftEvent(shift: {
  id: string;
  assistantId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  status: string;
  memo: string | null;
  assistant: { id: string; name: string };
}): AcademyCalendarEvent {
  const status = workShiftStatus(shift.status);

  return {
    id: `work-shift-${shift.id}`,
    sourceKey: shift.id,
    occurrenceKey: `work-shift-${shift.id}`,
    source: "assistant_work_shift",
    status,
    severity: workShiftSeverity(status),
    title: `${shift.assistant.name} 출근`,
    subtitle: `${shift.startTime}-${shift.endTime}`,
    description: shift.memo,
    startAt: `${shift.workDate}T${shift.startTime}`,
    endAt: `${shift.workDate}T${shift.endTime}`,
    isAllDay: false,
    ownerLabel: shift.assistant.name,
    ownerIds: [shift.assistantId],
    assistantId: shift.assistantId,
    workShiftId: shift.id,
    sourceStatusRaw: shift.status,
    metadata: {
      workStatusLabel: workShiftStatusLabel(shift.status),
      scheduleText: `${shift.workDate} ${shift.startTime}-${shift.endTime}`,
    },
  };
}

function normalizeTaskRange(startDate: Date | null, dueDate: Date | null, createdAt: Date) {
  const start = stripTime(startDate ?? dueDate ?? createdAt);
  const endBase = stripTime(dueDate ?? startDate ?? createdAt);
  const orderedStart = start.getTime() <= endBase.getTime() ? start : endBase;
  const orderedEnd = start.getTime() <= endBase.getTime() ? endBase : start;

  return {
    start: isoDate(orderedStart),
    end: isoDate(orderedEnd),
    startDate: orderedStart,
    endDate: orderedEnd,
  };
}

function workShiftStatus(status: string): CalendarEventStatus {
  if (status === "WORKED") return "completed";
  if (status === "ABSENT") return "delayed";
  if (status === "CANCELLED") return "cancelled";
  return "scheduled";
}

function workShiftSeverity(status: CalendarEventStatus): CalendarSeverity {
  if (status === "delayed") return "warning";
  if (status === "cancelled") return "inactive";
  if (status === "completed") return "resolved";
  return "normal";
}

function workShiftStatusLabel(status: string) {
  if (status === "WORKED") return "근무 완료";
  if (status === "ABSENT") return "결근";
  if (status === "CANCELLED") return "취소";
  return "예정";
}

function taskPriorityLabel(priority: string) {
  if (priority === "URGENT") return "긴급";
  if (priority === "HIGH") return "높음";
  if (priority === "LOW") return "낮음";
  return "보통";
}

function uniqueIds(items: Array<string | null | undefined>) {
  return [...new Set(items.filter(Boolean) as string[])];
}

function coerceDate(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const page: CSSProperties = { padding: 12, color: "var(--asc-text)", background: "var(--asc-bg-subtle)", minHeight: "100vh" };
const container: CSSProperties = { width: "100%", maxWidth: "none", margin: 0, display: "grid", gap: 10 };
