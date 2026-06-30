export type CalendarEventSource =
  | "class_session"
  | "internal_task"
  | "assistant_work_shift"
  | "calendar_private_memo"
  | "counseling_followup"
  | "payment_due"
  | "omr_review"
  | "attendance_not_finalized"
  | "message_failed"
  | "material_distribution"
  | "student_lifecycle";

export type CalendarEventStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "delayed"
  | "cancelled"
  | "needs_review"
  | "unassigned";

export type CalendarSeverity = "critical" | "warning" | "normal" | "resolved" | "inactive";

export type CalendarViewMode = "month" | "week" | "day";

export type CalendarDisplayMode = "calendar" | "list";

export type CalendarContentFilter = "lesson_schedule" | "assistant_work_shift" | "private_memo";

export type CalendarFilterValue = {
  contentTypes: CalendarContentFilter[];
  staffId: string;
};

export type CalendarFilterOption = {
  id: string;
  label: string;
};

export type CalendarEventSourceMeta = {
  labelKo: string;
  shortLabelKo: string;
  descriptionKo: string;
  defaultSeverity: CalendarSeverity;
  isImplemented: boolean;
  showInSourceFilter: boolean;
  emptyStateTitleKo: string;
  emptyStateDescriptionKo: string;
  tone: "blue" | "cyan" | "orange" | "red" | "green" | "purple" | "gray";
};

export type CalendarEventLinkTargets = {
  classGroupId?: string;
  taskId?: string;
  studentId?: string;
  workShiftId?: string;
  paymentId?: string;
  counselingId?: string;
  messageId?: string;
  examId?: string;
  materialId?: string;
};

export type AcademyCalendarEvent = CalendarEventLinkTargets & {
  id: string;
  sourceKey: string;
  occurrenceKey: string;
  source: CalendarEventSource;
  status: CalendarEventStatus;
  severity: CalendarSeverity;

  title: string;
  subtitle?: string;
  description?: string | null;

  startAt: string;
  endAt?: string;
  isAllDay?: boolean;
  isRecurring?: boolean;
  recurrenceLabelKo?: string;
  repeatDaysOfWeek?: number[];
  startRecur?: string;
  endRecur?: string;
  startTime?: string;
  endTime?: string;

  ownerLabel?: string | null;
  ownerIds?: string[];
  teacherId?: string | null;
  assistantId?: string | null;
  assigneeId?: string | null;
  assigneeIds?: string[];
  isUnassigned?: boolean;

  className?: string | null;
  subject?: string | null;
  grade?: string | null;
  room?: string | null;
  expectedStudentCount?: number | null;

  studentName?: string | null;

  sourceStatusRaw?: string;
  sourceColor?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type CalendarEventMemoView = {
  eventKey: string;
  eventDate: string;
  content: string;
  updatedAt: string;
  writerName: string | null;
};

export type MaterializedCalendarEvent = AcademyCalendarEvent & {
  occurrenceKey: string;
  dateKey: string;
  startText: string;
  endText: string;
  displayTime: string;
};

export type SelectedCalendarEvent = MaterializedCalendarEvent;
