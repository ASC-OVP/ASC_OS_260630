type ScoreRecordLike = {
  date: string;
  title: string;
  score: number | null;
  maxScore?: number | null;
};

type StudentTestScoreLike = {
  score: number | null;
  totalScore?: number | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  exam?: { title: string; examDate: string | null } | null;
  classTest?: { name: string } | null;
};

type AttendanceRecordLike = {
  date: string;
  status: string;
};

type AssignmentRecordLike = {
  date: string;
  status: string;
};

export type ClassStatsStudent = {
  id: string;
  name: string;
  scoreRecords: ScoreRecordLike[];
  testScores?: StudentTestScoreLike[];
  attendanceRecords: AttendanceRecordLike[];
  assignmentRecords: AssignmentRecordLike[];
};

export type ClassStats = {
  studentCount: number;
  averageScore: number | null;
  medianScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  standardDeviation: number | null;
  attendanceRate: number | null;
  attendanceCheckRate: number | null;
  assignmentCompletionRate: number | null;
  assignmentCheckRate: number | null;
  missingAssignmentCount: number;
  improvedCount: number;
  declinedCount: number;
  scoreTrend: Array<{ label: string; value: number }>;
  studentScores: Array<{ id: string; name: string; score: number | null }>;
  attendanceTrend: Array<{ label: string; value: number }>;
  attendanceStatusTrend: Array<{
    label: string;
    total: number;
    checkedCount: number;
    checkRate: number;
    positiveRate: number;
    negativeRate: number;
    segments: Array<{ status: string; label: string; count: number; color: string; tone: "positive" | "negative" | "neutral" }>;
  }>;
  assignmentTrend: Array<{ label: string; value: number }>;
};

const absentStatuses = new Set(["ABSENT", "SKIP", "LEFT", "x", "X"]);
const doneAssignmentStatuses = new Set(["DONE", "PARTIAL"]);
const missingAssignmentStatuses = new Set(["MISSING"]);
const uncheckedAssignmentStatuses = new Set(["UNCHECKED"]);
const positiveAttendanceStatuses = new Set(["PRESENT", "o", "O", "출석", "현장", "LATE", "VIDEO", "MAKEUP", "MATERIAL", "EARLY_LEAVE"]);
const negativeAttendanceStatuses = new Set(["ABSENT", "x", "X", "결석", "SKIP", "LEFT"]);
const attendanceStatusOrder = ["PRESENT", "출석", "현장", "o", "O", "LATE", "VIDEO", "MAKEUP", "MATERIAL", "EARLY_LEAVE", "ABSENT", "결석", "x", "X", "SKIP", "LEFT", "EXCUSED", "UNCHECKED"];
const attendanceStatusMeta: Record<string, { label: string; color: string; tone: "positive" | "negative" | "neutral" }> = {
  PRESENT: { label: "현장", color: "#15803d", tone: "positive" },
  출석: { label: "출석", color: "#16a34a", tone: "positive" },
  현장: { label: "현장", color: "#166534", tone: "positive" },
  o: { label: "o", color: "#22c55e", tone: "positive" },
  O: { label: "O", color: "#4ade80", tone: "positive" },
  LATE: { label: "지각", color: "#65a30d", tone: "positive" },
  VIDEO: { label: "영상", color: "#059669", tone: "positive" },
  MAKEUP: { label: "보강", color: "#0d9488", tone: "positive" },
  MATERIAL: { label: "자료", color: "#14b8a6", tone: "positive" },
  EARLY_LEAVE: { label: "조퇴", color: "#84cc16", tone: "positive" },
  ABSENT: { label: "결석", color: "#b91c1c", tone: "negative" },
  결석: { label: "결석", color: "#dc2626", tone: "negative" },
  x: { label: "x", color: "#ef4444", tone: "negative" },
  X: { label: "X", color: "#f87171", tone: "negative" },
  SKIP: { label: "출튀", color: "#991b1b", tone: "negative" },
  LEFT: { label: "퇴원", color: "#7f1d1d", tone: "negative" },
  EXCUSED: { label: "부재", color: "#64748b", tone: "neutral" },
  UNCHECKED: { label: "미체크", color: "#cbd5e1", tone: "neutral" },
};

export function buildClassStats(students: ClassStatsStudent[]): ClassStats {
  const latestScores = students
    .map((student) => latestStudentScore(student)?.score ?? null)
    .filter((score): score is number => typeof score === "number");
  const sortedScores = [...latestScores].sort((a, b) => a - b);
  const attendanceRecords = students.flatMap((student) => student.attendanceRecords);
  const assignmentRecords = students.flatMap((student) => student.assignmentRecords);
  const improvedDeclined = students.reduce(
    (acc, student) => {
      const records = sortedScoreEntries(student).filter((record) => typeof record.score === "number");
      if (records.length < 2) return acc;
      const latest = records[0].score ?? 0;
      const previous = records[1].score ?? 0;
      if (latest > previous) acc.improved += 1;
      if (latest < previous) acc.declined += 1;
      return acc;
    },
    { improved: 0, declined: 0 }
  );

  return {
    studentCount: students.length,
    averageScore: average(latestScores),
    medianScore: median(sortedScores),
    highestScore: sortedScores.length ? sortedScores[sortedScores.length - 1] : null,
    lowestScore: sortedScores.length ? sortedScores[0] : null,
    standardDeviation: stddev(latestScores),
    attendanceRate: attendanceRecords.length
      ? Math.round((attendanceRecords.filter((record) => !absentStatuses.has(record.status)).length / attendanceRecords.length) * 100)
      : null,
    attendanceCheckRate: attendanceCheckRate(attendanceRecords, students.length),
    assignmentCompletionRate: assignmentRecords.length
      ? Math.round((assignmentRecords.filter((record) => doneAssignmentStatuses.has(record.status)).length / assignmentRecords.length) * 100)
      : null,
    assignmentCheckRate: assignmentRecords.length
      ? Math.round((assignmentRecords.filter((record) => !uncheckedAssignmentStatuses.has(record.status)).length / assignmentRecords.length) * 100)
      : null,
    missingAssignmentCount: assignmentRecords.filter((record) => missingAssignmentStatuses.has(record.status)).length,
    improvedCount: improvedDeclined.improved,
    declinedCount: improvedDeclined.declined,
    scoreTrend: scoreTrend(students),
    studentScores: students.map((student) => ({
      id: student.id,
      name: student.name,
      score: latestStudentScore(student)?.score ?? null,
    })),
    attendanceTrend: rateTrend(attendanceRecords, (record) => !absentStatuses.has(record.status)),
    attendanceStatusTrend: attendanceStatusTrend(attendanceRecords, students.length),
    assignmentTrend: rateTrend(assignmentRecords, (record) => doneAssignmentStatuses.has(record.status)),
  };
}

export function latestScore(records: ScoreRecordLike[]) {
  return sortedScoreRecords(records).find((record) => typeof record.score === "number") ?? null;
}

export function latestStudentScore(student: Pick<ClassStatsStudent, "scoreRecords" | "testScores">) {
  return sortedScoreEntries(student).find((record) => typeof record.score === "number") ?? null;
}

function sortedScoreRecords(records: ScoreRecordLike[]) {
  return [...records].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.title.localeCompare(a.title);
  });
}

function sortedScoreEntries(student: Pick<ClassStatsStudent, "scoreRecords" | "testScores">) {
  return [
    ...student.scoreRecords.map((record) => ({
      date: record.date,
      title: record.title,
      score: record.score,
    })),
    ...(student.testScores ?? []).map((record) => ({
      date: record.exam?.examDate ?? dateKey(record.updatedAt ?? record.createdAt),
      title: record.exam?.title ?? record.classTest?.name ?? "시험",
      score: record.score,
    })),
  ].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.title.localeCompare(a.title);
  });
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(sortedValues: number[]) {
  if (sortedValues.length === 0) return null;
  const middle = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) return round1(sortedValues[middle]);
  return round1((sortedValues[middle - 1] + sortedValues[middle]) / 2);
}

function stddev(values: number[]) {
  const avg = average(values);
  if (avg === null || values.length <= 1) return null;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return round1(Math.sqrt(variance));
}

function scoreTrend(students: ClassStatsStudent[]) {
  const byLabel = new Map<string, number[]>();
  for (const student of students) {
    for (const record of sortedScoreEntries(student)) {
      if (typeof record.score !== "number") continue;
      const label = record.title ? `${record.date} ${record.title}` : record.date;
      const values = byLabel.get(label) ?? [];
      values.push(record.score);
      byLabel.set(label, values);
    }
  }

  return [...byLabel.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([label, values]) => ({ label, value: average(values) ?? 0 }));
}

function dateKey(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function rateTrend<T extends { date: string }>(records: T[], isPositive: (record: T) => boolean) {
  const byDate = new Map<string, T[]>();
  for (const record of records) {
    const values = byDate.get(record.date) ?? [];
    values.push(record);
    byDate.set(record.date, values);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([label, values]) => ({
      label,
      value: Math.round((values.filter(isPositive).length / values.length) * 100),
    }));
}

function attendanceCheckRate(records: AttendanceRecordLike[], studentCount: number) {
  if (records.length === 0 || studentCount === 0) return null;
  const dateCount = new Set(records.map((record) => record.date)).size;
  const expectedCount = dateCount * studentCount;
  return expectedCount > 0 ? Math.round((records.length / expectedCount) * 100) : null;
}

function attendanceStatusTrend(records: AttendanceRecordLike[], studentCount: number) {
  const byDate = new Map<string, AttendanceRecordLike[]>();
  for (const record of records) {
    const values = byDate.get(record.date) ?? [];
    values.push(record);
    byDate.set(record.date, values);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([label, values]) => {
      const counts = new Map<string, number>();
      for (const record of values) {
        counts.set(record.status, (counts.get(record.status) ?? 0) + 1);
      }

      const total = Math.max(studentCount, values.length);
      const uncheckedCount = Math.max(total - values.length, 0);
      if (uncheckedCount > 0) counts.set("UNCHECKED", uncheckedCount);

      const positiveCount = [...counts.entries()]
        .filter(([status]) => attendanceTone(status) === "positive")
        .reduce((sum, [, count]) => sum + count, 0);
      const negativeCount = [...counts.entries()]
        .filter(([status]) => attendanceTone(status) === "negative")
        .reduce((sum, [, count]) => sum + count, 0);
      const orderedStatuses = [
        ...attendanceStatusOrder,
        ...[...counts.keys()].filter((status) => !attendanceStatusOrder.includes(status)).sort((a, b) => a.localeCompare(b)),
      ];

      return {
        label,
        total,
        checkedCount: values.length,
        checkRate: total > 0 ? Math.round((values.length / total) * 100) : 0,
        positiveRate: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
        negativeRate: total > 0 ? Math.round((negativeCount / total) * 100) : 0,
        segments: orderedStatuses
          .map((status) => {
            const meta = attendanceStatusMeta[status] ?? fallbackAttendanceMeta(status);
            return { status, label: meta.label, count: counts.get(status) ?? 0, color: meta.color, tone: meta.tone };
          })
          .filter((segment) => segment.count > 0),
      };
    });
}

function attendanceTone(status: string) {
  if (attendanceStatusMeta[status]) return attendanceStatusMeta[status].tone;
  if (positiveAttendanceStatuses.has(status) || /출석|현장|참석|완료|등원|ok/i.test(status)) return "positive";
  if (negativeAttendanceStatuses.has(status) || /결석|불참|미출석|absent|^x$/i.test(status)) return "negative";
  return "neutral";
}

function fallbackAttendanceMeta(status: string) {
  const tone = attendanceTone(status);
  if (tone === "positive") return { label: status, color: "#22c55e", tone };
  if (tone === "negative") return { label: status, color: "#ef4444", tone };
  return { label: status, color: "#64748b", tone };
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
