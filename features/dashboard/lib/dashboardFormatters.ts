export function clipDashboardText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength - 1) + "..." : value;
}

export const studentStatusText: Record<string, string> = {
  ACTIVE: "재원",
  WATCH: "주의",
  PAUSED: "휴원",
  LEFT: "퇴원",
};

export const taskStatusText: Record<string, string> = {
  TODO: "대기",
  IN_PROGRESS: "진행",
  DONE: "완료",
  HOLD: "보류",
  SUBMITTED: "확인",
  REVIEW: "검토",
  REJECTED: "재처리",
  OVERDUE: "기한 초과",
};

export const taskPriorityText: Record<string, string> = {
  LOW: "낮음",
  NORMAL: "보통",
  HIGH: "높음",
  URGENT: "긴급",
};

export const attendanceText: Record<string, string> = {
  PRESENT: "현장",
  LATE: "지각",
  VIDEO: "영상",
  MAKEUP: "보강",
  MATERIAL: "자료",
  EARLY_LEAVE: "조퇴",
  SKIP: "출튀",
  ABSENT: "결석",
  EXCUSED: "부재",
  LEFT: "퇴원",
};

export const assignmentText: Record<string, string> = {
  DONE: "완료",
  PARTIAL: "부분 완료",
  MISSING: "미제출",
  UNCHECKED: "미확인",
};

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" }).format(date);
}

export function formatYmd(value: string | null | undefined) {
  if (!value) return "-";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[1]}.${parts[2]}`;
}

export function formatDueDate(value: Date | null | undefined) {
  if (!value) return "마감 미정";
  return `${formatDateTime(value)} 마감`;
}

export function buildContextLabel(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" · ") || "-";
}

export function messageStatusText(status: string) {
  if (status === "FAILED") return "발송 실패";
  if (status === "PARTIAL_FAILED") return "일부 실패";
  if (status === "PENDING") return "대기";
  if (status === "SENDING") return "발송 중";
  if (status === "BLOCKED") return "차단";
  if (status === "SUCCESS" || status === "SENT") return "성공";
  if (status === "DRY_RUN") return "테스트";
  return status;
}

export function omrStatusText(status: string | null | undefined) {
  if (!status) return "-";
  const labels: Record<string, string> = {
    WAITING: "대기",
    RECOGNIZING: "인식 중",
    RECOGNIZED: "인식 완료",
    REVIEW_NEEDED: "검수 필요",
    FAILED: "실패",
    GRADED: "채점 완료",
    GRADED_REVIEW_NEEDED: "채점 검수",
    NEEDS_PHONE: "전화번호 필요",
    MULTIPLE_MATCHES: "복수 매칭",
    NOT_FOUND: "학생 미매칭",
    MATCHED: "매칭 완료",
    MANUAL: "수동 매칭",
  };
  return labels[status] ?? status;
}
