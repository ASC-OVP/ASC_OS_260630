export type DashboardPanelTone = "default" | "warn" | "danger" | "task" | "success";

export type DashboardUserRole = "ADMIN" | "MANAGER" | "TEACHER" | "ASSISTANT" | string;

export type DashboardSignalSeverity = "critical" | "warning" | "info" | "routine" | "success";

export type DashboardSignalType =
  | "task"
  | "attendance"
  | "assignment"
  | "student"
  | "memo"
  | "message"
  | "omr"
  | "class"
  | "paymentMaterials";

export type DashboardAction = {
  label: string;
  href: string;
  tone?: "primary" | "secondary" | "tertiary" | "danger" | "ghost";
};

export type DashboardSummaryCard = {
  id: string;
  label: string;
  value: string;
  note: string;
  href?: string;
  severity?: DashboardSignalSeverity;
  unavailable?: boolean;
};

export type DashboardDetailRecord = {
  id: string;
  label: string;
  value: string;
  href?: string;
};

export type OperationsInboxItem = {
  id: string;
  type: DashboardSignalType;
  severity: DashboardSignalSeverity;
  title: string;
  targetLabel: string;
  contextLabel: string;
  reason: string;
  statusLabel: string;
  ownerLabel: string;
  ownerId?: string;
  classGroupId?: string;
  className?: string;
  studentId?: string;
  timeLabel: string;
  dateKey?: string;
  dueKey?: string;
  dateScope: "today" | "week" | "open" | "recent";
  isMine: boolean;
  href: string;
  actions: DashboardAction[];
  recentRecords: DashboardDetailRecord[];
  searchText: string;
};

export type DashboardFilterOption = {
  value: string;
  label: string;
};

export type DashboardFilterState = {
  query: string;
  dateScope: "all" | "today" | "week";
  classGroupId: string;
  ownerId: string;
  signalType: DashboardSignalType | "all";
  severity: DashboardSignalSeverity | "all";
};

export type TodayClassOperation = {
  id: string;
  name: string;
  scheduleLabel: string;
  teacherLabel: string;
  roomLabel: string;
  studentCount: number;
  attendanceChecked: number;
  assignmentChecked: number;
  issueCount: number;
  statusLabel: string;
  severity: DashboardSignalSeverity;
  href: string;
  attendanceHref: string;
  assignmentHref: string;
};

export type ManagementStudentItem = {
  id: string;
  name: string;
  className: string;
  contextLabel: string;
  reason: string;
  statusLabel: string;
  severity: DashboardSignalSeverity;
  href: string;
};

export type CommunicationWidgetData = {
  issueCount: number;
  items: Array<{
    id: string;
    title: string;
    meta: string;
    statusLabel: string;
    severity: DashboardSignalSeverity;
    href: string;
  }>;
};

export type OmrScoreWidgetData = {
  issueCount: number;
  items: Array<{
    id: string;
    title: string;
    meta: string;
    statusLabel: string;
    severity: DashboardSignalSeverity;
    href: string;
  }>;
};

export type PaymentMaterialsWidgetData =
  | {
      status: "unavailable";
      reason: "billing_material_models_not_connected";
    }
  | {
      status: "available";
      overdueStudents: number;
      unpaidTuitionCount: number;
      unpaidMaterialCount: number;
      undistributedMaterialCount: number;
      refundReviewCount: number;
      items: Array<{
        id: string;
        studentName: string;
        className?: string;
        itemLabel: string;
        amount?: number;
        statusLabel: string;
        dueText?: string;
        href: string;
      }>;
    };

export type RecentActivityItem = {
  id: string;
  label: string;
  title: string;
  meta: string;
  href: string;
  severity: DashboardSignalSeverity;
};

export type DashboardViewData = {
  academyName: string;
  today: string;
  generatedAtLabel: string;
  userRole: DashboardUserRole;
  userRoleLabel: string;
  scopeLabel: string;
  summaryCards: DashboardSummaryCard[];
  inboxItems: OperationsInboxItem[];
  todayClasses: TodayClassOperation[];
  managementStudents: ManagementStudentItem[];
  communication: CommunicationWidgetData;
  omrScore: OmrScoreWidgetData;
  paymentMaterials: PaymentMaterialsWidgetData;
  recentActivities: RecentActivityItem[];
  filterOptions: {
    classGroups: DashboardFilterOption[];
    owners: DashboardFilterOption[];
    signalTypes: DashboardFilterOption[];
    severities: DashboardFilterOption[];
  };
};
