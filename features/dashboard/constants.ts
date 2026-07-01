import type { DashboardSignalSeverity, DashboardSignalType } from "@/features/dashboard/types";

export const DASHBOARD_LIST_LIMIT = 8;
export const DASHBOARD_MEMO_LIMIT = 8;
export const DASHBOARD_INBOX_LIMIT = 60;
export const DASHBOARD_WIDGET_LIMIT = 6;

export const DASHBOARD_SEVERITY_ORDER: Record<DashboardSignalSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  routine: 3,
  success: 4,
};

export const DASHBOARD_SIGNAL_LABELS: Record<DashboardSignalType, string> = {
  task: "업무",
  attendance: "출결",
  assignment: "과제",
  student: "학생",
  memo: "메모",
  message: "문자",
  omr: "OMR",
  class: "수업",
  paymentMaterials: "미납/교재",
};

export const PAYMENT_MATERIALS_UNAVAILABLE_REASON = "billing_material_models_not_connected";
