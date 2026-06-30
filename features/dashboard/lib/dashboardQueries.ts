import { DASHBOARD_INBOX_LIMIT, DASHBOARD_MEMO_LIMIT, DASHBOARD_WIDGET_LIMIT } from "@/features/dashboard/constants";
import { prisma } from "@/lib/prisma";

export type DashboardQueryUser = {
  id: string;
  academyId: string;
  role: string;
  academy: { name: string };
};

export function dashboardDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function getDashboardData({ user, today }: { user: DashboardQueryUser; today: string }) {
  const academyId = user.academyId;

  const [
    totalStudents,
    activeStudents,
    watchStudents,
    pausedStudents,
    leftStudents,
    todayAttendance,
    todayAssignments,
    studentMemos,
    classMemos,
    taskComments,
    importantStudentMemoCount,
    openTaskCount,
    openTasks,
    attentionStudents,
    classGroups,
    classTaskCounts,
    messageRecipients,
    omrUploads,
  ] = await Promise.all([
    prisma.student.count({ where: { academyId } }),
    prisma.student.count({ where: { academyId, status: "ACTIVE" } }),
    prisma.student.count({ where: { academyId, status: "WATCH" } }),
    prisma.student.count({ where: { academyId, status: "PAUSED" } }),
    prisma.student.count({ where: { academyId, status: "LEFT" } }),
    prisma.attendanceRecord.findMany({
      where: { academyId, date: today },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            status: true,
            schoolName: true,
            grade: true,
            teacherId: true,
            assistantId: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.assignmentRecord.findMany({
      where: { academyId, date: today },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            status: true,
            schoolName: true,
            grade: true,
            teacherId: true,
            assistantId: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.studentMemo.findMany({
      where: { student: { academyId } },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            status: true,
            schoolName: true,
            grade: true,
            teacherId: true,
            assistantId: true,
            studentClasses: {
              where: { status: "ACTIVE" },
              select: {
                classGroup: { select: { id: true, name: true, teacherId: true, assistantId: true } },
              },
              take: 2,
            },
          },
        },
        writer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: DASHBOARD_MEMO_LIMIT,
    }),
    prisma.classMemo.findMany({
      where: { academyId },
      include: {
        classGroup: { select: { id: true, name: true, teacherId: true, assistantId: true } },
        writer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: DASHBOARD_MEMO_LIMIT,
    }),
    prisma.taskComment.findMany({
      where: { task: { academyId } },
      include: {
        writer: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            student: { select: { id: true, name: true, teacherId: true, assistantId: true } },
            classGroup: { select: { id: true, name: true, teacherId: true, assistantId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: DASHBOARD_MEMO_LIMIT,
    }),
    prisma.studentMemo.count({ where: { isImportant: true, student: { academyId } } }),
    prisma.task.count({ where: { academyId, status: { not: "DONE" } } }),
    prisma.task.findMany({
      where: { academyId, status: { not: "DONE" } },
      include: {
        assignee: { select: { id: true, name: true } },
        student: {
          select: {
            id: true,
            name: true,
            status: true,
            schoolName: true,
            grade: true,
            teacherId: true,
            assistantId: true,
          },
        },
        classGroup: { select: { id: true, name: true, teacherId: true, assistantId: true } },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: DASHBOARD_INBOX_LIMIT,
    }),
    prisma.student.findMany({
      where: {
        academyId,
        OR: [
          { status: "WATCH" },
          { status: "PAUSED" },
          { status: "LEFT" },
          { memos: { some: { isImportant: true } } },
        ],
      },
      include: {
        teacher: { select: { id: true, name: true } },
        assistant: { select: { id: true, name: true } },
        studentClasses: {
          where: { status: "ACTIVE" },
          include: { classGroup: { select: { id: true, name: true, teacherId: true, assistantId: true } } },
          take: 2,
        },
        memos: {
          where: { isImportant: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: DASHBOARD_INBOX_LIMIT,
    }),
    prisma.classGroup.findMany({
      where: { academyId },
      select: {
        id: true,
        name: true,
        teacherId: true,
        assistantId: true,
        subject: true,
        grade: true,
        startDate: true,
        endDate: true,
        daysOfWeek: true,
        startTime: true,
        endTime: true,
        room: true,
        schedule: true,
        status: true,
        teacher: { select: { id: true, name: true } },
        assistant: { select: { id: true, name: true } },
        classAssistants: { select: { assistantId: true } },
        lessons: {
          where: { lessonDate: { not: null } },
          select: { lessonDate: true },
        },
        studentClasses: {
          where: {
            status: "ACTIVE",
            AND: [
              { OR: [{ joinedAt: null }, { joinedAt: { lte: today } }] },
              { OR: [{ leftAt: null }, { leftAt: { gte: today } }] },
            ],
            student: { status: { in: ["ACTIVE", "WATCH"] } },
          },
          select: {
            studentId: true,
            student: { select: { id: true, name: true, status: true, teacherId: true, assistantId: true } },
          },
        },
        _count: { select: { memos: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.task.groupBy({
      by: ["classGroupId"],
      where: { academyId, status: { not: "DONE" }, classGroupId: { not: null } },
      _count: { _all: true },
    }),
    prisma.messageRecipient.findMany({
      where: {
        status: { in: ["FAILED", "PENDING", "SENDING", "BLOCKED"] },
        job: { academyId },
      },
      include: {
        student: { select: { id: true, name: true, schoolName: true, grade: true, teacherId: true, assistantId: true } },
        job: { select: { id: true, title: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: DASHBOARD_WIDGET_LIMIT,
    }),
    prisma.omrUpload.findMany({
      where: {
        academyId,
        OR: [
          { matchStatus: { in: ["NEEDS_PHONE", "MULTIPLE_MATCHES", "NOT_FOUND"] } },
          { recognizeStatus: { in: ["WAITING", "RECOGNIZING", "REVIEW_NEEDED", "FAILED"] } },
          { gradingStatus: { in: ["WAITING", "REVIEW_NEEDED", "FAILED", "GRADED_REVIEW_NEEDED"] } },
          { recognizedAnswers: { some: { status: { in: ["REVIEW_NEEDED", "MULTIPLE"] } } } },
          { results: { some: { reviewNeededCount: { gt: 0 } } } },
        ],
      },
      include: {
        student: { select: { id: true, name: true, schoolName: true, grade: true, teacherId: true, assistantId: true } },
        exam: { select: { id: true, title: true, classGroupId: true, examDate: true, classGroup: { select: { id: true, name: true, teacherId: true, assistantId: true } } } },
        recognizedAnswers: { select: { status: true }, take: 20 },
        results: { select: { id: true, totalScore: true, maxScore: true, reviewNeededCount: true }, take: 2 },
      },
      orderBy: { updatedAt: "desc" },
      take: DASHBOARD_WIDGET_LIMIT,
    }),
  ]);

  return {
    counts: {
      totalStudents,
      activeStudents,
      watchStudents,
      pausedStudents,
      leftStudents,
      importantStudentMemoCount,
      openTaskCount,
    },
    todayAttendance,
    todayAssignments,
    studentMemos,
    classMemos,
    taskComments,
    openTasks,
    attentionStudents,
    classGroups,
    classTaskCounts,
    messageRecipients,
    omrUploads,
  };
}

export type DashboardRawData = Awaited<ReturnType<typeof getDashboardData>>;
