import type { CalendarContentFilter, CalendarEventSource, CalendarEventSourceMeta, CalendarEventStatus, CalendarSeverity, CalendarViewMode } from "@/features/calendar/types";

export const CALENDAR_VIEW_MODES: CalendarViewMode[] = ["month", "week", "day"];

export const CALENDAR_EVENT_SOURCES: CalendarEventSource[] = [
  "class_session",
  "internal_task",
  "assistant_work_shift",
  "calendar_private_memo",
  "counseling_followup",
  "payment_due",
  "omr_review",
  "attendance_not_finalized",
  "message_failed",
  "material_distribution",
  "student_lifecycle",
];

export const IMPLEMENTED_CALENDAR_EVENT_SOURCES: CalendarEventSource[] = ["class_session", "internal_task", "assistant_work_shift", "calendar_private_memo"];

export const CALENDAR_CONTENT_FILTERS: Array<{ id: CalendarContentFilter; label: string; description: string }> = [
  { id: "lesson_schedule", label: "회차 일정", description: "수업 회차와 업무 일정을 표시합니다." },
  { id: "assistant_work_shift", label: "조교 출근 일정", description: "등록된 조교 근무 일정을 표시합니다." },
  { id: "private_memo", label: "작성한 메모", description: "내가 작성한 날짜 메모를 표시합니다." },
];

export const CALENDAR_EVENT_SOURCE_META: Record<CalendarEventSource, CalendarEventSourceMeta> = {
  class_session: {
    labelKo: "수업 일정",
    shortLabelKo: "수업",
    descriptionKo: "정규 수업, 저장된 수업 회차, 반 일정입니다.",
    defaultSeverity: "normal",
    isImplemented: true,
    showInSourceFilter: true,
    emptyStateTitleKo: "표시할 수업 일정이 없습니다.",
    emptyStateDescriptionKo: "현재 기간과 필터 조건에 해당하는 수업 일정이 없습니다.",
    tone: "blue",
  },
  internal_task: {
    labelKo: "업무 일정",
    shortLabelKo: "업무",
    descriptionKo: "담당자, 마감일, 진행 상태가 있는 내부 업무입니다.",
    defaultSeverity: "normal",
    isImplemented: true,
    showInSourceFilter: true,
    emptyStateTitleKo: "표시할 업무 일정이 없습니다.",
    emptyStateDescriptionKo: "현재 기간과 필터 조건에 해당하는 업무 일정이 없습니다.",
    tone: "cyan",
  },
  assistant_work_shift: {
    labelKo: "조교 출근 일정",
    shortLabelKo: "출근",
    descriptionKo: "조교 근무일, 출근/퇴근 시간, 근무 상태입니다.",
    defaultSeverity: "normal",
    isImplemented: true,
    showInSourceFilter: true,
    emptyStateTitleKo: "표시할 조교 출근 일정이 없습니다.",
    emptyStateDescriptionKo: "선택한 기간과 직원 화면에 해당하는 출근 일정이 없습니다.",
    tone: "green",
  },
  calendar_private_memo: {
    labelKo: "작성한 메모",
    shortLabelKo: "메모",
    descriptionKo: "캘린더 날짜에 직접 작성한 개인 메모입니다.",
    defaultSeverity: "normal",
    isImplemented: true,
    showInSourceFilter: true,
    emptyStateTitleKo: "표시할 작성 메모가 없습니다.",
    emptyStateDescriptionKo: "선택한 기간에 작성한 개인 메모가 없습니다.",
    tone: "orange",
  },
  counseling_followup: {
    labelKo: "상담 follow-up",
    shortLabelKo: "상담",
    descriptionKo: "상담 예정일 또는 후속 조치가 필요한 상담 일정입니다.",
    defaultSeverity: "warning",
    isImplemented: false,
    showInSourceFilter: true,
    emptyStateTitleKo: "연결된 상담 일정이 없습니다.",
    emptyStateDescriptionKo: "상담 데이터 연결 후 이 필터에서 상담 예정 및 follow-up 일정을 확인할 수 있습니다.",
    tone: "purple",
  },
  payment_due: {
    labelKo: "결제 마감",
    shortLabelKo: "결제",
    descriptionKo: "납부 마감, 연체, 환불 검토 등 결제 관련 일정입니다.",
    defaultSeverity: "critical",
    isImplemented: false,
    showInSourceFilter: true,
    emptyStateTitleKo: "연결된 결제 일정이 없습니다.",
    emptyStateDescriptionKo: "결제 데이터 연결 후 마감/연체 일정을 확인할 수 있습니다.",
    tone: "red",
  },
  omr_review: {
    labelKo: "OMR 검토",
    shortLabelKo: "OMR",
    descriptionKo: "OMR 인식 오류, 검토 필요, 성적 확정 대기 일정입니다.",
    defaultSeverity: "warning",
    isImplemented: false,
    showInSourceFilter: true,
    emptyStateTitleKo: "연결된 OMR 검토 일정이 없습니다.",
    emptyStateDescriptionKo: "OMR 데이터 연결 후 검토 필요 항목을 확인할 수 있습니다.",
    tone: "orange",
  },
  attendance_not_finalized: {
    labelKo: "출결 미완료",
    shortLabelKo: "출결",
    descriptionKo: "수업 후 출결 입력 또는 확정이 필요한 일정입니다.",
    defaultSeverity: "warning",
    isImplemented: false,
    showInSourceFilter: true,
    emptyStateTitleKo: "연결된 출결 미완료 일정이 없습니다.",
    emptyStateDescriptionKo: "출결 데이터 연결 후 미입력/미확정 수업을 확인할 수 있습니다.",
    tone: "orange",
  },
  message_failed: {
    labelKo: "문자 실패",
    shortLabelKo: "문자",
    descriptionKo: "발송 실패 또는 재시도가 필요한 메시지 관련 일정입니다.",
    defaultSeverity: "critical",
    isImplemented: false,
    showInSourceFilter: true,
    emptyStateTitleKo: "연결된 문자 실패 일정이 없습니다.",
    emptyStateDescriptionKo: "문자 발송 데이터 연결 후 실패 및 재시도 필요 항목을 확인할 수 있습니다.",
    tone: "red",
  },
  material_distribution: {
    labelKo: "교재/자료 배부",
    shortLabelKo: "교재",
    descriptionKo: "교재 결제, 미수령, 배부 필요 일정입니다.",
    defaultSeverity: "warning",
    isImplemented: false,
    showInSourceFilter: true,
    emptyStateTitleKo: "연결된 교재/자료 일정이 없습니다.",
    emptyStateDescriptionKo: "교재 데이터 연결 후 결제 및 배부 상태를 확인할 수 있습니다.",
    tone: "green",
  },
  student_lifecycle: {
    labelKo: "학생 상태 변경",
    shortLabelKo: "상태",
    descriptionKo: "신규 등록, 휴원, 퇴원, 재등록 후보 등 학생 lifecycle 이벤트입니다.",
    defaultSeverity: "warning",
    isImplemented: false,
    showInSourceFilter: true,
    emptyStateTitleKo: "연결된 학생 상태 일정이 없습니다.",
    emptyStateDescriptionKo: "학생 lifecycle 데이터 연결 후 상태 변경 및 후속 조치 일정을 확인할 수 있습니다.",
    tone: "gray",
  },
};

export const CALENDAR_STATUS_META: Record<CalendarEventStatus, { labelKo: string; tone: CalendarSeverity }> = {
  scheduled: { labelKo: "예정", tone: "normal" },
  in_progress: { labelKo: "진행 중", tone: "normal" },
  completed: { labelKo: "완료", tone: "resolved" },
  delayed: { labelKo: "지연", tone: "critical" },
  cancelled: { labelKo: "취소", tone: "inactive" },
  needs_review: { labelKo: "검토 필요", tone: "warning" },
  unassigned: { labelKo: "담당자 미배정", tone: "warning" },
};

export const CALENDAR_SEVERITY_META: Record<CalendarSeverity, { labelKo: string }> = {
  critical: { labelKo: "긴급" },
  warning: { labelKo: "주의" },
  normal: { labelKo: "일반" },
  resolved: { labelKo: "해결됨" },
  inactive: { labelKo: "비활성" },
};

export const CALENDAR_DEFAULT_FILTERS = {
  contentTypes: ["lesson_schedule", "assistant_work_shift", "private_memo"],
  staffId: "all",
} satisfies { contentTypes: CalendarContentFilter[]; staffId: string };
