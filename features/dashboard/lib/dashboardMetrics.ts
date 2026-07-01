import {
  DASHBOARD_INBOX_LIMIT,
  DASHBOARD_SEVERITY_ORDER,
  DASHBOARD_SIGNAL_LABELS,
  DASHBOARD_WIDGET_LIMIT,
  PAYMENT_MATERIALS_UNAVAILABLE_REASON,
} from "@/features/dashboard/constants";
import type { DashboardRawData, DashboardQueryUser } from "@/features/dashboard/lib/dashboardQueries";
import {
  assignmentText,
  attendanceText,
  buildContextLabel,
  clipDashboardText,
  formatDateTime,
  formatDueDate,
  formatYmd,
  messageStatusText,
  omrStatusText,
  studentStatusText,
  taskPriorityText,
  taskStatusText,
} from "@/features/dashboard/lib/dashboardFormatters";
import type {
  CommunicationWidgetData,
  DashboardAction,
  DashboardFilterOption,
  DashboardSignalSeverity,
  DashboardSignalType,
  DashboardSummaryCard,
  DashboardViewData,
  ManagementStudentItem,
  OmrScoreWidgetData,
  OperationsInboxItem,
  RecentActivityItem,
  TodayClassOperation,
} from "@/features/dashboard/types";
import { effectiveClassStatus, formatClassSchedule, parseClassDaysOfWeek } from "@/lib/classGroups";
import { roleText } from "@/lib/auth";

export function percentMetric(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function buildDashboardViewData({
  raw,
  user,
  today,
}: {
  raw: DashboardRawData;
  user: DashboardQueryUser;
  today: string;
}): DashboardViewData {
  const classNameByStudentId = new Map<string, string>();
  const classIdByStudentId = new Map<string, string>();
  const todayStudentIds = new Set<string>();
  const todayClassIds = new Set<string>();

  const todayClasses = raw.classGroups
    .filter((classGroup) => isClassOnDate(classGroup, today))
    .map((classGroup) => {
      todayClassIds.add(classGroup.id);
      for (const membership of classGroup.studentClasses) {
        classNameByStudentId.set(membership.studentId, classGroup.name);
        classIdByStudentId.set(membership.studentId, classGroup.id);
        todayStudentIds.add(membership.studentId);
      }
      return classGroup;
    });

  for (const classGroup of raw.classGroups) {
    for (const membership of classGroup.studentClasses) {
      if (!classNameByStudentId.has(membership.studentId)) {
        classNameByStudentId.set(membership.studentId, classGroup.name);
        classIdByStudentId.set(membership.studentId, classGroup.id);
      }
    }
  }

  const todayClassAttendance = raw.todayAttendance.filter((record) => todayStudentIds.has(record.studentId));
  const todayClassAssignments = raw.todayAssignments.filter((record) => todayStudentIds.has(record.studentId));
  const issueAttendance = todayClassAttendance.filter((record) => record.status !== "PRESENT");
  const assignmentIssues = todayClassAssignments.filter((record) => record.status === "PARTIAL" || record.status === "MISSING");

  const todayTargetStudentCount = todayStudentIds.size;
  const attendanceChecked = todayClassAttendance.length;
  const attendanceUnchecked = Math.max(todayTargetStudentCount - attendanceChecked, 0);
  const assignmentChecked = todayClassAssignments.length;
  const assignmentUnchecked = Math.max(todayTargetStudentCount - assignmentChecked, 0);
  const assignmentDone = todayClassAssignments.filter((record) => record.status === "DONE").length;

  const todayClassOperations = buildTodayClasses({
    raw,
    today,
    todayClassIds,
  });

  const inboxItems = sortInboxItems([
    ...buildTaskSignals(raw, user, today),
    ...buildAttendanceSignals({ raw, user, today, todayClasses, todayStudentIds, classNameByStudentId, classIdByStudentId }),
    ...buildAssignmentSignals({ raw, user, today, todayClasses, todayStudentIds, classNameByStudentId, classIdByStudentId }),
    ...buildStudentSignals({ raw, user, classNameByStudentId, classIdByStudentId }),
    ...buildMessageSignals(raw, user),
    ...buildOmrSignals(raw, user),
  ]).slice(0, DASHBOARD_INBOX_LIMIT);

  const managementStudents = buildManagementStudents({
    raw,
    issueAttendance,
    assignmentIssues,
    classNameByStudentId,
  });

  const communication = buildCommunicationWidget(raw);
  const omrScore = buildOmrWidget(raw);
  const recentActivities = buildRecentActivities(raw);
  const urgentCount = inboxItems.filter((item) => item.severity === "critical").length;
  const warningCount = inboxItems.filter((item) => item.severity === "warning").length;

  return {
    academyName: user.academy.name,
    today,
    generatedAtLabel: formatDateTime(new Date()),
    userRole: user.role,
    userRoleLabel: roleText(user.role),
    scopeLabel: scopeLabel(user.role),
    summaryCards: buildSummaryCards({
      raw,
      today,
      todayClassCount: todayClassOperations.length,
      attendanceChecked,
      attendanceTarget: todayTargetStudentCount,
      attendanceUnchecked,
      assignmentChecked,
      assignmentTarget: todayTargetStudentCount,
      assignmentDone,
      assignmentUnchecked,
      urgentCount,
      warningCount,
      managementCount: managementStudents.length,
      communicationIssueCount: communication.issueCount,
      omrIssueCount: omrScore.issueCount,
    }),
    inboxItems,
    todayClasses: todayClassOperations,
    managementStudents,
    communication,
    omrScore,
    paymentMaterials: {
      status: "unavailable",
      reason: PAYMENT_MATERIALS_UNAVAILABLE_REASON,
    },
    recentActivities,
    filterOptions: buildFilterOptions({ raw, inboxItems }),
  };
}

function buildTaskSignals(raw: DashboardRawData, user: DashboardQueryUser, today: string): OperationsInboxItem[] {
  return raw.openTasks.map((task) => {
    const severity = task.priority === "URGENT" || task.status === "OVERDUE" ? "critical" : task.priority === "HIGH" ? "warning" : "routine";
    const targetLabel = task.student?.name ?? task.classGroup?.name ?? "일반 업무";
    const contextLabel = buildContextLabel([
      task.student?.schoolName,
      task.student?.grade,
      task.classGroup?.name,
      taskPriorityText[task.priority] ?? task.priority,
    ]);
    const href = `/tasks/${task.id}`;
    const actions = compactActions([
      { label: "업무 보기", href, tone: "primary" },
      task.student ? { label: "학생 보기", href: `/students/${task.student.id}`, tone: "secondary" } : null,
      task.classGroup ? { label: "반 보기", href: `/classes/${task.classGroup.id}`, tone: "secondary" } : null,
    ]);

    return {
      id: `task:${task.id}`,
      type: "task",
      severity,
      title: task.title,
      targetLabel,
      contextLabel,
      reason: `${taskStatusText[task.status] ?? task.status} 상태의 미완료 업무입니다.`,
      statusLabel: taskStatusText[task.status] ?? task.status,
      ownerLabel: task.assignee.name,
      ownerId: task.assignee.id,
      classGroupId: task.classGroup?.id,
      className: task.classGroup?.name,
      studentId: task.student?.id,
      timeLabel: formatDueDate(task.dueDate),
      dueKey: task.dueDate ? toYmd(task.dueDate) : undefined,
      dateScope: task.dueDate && toYmd(task.dueDate) === today ? "today" : "open",
      isMine: task.assignee.id === user.id || task.student?.teacherId === user.id || task.student?.assistantId === user.id || task.classGroup?.teacherId === user.id || task.classGroup?.assistantId === user.id,
      href,
      actions,
      recentRecords: [
        { id: `${task.id}:status`, label: "상태", value: taskStatusText[task.status] ?? task.status },
        { id: `${task.id}:priority`, label: "우선순위", value: taskPriorityText[task.priority] ?? task.priority },
      ],
      searchText: searchText([task.title, targetLabel, contextLabel, task.assignee.name, task.description]),
    };
  });
}

function buildAttendanceSignals({
  raw,
  user,
  today,
  todayClasses,
  todayStudentIds,
  classNameByStudentId,
  classIdByStudentId,
}: {
  raw: DashboardRawData;
  user: DashboardQueryUser;
  today: string;
  todayClasses: DashboardRawData["classGroups"];
  todayStudentIds: Set<string>;
  classNameByStudentId: Map<string, string>;
  classIdByStudentId: Map<string, string>;
}): OperationsInboxItem[] {
  const checkedIds = new Set(raw.todayAttendance.map((record) => record.studentId));
  const items: OperationsInboxItem[] = [];

  for (const classGroup of todayClasses) {
    const studentIds = classGroup.studentClasses.map((membership) => membership.studentId);
    const checked = studentIds.filter((studentId) => checkedIds.has(studentId)).length;
    const missing = Math.max(studentIds.length - checked, 0);
    if (missing <= 0) continue;

    items.push({
      id: `attendance-class:${classGroup.id}`,
      type: "attendance",
      severity: "warning",
      title: "오늘 출석 체크 미완료",
      targetLabel: classGroup.name,
      contextLabel: buildContextLabel([classGroup.teacher?.name, formatClassSchedule(classGroup)]),
      reason: `${missing}명 출석 체크가 아직 비어 있습니다.`,
      statusLabel: "미체크",
      ownerLabel: classGroup.teacher?.name ?? classGroup.assistant?.name ?? "담당 미정",
      ownerId: classGroup.teacher?.id ?? classGroup.assistant?.id,
      classGroupId: classGroup.id,
      className: classGroup.name,
      timeLabel: `${formatYmd(today)} 기준`,
      dateKey: today,
      dateScope: "today",
      isMine: isClassMine(classGroup, user.id),
      href: `/students?classGroupId=${classGroup.id}&date=${today}&tab=attendance`,
      actions: [
        { label: "출석 체크", href: `/students?classGroupId=${classGroup.id}&date=${today}&tab=attendance`, tone: "primary" },
        { label: "반 보기", href: `/classes/${classGroup.id}`, tone: "secondary" },
      ],
      recentRecords: [
        { id: `${classGroup.id}:checked`, label: "출석 체크", value: `${checked}/${studentIds.length}` },
        { id: `${classGroup.id}:schedule`, label: "수업", value: formatClassSchedule(classGroup) },
      ],
      searchText: searchText([classGroup.name, classGroup.teacher?.name, "출석 미체크"]),
    });
  }

  for (const record of raw.todayAttendance) {
    if (!todayStudentIds.has(record.studentId) || record.status === "PRESENT") continue;
    const className = classNameByStudentId.get(record.studentId) ?? "오늘 수업";
    const classGroupId = classIdByStudentId.get(record.studentId);
    const statusLabel = attendanceText[record.status] ?? record.status;
    const severity: DashboardSignalSeverity = record.status === "ABSENT" || record.status === "SKIP" ? "critical" : "warning";

    items.push({
      id: `attendance:${record.id}`,
      type: "attendance",
      severity,
      title: `${statusLabel} 학생 확인`,
      targetLabel: record.student.name,
      contextLabel: buildContextLabel([record.student.schoolName, record.student.grade, className]),
      reason: `오늘 출석 상태가 ${statusLabel}으로 기록되었습니다.`,
      statusLabel,
      ownerLabel: "담당 확인 필요",
      classGroupId,
      className,
      studentId: record.studentId,
      timeLabel: formatDateTime(record.updatedAt),
      dateKey: today,
      dateScope: "today",
      isMine: record.student.teacherId === user.id || record.student.assistantId === user.id,
      href: `/students/${record.studentId}?tab=attendance`,
      actions: [
        { label: "학생 보기", href: `/students/${record.studentId}?tab=attendance`, tone: "primary" },
        { label: "문자 보내기", href: `/messages?studentId=${record.studentId}`, tone: "secondary" },
        classGroupId ? { label: "반 보기", href: `/classes/${classGroupId}`, tone: "secondary" } : { label: "학생 현황", href: "/students", tone: "secondary" },
      ],
      recentRecords: [
        { id: `${record.id}:status`, label: "출석 상태", value: statusLabel },
        { id: `${record.id}:updated`, label: "기록", value: formatDateTime(record.updatedAt) },
      ],
      searchText: searchText([record.student.name, record.student.schoolName, record.student.grade, className, statusLabel, record.memo]),
    });
  }

  return items;
}

function buildAssignmentSignals({
  raw,
  user,
  today,
  todayClasses,
  todayStudentIds,
  classNameByStudentId,
  classIdByStudentId,
}: {
  raw: DashboardRawData;
  user: DashboardQueryUser;
  today: string;
  todayClasses: DashboardRawData["classGroups"];
  todayStudentIds: Set<string>;
  classNameByStudentId: Map<string, string>;
  classIdByStudentId: Map<string, string>;
}): OperationsInboxItem[] {
  const checkedIds = new Set(raw.todayAssignments.map((record) => record.studentId));
  const items: OperationsInboxItem[] = [];

  for (const classGroup of todayClasses) {
    const studentIds = classGroup.studentClasses.map((membership) => membership.studentId);
    const checked = studentIds.filter((studentId) => checkedIds.has(studentId)).length;
    const missing = Math.max(studentIds.length - checked, 0);
    if (missing <= 0) continue;

    items.push({
      id: `assignment-class:${classGroup.id}`,
      type: "assignment",
      severity: "warning",
      title: "오늘 과제 체크 미완료",
      targetLabel: classGroup.name,
      contextLabel: buildContextLabel([classGroup.teacher?.name, formatClassSchedule(classGroup)]),
      reason: `${missing}명 과제 체크가 아직 비어 있습니다.`,
      statusLabel: "미체크",
      ownerLabel: classGroup.teacher?.name ?? classGroup.assistant?.name ?? "담당 미정",
      ownerId: classGroup.teacher?.id ?? classGroup.assistant?.id,
      classGroupId: classGroup.id,
      className: classGroup.name,
      timeLabel: `${formatYmd(today)} 기준`,
      dateKey: today,
      dateScope: "today",
      isMine: isClassMine(classGroup, user.id),
      href: `/students?classGroupId=${classGroup.id}&date=${today}&tab=assignment`,
      actions: [
        { label: "과제 체크", href: `/students?classGroupId=${classGroup.id}&date=${today}&tab=assignment`, tone: "primary" },
        { label: "반 보기", href: `/classes/${classGroup.id}`, tone: "secondary" },
      ],
      recentRecords: [
        { id: `${classGroup.id}:checked`, label: "과제 체크", value: `${checked}/${studentIds.length}` },
        { id: `${classGroup.id}:schedule`, label: "수업", value: formatClassSchedule(classGroup) },
      ],
      searchText: searchText([classGroup.name, classGroup.teacher?.name, "과제 미체크"]),
    });
  }

  for (const record of raw.todayAssignments) {
    if (!todayStudentIds.has(record.studentId) || (record.status !== "PARTIAL" && record.status !== "MISSING")) continue;
    const className = classNameByStudentId.get(record.studentId) ?? "오늘 수업";
    const classGroupId = classIdByStudentId.get(record.studentId);
    const statusLabel = assignmentText[record.status] ?? record.status;

    items.push({
      id: `assignment:${record.id}`,
      type: "assignment",
      severity: record.status === "MISSING" ? "critical" : "warning",
      title: "과제 제출 확인 필요",
      targetLabel: record.student.name,
      contextLabel: buildContextLabel([record.student.schoolName, record.student.grade, className]),
      reason: `${record.title} 상태가 ${statusLabel}입니다.`,
      statusLabel,
      ownerLabel: "담당 확인 필요",
      classGroupId,
      className,
      studentId: record.studentId,
      timeLabel: formatDateTime(record.updatedAt),
      dateKey: today,
      dateScope: "today",
      isMine: record.student.teacherId === user.id || record.student.assistantId === user.id,
      href: `/students/${record.studentId}?tab=assignment`,
      actions: [
        { label: "학생 보기", href: `/students/${record.studentId}?tab=assignment`, tone: "primary" },
        { label: "업무 생성", href: `/tasks/new?studentId=${record.studentId}`, tone: "secondary" },
        { label: "문자 보내기", href: `/messages?studentId=${record.studentId}`, tone: "secondary" },
      ],
      recentRecords: [
        { id: `${record.id}:title`, label: "과제", value: record.title },
        { id: `${record.id}:status`, label: "상태", value: statusLabel },
      ],
      searchText: searchText([record.student.name, record.student.schoolName, record.student.grade, className, record.title, statusLabel, record.memo]),
    });
  }

  return items;
}

function buildStudentSignals({
  raw,
  user,
  classNameByStudentId,
  classIdByStudentId,
}: {
  raw: DashboardRawData;
  user: DashboardQueryUser;
  classNameByStudentId: Map<string, string>;
  classIdByStudentId: Map<string, string>;
}): OperationsInboxItem[] {
  return raw.attentionStudents.map((student) => {
    const className = student.studentClasses[0]?.classGroup.name ?? classNameByStudentId.get(student.id) ?? "반 미지정";
    const classGroupId = student.studentClasses[0]?.classGroup.id ?? classIdByStudentId.get(student.id);
    const reasons = [];
    if (student.status === "WATCH") reasons.push("주의 상태");
    if (student.status === "PAUSED" || student.status === "LEFT") reasons.push(`${studentStatusText[student.status] ?? student.status} 상태`);
    if (student.memos[0]) reasons.push("중요 메모 있음");
    const reason = reasons.join(" · ") || "확인 필요";

    return {
      id: `student:${student.id}`,
      type: "student",
      severity: student.status === "LEFT" ? "critical" : "warning",
      title: "관리 필요 학생",
      targetLabel: student.name,
      contextLabel: buildContextLabel([student.schoolName, student.grade, className]),
      reason,
      statusLabel: studentStatusText[student.status] ?? student.status,
      ownerLabel: student.teacher?.name ?? student.assistant?.name ?? "담당 미정",
      ownerId: student.teacher?.id ?? student.assistant?.id ?? undefined,
      classGroupId,
      className,
      studentId: student.id,
      timeLabel: student.memos[0] ? formatDateTime(student.memos[0].createdAt) : formatDateTime(student.updatedAt),
      dateScope: "recent",
      isMine: student.teacherId === user.id || student.assistantId === user.id,
      href: `/students/${student.id}`,
      actions: [
        { label: "학생 보기", href: `/students/${student.id}`, tone: "primary" },
        { label: "메모 추가", href: `/memos/new?studentId=${student.id}`, tone: "secondary" },
        { label: "업무 생성", href: `/tasks/new?studentId=${student.id}`, tone: "secondary" },
      ],
      recentRecords: [
        { id: `${student.id}:reason`, label: "사유", value: reason },
        { id: `${student.id}:memo`, label: "최근 중요 메모", value: clipDashboardText(student.memos[0]?.content ?? "중요 메모 없음", 80) },
      ],
      searchText: searchText([student.name, student.schoolName, student.grade, className, reason, student.memos[0]?.content]),
    };
  });
}

function buildMessageSignals(raw: DashboardRawData, user: DashboardQueryUser): OperationsInboxItem[] {
  return raw.messageRecipients.map((recipient) => {
    const failed = recipient.status === "FAILED" || recipient.job.status === "FAILED" || recipient.job.status === "PARTIAL_FAILED";
    const title = failed ? "문자 발송 실패 확인" : "문자 발송 상태 확인";
    const targetLabel = recipient.student?.name ?? recipient.receiverName;
    const statusLabel = messageStatusText(recipient.status);

    return {
      id: `message:${recipient.id}`,
      type: "message",
      severity: failed ? "critical" : "warning",
      title,
      targetLabel,
      contextLabel: buildContextLabel([recipient.student?.schoolName, recipient.student?.grade, recipient.recipientType]),
      reason: recipient.errorMessage ? `발송 오류: ${clipDashboardText(recipient.errorMessage, 72)}` : `${recipient.job.title} 상태를 확인해야 합니다.`,
      statusLabel,
      ownerLabel: "문자 담당",
      studentId: recipient.studentId ?? undefined,
      timeLabel: formatDateTime(recipient.createdAt),
      dateScope: "recent",
      isMine: recipient.student?.teacherId === user.id || recipient.student?.assistantId === user.id,
      href: "/messages",
      actions: compactActions([
        { label: "문자 기록", href: "/messages", tone: "primary" },
        recipient.studentId ? { label: "학생 보기", href: `/students/${recipient.studentId}`, tone: "secondary" } : null,
      ]),
      recentRecords: [
        { id: `${recipient.id}:job`, label: "발송 작업", value: recipient.job.title, href: "/messages" },
        { id: `${recipient.id}:status`, label: "수신자 상태", value: statusLabel },
      ],
      searchText: searchText([recipient.receiverName, recipient.student?.name, recipient.job.title, recipient.messageText, recipient.errorMessage, statusLabel]),
    };
  });
}

function buildOmrSignals(raw: DashboardRawData, user: DashboardQueryUser): OperationsInboxItem[] {
  return raw.omrUploads.map((upload) => {
    const reviewAnswerCount = upload.recognizedAnswers.filter((answer) => answer.status === "REVIEW_NEEDED" || answer.status === "MULTIPLE").length;
    const reviewResultCount = upload.results.reduce((sum, result) => sum + result.reviewNeededCount, 0);
    const failed = upload.recognizeStatus === "FAILED" || upload.gradingStatus === "FAILED";
    const needsMatch = ["NEEDS_PHONE", "MULTIPLE_MATCHES", "NOT_FOUND"].includes(upload.matchStatus);
    const statusLabel = failed ? "실패" : needsMatch ? omrStatusText(upload.matchStatus) : reviewAnswerCount + reviewResultCount > 0 ? "검수 필요" : omrStatusText(upload.gradingStatus);
    const targetLabel = upload.student?.name ?? (upload.phoneLast8 ? `전화번호 ${upload.phoneLast8}` : upload.fileName);
    const classGroup = upload.exam?.classGroup;

    return {
      id: `omr:${upload.id}`,
      type: "omr",
      severity: failed ? "critical" : "warning",
      title: needsMatch ? "OMR 학생 매칭 필요" : failed ? "OMR 처리 실패" : "OMR 검토 필요",
      targetLabel,
      contextLabel: buildContextLabel([upload.exam?.title, classGroup?.name, upload.student?.schoolName, upload.student?.grade]),
      reason: needsMatch
        ? `학생 매칭 상태가 ${omrStatusText(upload.matchStatus)}입니다.`
        : failed
          ? "OMR 인식 또는 채점이 실패했습니다."
          : `검수 필요한 답안/결과가 ${reviewAnswerCount + reviewResultCount}개 있습니다.`,
      statusLabel,
      ownerLabel: classGroup?.teacherId ? "담당 강사" : "OMR 담당",
      classGroupId: classGroup?.id ?? upload.exam?.classGroupId ?? undefined,
      className: classGroup?.name,
      studentId: upload.studentId ?? undefined,
      timeLabel: formatDateTime(upload.updatedAt),
      dateScope: "recent",
      isMine: upload.student?.teacherId === user.id || upload.student?.assistantId === user.id || classGroup?.teacherId === user.id || classGroup?.assistantId === user.id,
      href: "/omr",
      actions: compactActions([
        { label: "OMR 검토", href: "/omr", tone: "primary" },
        upload.studentId ? { label: "학생 보기", href: `/students/${upload.studentId}`, tone: "secondary" } : null,
        classGroup ? { label: "반 보기", href: `/classes/${classGroup.id}`, tone: "secondary" } : null,
      ]),
      recentRecords: [
        { id: `${upload.id}:recognize`, label: "인식", value: omrStatusText(upload.recognizeStatus) },
        { id: `${upload.id}:grading`, label: "채점", value: omrStatusText(upload.gradingStatus) },
      ],
      searchText: searchText([upload.fileName, upload.student?.name, upload.exam?.title, classGroup?.name, statusLabel]),
    };
  });
}

function buildTodayClasses({
  raw,
  today,
  todayClassIds,
}: {
  raw: DashboardRawData;
  today: string;
  todayClassIds: Set<string>;
}): TodayClassOperation[] {
  return raw.classGroups
    .filter((classGroup) => todayClassIds.has(classGroup.id))
    .map((classGroup) => {
      const studentIds = classGroup.studentClasses.map((membership) => membership.studentId);
      const attendanceChecked = raw.todayAttendance.filter((record) => studentIds.includes(record.studentId)).length;
      const assignmentChecked = raw.todayAssignments.filter((record) => studentIds.includes(record.studentId)).length;
      const attendanceIssues = raw.todayAttendance.filter((record) => studentIds.includes(record.studentId) && record.status !== "PRESENT").length;
      const assignmentIssues = raw.todayAssignments.filter((record) => studentIds.includes(record.studentId) && (record.status === "PARTIAL" || record.status === "MISSING")).length;
      const missingChecks = Math.max(studentIds.length - attendanceChecked, 0) + Math.max(studentIds.length - assignmentChecked, 0);
      const issueCount = attendanceIssues + assignmentIssues + missingChecks;
      const severity: DashboardSignalSeverity = issueCount > 0 ? "warning" : "success";

      return {
        id: classGroup.id,
        name: classGroup.name,
        scheduleLabel: formatClassSchedule(classGroup),
        teacherLabel: classGroup.teacher?.name ?? classGroup.assistant?.name ?? "담당 미정",
        roomLabel: classGroup.room ?? "-",
        studentCount: studentIds.length,
        attendanceChecked,
        assignmentChecked,
        issueCount,
        statusLabel: issueCount > 0 ? "확인 필요" : "정상",
        severity,
        href: `/classes/${classGroup.id}`,
        attendanceHref: `/students?classGroupId=${classGroup.id}&date=${today}&tab=attendance`,
        assignmentHref: `/students?classGroupId=${classGroup.id}&date=${today}&tab=assignment`,
      };
    })
    .sort((a, b) => b.issueCount - a.issueCount || a.name.localeCompare(b.name))
    .slice(0, DASHBOARD_WIDGET_LIMIT);
}

function buildManagementStudents({
  raw,
  issueAttendance,
  assignmentIssues,
  classNameByStudentId,
}: {
  raw: DashboardRawData;
  issueAttendance: DashboardRawData["todayAttendance"];
  assignmentIssues: DashboardRawData["todayAssignments"];
  classNameByStudentId: Map<string, string>;
}): ManagementStudentItem[] {
  const rows = new Map<string, ManagementStudentItem>();

  for (const student of raw.attentionStudents) {
    const className = student.studentClasses[0]?.classGroup.name ?? classNameByStudentId.get(student.id) ?? "반 미지정";
    const reasons = [];
    if (student.status === "WATCH") reasons.push("주의 상태");
    if (student.status === "PAUSED" || student.status === "LEFT") reasons.push(studentStatusText[student.status] ?? student.status);
    if (student.memos[0]) reasons.push("중요 메모");
    rows.set(student.id, {
      id: student.id,
      name: student.name,
      className,
      contextLabel: buildContextLabel([student.schoolName, student.grade, student.teacher?.name]),
      reason: reasons.join(" · ") || "확인 필요",
      statusLabel: studentStatusText[student.status] ?? student.status,
      severity: student.status === "LEFT" ? "critical" : "warning",
      href: `/students/${student.id}`,
    });
  }

  for (const record of issueAttendance) {
    if (rows.has(record.studentId)) continue;
    const className = classNameByStudentId.get(record.studentId) ?? "오늘 수업";
    rows.set(record.studentId, {
      id: record.studentId,
      name: record.student.name,
      className,
      contextLabel: buildContextLabel([record.student.schoolName, record.student.grade, className]),
      reason: `출결 확인 · ${attendanceText[record.status] ?? record.status}`,
      statusLabel: studentStatusText[record.student.status] ?? record.student.status,
      severity: record.status === "ABSENT" || record.status === "SKIP" ? "critical" : "warning",
      href: `/students/${record.studentId}?tab=attendance`,
    });
  }

  for (const record of assignmentIssues) {
    if (rows.has(record.studentId)) continue;
    const className = classNameByStudentId.get(record.studentId) ?? "오늘 수업";
    rows.set(record.studentId, {
      id: record.studentId,
      name: record.student.name,
      className,
      contextLabel: buildContextLabel([record.student.schoolName, record.student.grade, className]),
      reason: `과제 확인 · ${assignmentText[record.status] ?? record.status}`,
      statusLabel: studentStatusText[record.student.status] ?? record.student.status,
      severity: record.status === "MISSING" ? "critical" : "warning",
      href: `/students/${record.studentId}?tab=assignment`,
    });
  }

  return [...rows.values()]
    .sort((a, b) => DASHBOARD_SEVERITY_ORDER[a.severity] - DASHBOARD_SEVERITY_ORDER[b.severity] || a.name.localeCompare(b.name))
    .slice(0, DASHBOARD_WIDGET_LIMIT);
}

function buildCommunicationWidget(raw: DashboardRawData): CommunicationWidgetData {
  const items = raw.messageRecipients.map((recipient) => ({
    id: recipient.id,
    title: recipient.student?.name ?? recipient.receiverName,
    meta: clipDashboardText(`${recipient.job.title} · ${recipient.errorMessage ?? recipient.messageText}`, 82),
    statusLabel: messageStatusText(recipient.status),
    severity: recipient.status === "FAILED" ? "critical" as const : "warning" as const,
    href: "/messages",
  }));
  return { issueCount: items.length, items: items.slice(0, DASHBOARD_WIDGET_LIMIT) };
}

function buildOmrWidget(raw: DashboardRawData): OmrScoreWidgetData {
  const items = raw.omrUploads.map((upload) => {
    const reviewNeeded = upload.recognizedAnswers.filter((answer) => answer.status === "REVIEW_NEEDED" || answer.status === "MULTIPLE").length + upload.results.reduce((sum, result) => sum + result.reviewNeededCount, 0);
    const failed = upload.recognizeStatus === "FAILED" || upload.gradingStatus === "FAILED";
    return {
      id: upload.id,
      title: upload.student?.name ?? upload.exam?.title ?? upload.fileName,
      meta: clipDashboardText(`${upload.exam?.title ?? "시험 미지정"} · ${upload.fileName}`, 82),
      statusLabel: failed ? "실패" : reviewNeeded > 0 ? `검수 ${reviewNeeded}개` : omrStatusText(upload.gradingStatus),
      severity: failed ? "critical" as const : "warning" as const,
      href: "/omr",
    };
  });
  return { issueCount: items.length, items: items.slice(0, DASHBOARD_WIDGET_LIMIT) };
}

function buildRecentActivities(raw: DashboardRawData): RecentActivityItem[] {
  const activities: RecentActivityItem[] = [
    ...raw.studentMemos.map((memo) => ({
      id: `studentMemo:${memo.id}`,
      label: memo.isImportant ? "중요 학생 메모" : "학생 메모",
      title: memo.student.name,
      meta: `${memo.writer.name} · ${clipDashboardText(memo.content, 72)}`,
      href: `/students/${memo.studentId}?tab=memos`,
      severity: memo.isImportant ? "warning" as const : "routine" as const,
    })),
    ...raw.classMemos.map((memo) => ({
      id: `classMemo:${memo.id}`,
      label: "반 메모",
      title: memo.classGroup.name,
      meta: `${memo.writer.name} · ${clipDashboardText(memo.content, 72)}`,
      href: `/classes/${memo.classGroupId}`,
      severity: "routine" as const,
    })),
    ...raw.taskComments.map((comment) => ({
      id: `taskComment:${comment.id}`,
      label: "업무 댓글",
      title: comment.task.title,
      meta: `${comment.writer.name} · ${clipDashboardText(comment.content, 72)}`,
      href: `/tasks/${comment.taskId}`,
      severity: "routine" as const,
    })),
    ...raw.messageRecipients.map((recipient) => ({
      id: `messageActivity:${recipient.id}`,
      label: "문자",
      title: recipient.student?.name ?? recipient.receiverName,
      meta: `${recipient.job.title} · ${messageStatusText(recipient.status)}`,
      href: "/messages",
      severity: recipient.status === "FAILED" ? "critical" as const : "warning" as const,
    })),
    ...raw.omrUploads.map((upload) => ({
      id: `omrActivity:${upload.id}`,
      label: "OMR",
      title: upload.student?.name ?? upload.exam?.title ?? upload.fileName,
      meta: `${omrStatusText(upload.recognizeStatus)} · ${omrStatusText(upload.gradingStatus)}`,
      href: "/omr",
      severity: upload.recognizeStatus === "FAILED" || upload.gradingStatus === "FAILED" ? "critical" as const : "warning" as const,
    })),
  ];

  return activities.slice(0, DASHBOARD_WIDGET_LIMIT);
}

function buildSummaryCards({
  raw,
  today,
  todayClassCount,
  attendanceChecked,
  attendanceTarget,
  attendanceUnchecked,
  assignmentChecked,
  assignmentTarget,
  assignmentDone,
  assignmentUnchecked,
  urgentCount,
  warningCount,
  managementCount,
  communicationIssueCount,
  omrIssueCount,
}: {
  raw: DashboardRawData;
  today: string;
  todayClassCount: number;
  attendanceChecked: number;
  attendanceTarget: number;
  attendanceUnchecked: number;
  assignmentChecked: number;
  assignmentTarget: number;
  assignmentDone: number;
  assignmentUnchecked: number;
  urgentCount: number;
  warningCount: number;
  managementCount: number;
  communicationIssueCount: number;
  omrIssueCount: number;
}): DashboardSummaryCard[] {
  return [
    {
      id: "todayClasses",
      label: "오늘 수업",
      value: `${todayClassCount}개`,
      note: `출석 ${attendanceChecked}/${attendanceTarget} · 과제 ${assignmentChecked}/${assignmentTarget}`,
      href: `/students?date=${today}`,
      severity: attendanceUnchecked + assignmentUnchecked > 0 ? "warning" : "success",
    },
    {
      id: "urgent",
      label: "긴급 신호",
      value: `${urgentCount}개`,
      note: `주의 ${warningCount}개 · 오늘 먼저 확인`,
      severity: urgentCount > 0 ? "critical" : warningCount > 0 ? "warning" : "success",
    },
    {
      id: "attentionStudents",
      label: "관리 필요 학생",
      value: `${managementCount}명`,
      note: `주의 ${raw.counts.watchStudents}명 · 휴원 ${raw.counts.pausedStudents}명`,
      href: "/students?sort=name",
      severity: managementCount > 0 ? "warning" : "success",
    },
    {
      id: "messages",
      label: "미처리 메시지",
      value: `${communicationIssueCount}건`,
      note: communicationIssueCount > 0 ? "실패/대기 수신자 확인" : "실패 메시지 없음",
      href: "/messages",
      severity: communicationIssueCount > 0 ? "critical" : "success",
    },
    {
      id: "paymentMaterials",
      label: "미납/교재",
      value: "데이터 연결 예정",
      note: "결제·교재 모델 추가 후 자동 표시됩니다.",
      unavailable: true,
      severity: "routine",
    },
    {
      id: "omr",
      label: "OMR/성적 검토",
      value: `${omrIssueCount}건`,
      note: omrIssueCount > 0 ? "인식/채점 검수 필요" : `완료 과제 ${assignmentDone}명`,
      href: "/omr",
      severity: omrIssueCount > 0 ? "warning" : "success",
    },
  ];
}

function buildFilterOptions({
  raw,
  inboxItems,
}: {
  raw: DashboardRawData;
  inboxItems: OperationsInboxItem[];
}): DashboardViewData["filterOptions"] {
  const owners = new Map<string, string>();
  for (const item of inboxItems) {
    if (item.ownerId && item.ownerLabel) owners.set(item.ownerId, item.ownerLabel);
  }

  const types = new Set<DashboardSignalType>(inboxItems.map((item) => item.type));
  const severities = new Set<DashboardSignalSeverity>(inboxItems.map((item) => item.severity));

  return {
    classGroups: raw.classGroups.map((classGroup) => ({ value: classGroup.id, label: classGroup.name })),
    owners: [...owners].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
    signalTypes: [...types].map((type) => ({ value: type, label: DASHBOARD_SIGNAL_LABELS[type] })).sort((a, b) => a.label.localeCompare(b.label)) as DashboardFilterOption[],
    severities: [...severities].map((severity) => ({ value: severity, label: severityLabel(severity) })).sort((a, b) => DASHBOARD_SEVERITY_ORDER[a.value as DashboardSignalSeverity] - DASHBOARD_SEVERITY_ORDER[b.value as DashboardSignalSeverity]) as DashboardFilterOption[],
  };
}

function sortInboxItems(items: OperationsInboxItem[]) {
  return [...items].sort((a, b) => {
    const severity = DASHBOARD_SEVERITY_ORDER[a.severity] - DASHBOARD_SEVERITY_ORDER[b.severity];
    if (severity !== 0) return severity;
    if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
    return (a.dueKey ?? a.dateKey ?? "9999-99-99").localeCompare(b.dueKey ?? b.dateKey ?? "9999-99-99");
  });
}

function isClassOnDate(
  classGroup: {
    startDate: string | null;
    endDate: string | null;
    daysOfWeek: string | null;
    status: string | null;
    lessons: Array<{ lessonDate: string | null }>;
  },
  date: string
) {
  if (effectiveClassStatus(classGroup, date) !== "ACTIVE") return false;

  const savedLessons = classGroup.lessons.filter((lesson) => lesson.lessonDate);
  if (savedLessons.length > 0) return savedLessons.some((lesson) => lesson.lessonDate === date);

  const dateValue = dateFromYmd(date);
  if (!dateValue) return false;
  if (classGroup.startDate && date < classGroup.startDate) return false;
  if (classGroup.endDate && date > classGroup.endDate) return false;

  const daysOfWeek = parseClassDaysOfWeek(classGroup.daysOfWeek);
  return daysOfWeek.includes(dateValue.getDay());
}

function isClassMine(
  classGroup: {
    teacherId: string | null;
    assistantId: string | null;
    classAssistants?: Array<{ assistantId: string }>;
    studentClasses?: Array<{ student?: { teacherId?: string | null; assistantId?: string | null } }>;
  },
  userId: string
) {
  return (
    classGroup.teacherId === userId ||
    classGroup.assistantId === userId ||
    Boolean(classGroup.classAssistants?.some((link) => link.assistantId === userId)) ||
    Boolean(classGroup.studentClasses?.some((membership) => membership.student?.teacherId === userId || membership.student?.assistantId === userId))
  );
}

function dateFromYmd(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function toYmd(value: Date) {
  return value.toISOString().slice(0, 10);
}

function compactActions(actions: Array<DashboardAction | null>): DashboardAction[] {
  return actions.filter((action): action is DashboardAction => Boolean(action));
}

function searchText(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function severityLabel(severity: DashboardSignalSeverity) {
  if (severity === "critical") return "긴급";
  if (severity === "warning") return "주의";
  if (severity === "info") return "확인";
  if (severity === "success") return "정상";
  return "일반";
}

function scopeLabel(role: string) {
  if (role === "TEACHER") return "담당 반 우선";
  if (role === "ASSISTANT") return "조교 업무 우선";
  return "전체 학원";
}
