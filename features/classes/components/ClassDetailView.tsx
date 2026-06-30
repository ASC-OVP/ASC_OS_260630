import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { createClassMemoAction, deleteClassMemoAction } from "@/features/classes/actions/classActions";
import ClassEditModal from "@/features/classes/components/ClassEditModal";
import StudentScoreBarList from "@/features/classes/components/StudentScoreBarList";
import { buildClassStats, latestStudentScore } from "@/lib/classGroupStats";
import {
  canManageClassGroup,
  canViewClassGroup,
  classStatusLabel,
  classStatusTone,
  computeClassOperationStats,
  effectiveClassStatus,
  formatClassSchedule,
  formatOperatingPeriod,
} from "@/lib/classGroups";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPhoneNumber } from "@/lib/phone";

type Props = {
  params: Promise<{ classGroupId: string }>;
};

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({ params }: Props) {
  const user = await requireUser();
  const { classGroupId } = await params;
  const since = daysAgo(120);

  const [staff, classGroup, roomRows] = await Promise.all([
    prisma.user.findMany({
      where: { academyId: user.academyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    prisma.classGroup.findFirst({
      where: { id: classGroupId, academyId: user.academyId },
      include: {
        teacher: { select: { id: true, name: true } },
        assistant: { select: { id: true, name: true } },
        classAssistants: {
          orderBy: { createdAt: "asc" },
          include: { assistant: { select: { id: true, name: true } } },
        },
        memos: {
          orderBy: { createdAt: "desc" },
          include: { writer: { select: { id: true, name: true } } },
        },
        tasks: {
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 8,
          include: {
            assignee: { select: { name: true } },
          },
        },
        studentClasses: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          include: {
            student: {
              include: {
                memos: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
                scoreRecords: {
                  where: { date: { gte: since } },
                  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
                  take: 10,
                },
                testScores: {
                  where: { classGroupId },
                  orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
                  take: 10,
                  include: {
                    exam: { select: { title: true, examDate: true } },
                    classTest: { select: { name: true } },
                  },
                },
                attendanceRecords: {
                  where: { date: { gte: since } },
                  orderBy: { date: "desc" },
                },
                assignmentRecords: {
                  where: { date: { gte: since } },
                  orderBy: { date: "desc" },
                },
              },
            },
          },
        },
      },
    }),
    prisma.$queryRaw<Array<{ room: string | null }>>`SELECT "room" FROM "ClassGroup" WHERE "id" = ${classGroupId} AND "academyId" = ${user.academyId} LIMIT 1`,
  ]);

  if (!classGroup || !canViewClassGroup(user, classGroup)) notFound();

  const classRoom = roomRows[0]?.room ?? null;
  const teachers = staff.filter((member) => member.role === "ADMIN" || member.role === "MANAGER" || member.role === "TEACHER");
  const assistants = staff.filter((member) => member.role === "ASSISTANT");
  const canManage = canManageClassGroup(user, classGroup);
  const students = classGroup.studentClasses.map((membership) => membership.student);
  const stats = buildClassStats(students);
  const effectiveStatus = effectiveClassStatus(classGroup);
  const operationStats = computeClassOperationStats(classGroup);
  const sortedStudentScores = [...stats.studentScores].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <main style={page}>
      <section style={container}>
        <div style={header}>
          <PageHeader
            eyebrow={<Link href="/classes" style={backLink}>반 관리</Link>}
            title={classGroup.name}
            description={`${classGroup.teacher?.name ?? "담당 강사 미지정"} / ${formatClassSchedule(classGroup)} / ${stats.studentCount}명`}
            meta={<StatusBadge status={effectiveStatus} />}
            actions={<ButtonLink href={`/students?classGroupId=${classGroup.id}`} size="sm">현황판에서 보기</ButtonLink>}
          />
        </div>

        <section style={grid}>
          <section style={leftCol}>
            <Panel title="반 기본 정보">
              <div style={infoGrid}>
                <Info label="담당 강사" value={classGroup.teacher?.name ?? "-"} />
                <Info label="담당 조교" value={assistantNames(classGroup)} />
                <Info label="과목" value={classGroup.subject ?? "-"} />
                <Info label="학년" value={classGroup.grade ?? "-"} />
                <Info label="운영 기간" value={formatOperatingPeriod(classGroup)} />
                <Info label="운영 주차" value={formatWeekProgress(operationStats.currentWeek, operationStats.totalWeeks)} />
                <Info label="수업 진행" value={formatSessionProgress(operationStats.pastSessions, operationStats.totalSessions)} />
                <Info label="남은 수업" value={operationStats.remainingSessions === null ? "-" : `${operationStats.remainingSessions}회`} />
                <Info label="요일/시간" value={formatClassSchedule(classGroup)} />
                <Info label="강의실" value={classRoom ?? "-"} />
                <Info label="상태" value={classStatusLabel(effectiveStatus)} />
              </div>
              {classGroup.description && <p style={noteBox}>{classGroup.description}</p>}
              {canManage && (
                <div style={editAction}>
                  <ClassEditModal
                    classGroup={{
                      id: classGroup.id,
                      name: classGroup.name,
                      teacherId: classGroup.teacherId,
                      teacherName: classGroup.teacher?.name ?? null,
                      assistantIds: classGroup.classAssistants?.map((link) => link.assistantId) ?? (classGroup.assistantId ? [classGroup.assistantId] : []),
                      subject: classGroup.subject,
                      grade: classGroup.grade,
                      startDate: classGroup.startDate,
                      endDate: classGroup.endDate,
                      daysOfWeek: classGroup.daysOfWeek,
                      startTime: classGroup.startTime,
                      endTime: classGroup.endTime,
                      room: classRoom,
                      status: classGroup.status,
                      description: classGroup.description,
                      iconText: classGroup.iconText,
                      iconColor: classGroup.iconColor,
                    }}
                    teachers={teachers}
                    assistants={assistants}
                    currentUserId={user.id}
                    currentUserRole={user.role}
                  />
                </div>
              )}
            </Panel>

            <Panel title="반 메모">
              <form action={createClassMemoAction} style={memoForm}>
                <input type="hidden" name="classGroupId" value={classGroup.id} />
                <textarea name="content" rows={3} placeholder="예: 다음 주 보강 대상 3명 확인 필요" style={{ ...input, resize: "vertical" }} />
                <button style={primaryButton}>메모 추가</button>
              </form>
              <div style={memoList}>
                {classGroup.memos.map((memo) => (
                  <article key={memo.id} style={memoItem}>
                    <div style={memoMeta}>
                      <b>{memo.writer.name}</b>
                      <span>{new Date(memo.createdAt).toLocaleString("ko-KR")}</span>
                    </div>
                    <p>{memo.content}</p>
                    {(memo.writerId === user.id || canManage) && (
                      <form action={deleteClassMemoAction}>
                        <input type="hidden" name="memoId" value={memo.id} />
                        <button style={textButton}>삭제</button>
                      </form>
                    )}
                  </article>
                ))}
                {classGroup.memos.length === 0 && <Empty>아직 반 메모가 없습니다.</Empty>}
              </div>
            </Panel>
          </section>

          <section style={rightCol}>
            <section style={summaryGrid}>
              <Summary label="학생 수" value={`${stats.studentCount}명`} />
              <Summary label="현재 주차" value={formatWeekProgress(operationStats.currentWeek, operationStats.totalWeeks)} />
              <Summary label="예정 수업" value={operationStats.totalSessions === null ? "-" : `${operationStats.totalSessions}회`} />
              <Summary label="진행 수업" value={operationStats.pastSessions === null ? "-" : `${operationStats.pastSessions}회`} />
              <Summary label="남은 수업" value={operationStats.remainingSessions === null ? "-" : `${operationStats.remainingSessions}회`} />
              <Summary label="최근 평균" value={stats.averageScore === null ? "-" : `${stats.averageScore}점`} />
              <Summary label="중간값" value={stats.medianScore === null ? "-" : `${stats.medianScore}점`} />
              <Summary label="최고/최저" value={stats.highestScore === null ? "-" : `${stats.highestScore}/${stats.lowestScore}`} />
              <Summary label="표준편차" value={stats.standardDeviation === null ? "-" : String(stats.standardDeviation)} />
              <Summary label="출석 체크율" value={stats.attendanceCheckRate === null ? "-" : `${stats.attendanceCheckRate}%`} />
              <Summary label="과제 체크율" value={stats.assignmentCheckRate === null ? "-" : `${stats.assignmentCheckRate}%`} />
              <Summary label="미제출" value={`${stats.missingAssignmentCount}건`} />
              <Summary label="상승/하락" value={`${stats.improvedCount}/${stats.declinedCount}명`} />
            </section>

            <section style={chartGrid}>
              <Panel title="시험 평균 변화">
                <MiniLineChart data={stats.scoreTrend} suffix="점" />
              </Panel>
              <Panel title="학생별 최근 점수">
                <StudentScoreBarList data={sortedStudentScores.map((item) => ({ id: item.id, label: item.name, value: item.score }))} />
              </Panel>
              <Panel title="출석 체크 현황 변화">
                <AttendanceStatusBarChart data={stats.attendanceStatusTrend} />
              </Panel>
              <Panel title="과제 완료율 변화">
                <MiniValueBarChart data={stats.assignmentTrend} suffix="%" max={100} />
              </Panel>
            </section>

            <Panel title="반별 학생 목록" right={<span style={muted}>{students.length}명</span>}>
              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <Th>이름</Th>
                      <Th>학교</Th>
                      <Th>학년</Th>
                      <Th>연락처</Th>
                      <Th>최근 출석</Th>
                      <Th>과제</Th>
                      <Th>최근 점수</Th>
                      <Th>최근 메모</Th>
                      <Th>상세</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const attendance = latestByDate(student.attendanceRecords);
                      const assignment = latestByDate(student.assignmentRecords);
                      const score = latestStudentScore(student);
                      return (
                        <tr key={student.id}>
                          <Td><Link href={`/students/${student.id}`} style={nameLink}>{student.name}</Link></Td>
                          <Td>{student.schoolName ?? "-"}</Td>
                          <Td>{student.grade ?? "-"}</Td>
                          <Td>{formatPhoneNumber(student.phone ?? "") || "-"}</Td>
                          <Td>{attendance ? `${attendance.date} / ${attendance.status}` : "-"}</Td>
                          <Td>{assignment ? `${assignment.date} / ${assignment.status}` : "-"}</Td>
                          <Td>{score?.score ?? "-"}</Td>
                          <Td>{student.memos[0]?.content ?? student.memo ?? "-"}</Td>
                          <Td><Link href={`/students/${student.id}`} style={smallLink}>보기</Link></Td>
                        </tr>
                      );
                    })}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={9} style={empty}>이 반에 배정된 학생이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="업무 기록">
              <div style={taskList}>
                {classGroup.tasks.map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`} style={taskItem}>
                    <b>{task.title}</b>
                    <span>{task.assignee.name} / {task.status} / {task.dueDate ? new Date(task.dueDate).toLocaleString("ko-KR") : "기한 없음"}</span>
                  </Link>
                ))}
                {classGroup.tasks.length === 0 && <Empty>연결된 업무가 없습니다.</Empty>}
              </div>
            </Panel>
          </section>
        </section>
      </section>
    </main>
  );
}

function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section style={panel}>
      <div style={panelHead}>
        <h2 style={sectionTitle}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryCard}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoItem}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function assistantNames(classGroup: { assistant?: { name: string } | null; classAssistants?: Array<{ assistant: { name: string } }> }) {
  const names = classGroup.classAssistants?.map((link) => link.assistant.name).filter(Boolean) ?? [];
  return names.length > 0 ? names.join(", ") : classGroup.assistant?.name ?? "-";
}

function StatusBadge({ status }: { status: string }) {
  return <span style={{ ...statusBadge, color: classStatusTone(status), borderColor: `${classStatusTone(status)}55` }}>{classStatusLabel(status)}</span>;
}

function formatWeekProgress(currentWeek: number | null, totalWeeks: number | null) {
  if (currentWeek === null || totalWeeks === null) return "-";
  if (currentWeek <= 0) return `시작 전 / 총 ${totalWeeks}주`;
  return `${currentWeek}주차 / 총 ${totalWeeks}주`;
}

function formatSessionProgress(pastSessions: number | null, totalSessions: number | null) {
  if (pastSessions === null || totalSessions === null) return "-";
  return `총 ${totalSessions}회 중 ${pastSessions}회 진행`;
}

function MiniLineChart({ data, suffix, max }: { data: Array<{ label: string; value: number }>; suffix: string; max?: number }) {
  if (data.length === 0) return <Empty>표시할 기록이 없습니다.</Empty>;
  const highest = max ?? Math.max(...data.map((item) => item.value), 1);
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = 100 - (item.value / highest) * 82 - 8;
    return `${x},${Math.max(8, Math.min(92, y))}`;
  }).join(" ");

  return (
    <div>
      <svg viewBox="0 0 100 100" style={lineChart} preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="#0b50d0" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={chartLegend}>
        {data.map((item) => <span key={item.label}>{shortLabel(item.label)} {item.value}{suffix}</span>)}
      </div>
    </div>
  );
}

function MiniValueBarChart({ data, suffix, max }: { data: Array<{ label: string; value: number }>; suffix: string; max?: number }) {
  if (data.length === 0) return <Empty>표시할 기록이 없습니다.</Empty>;
  const highest = max ?? Math.max(...data.map((item) => item.value), 1);
  return (
    <div style={barList}>
      {data.map((item) => (
        <div key={item.label} style={barRow}>
          <span>{item.label}</span>
          <div style={barTrack}><div style={{ ...barFill, width: `${Math.max(4, (item.value / highest) * 100)}%` }} /></div>
          <b>{item.value}{suffix}</b>
        </div>
      ))}
    </div>
  );
}

function AttendanceStatusBarChart({
  data,
}: {
  data: Array<{
    label: string;
    total: number;
    checkedCount: number;
    checkRate: number;
    positiveRate: number;
    negativeRate: number;
    segments: Array<{ status: string; label: string; count: number; color: string; tone: "positive" | "negative" | "neutral" }>;
  }>;
}) {
  if (data.length === 0) return <Empty>표시할 기록이 없습니다.</Empty>;
  const legendItems = uniqueSegments(data);

  return (
    <div style={statusChart}>
      <div style={statusRows}>
        {data.map((item) => (
          <div key={item.label} style={statusRow}>
            <span style={statusDate}>{shortDate(item.label)}</span>
            <div style={statusStackTrack} aria-label={`${item.label} 출석 체크 ${item.checkedCount}/${item.total}`}>
              {item.segments.map((segment) => (
                <span
                  key={`${item.label}-${segment.status}`}
                  title={`${segment.label} ${segment.count}명`}
                  style={{
                    ...statusSegment,
                    width: `${item.total > 0 ? (segment.count / item.total) * 100 : 0}%`,
                    background: segment.color,
                  }}
                />
              ))}
            </div>
            <div style={statusRateGroup}>
              <b style={statusPositiveRate}>출석 {item.positiveRate}%</b>
              <b style={statusNegativeRate}>결석 {item.negativeRate}%</b>
            </div>
          </div>
        ))}
      </div>
      <div style={statusLegend}>
        {legendItems.map((segment) => (
          <span key={segment.status} style={statusLegendItem}>
            <i style={{ ...statusLegendDot, background: segment.color }} />
            {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={th}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={td}>{children}</td>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div style={empty}>{children}</div>;
}

function latestByDate<T extends { date: string }>(records: T[]) {
  return [...records].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

function shortLabel(label: string) {
  return label.length > 8 ? label.slice(5, 10) : label;
}

function shortDate(label: string) {
  return label.length >= 10 ? label.slice(5, 10) : label;
}

function uniqueSegments(
  data: Array<{ segments: Array<{ status: string; label: string; count: number; color: string; tone: "positive" | "negative" | "neutral" }> }>
) {
  const segments = new Map<string, { status: string; label: string; color: string; tone: "positive" | "negative" | "neutral" }>();
  for (const item of data) {
    for (const segment of item.segments) {
      if (!segments.has(segment.status)) segments.set(segment.status, segment);
    }
  }
  return [...segments.values()];
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const page: CSSProperties = { padding: 12, background: "var(--asc-bg-subtle)", color: "var(--asc-text)", minHeight: "100vh" };
const container: CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };
const header: CSSProperties = { background: "var(--asc-surface)", border: "1px solid var(--asc-border)", borderRadius: "var(--asc-radius-lg)", padding: 14 };
const backLink: CSSProperties = { color: "var(--asc-primary-deep)", fontWeight: 850, textDecoration: "none", fontSize: 13 };
const primaryButton: CSSProperties = { border: 0, borderRadius: 8, background: "#111827", color: "#fff", padding: "9px 12px", fontWeight: 950, textDecoration: "none", cursor: "pointer" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(330px, 380px) minmax(0, 1fr)", gap: 14, alignItems: "start" };
const leftCol: CSSProperties = { display: "flex", flexDirection: "column", gap: 14, minWidth: 0 };
const rightCol: CSSProperties = { display: "flex", flexDirection: "column", gap: 14, minWidth: 0 };
const panel: CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, minWidth: 0 };
const panelHead: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 };
const sectionTitle: CSSProperties = { margin: 0, fontSize: 17, fontWeight: 950 };
const infoGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 };
const infoItem: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, border: "1px solid #edf0f3", borderRadius: 8, padding: 9 };
const noteBox: CSSProperties = { margin: "10px 0 0", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, color: "#374151", lineHeight: 1.5 };
const editAction: CSSProperties = { marginTop: 12 };
const input: CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 7, padding: "9px 10px", minWidth: 0, background: "#fff" };
const memoForm: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const memoList: CSSProperties = { marginTop: 12, display: "flex", flexDirection: "column", gap: 8 };
const memoItem: CSSProperties = { border: "1px solid #edf0f3", borderRadius: 8, padding: 10 };
const memoMeta: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, color: "#6b7280", fontSize: 12 };
const textButton: CSSProperties = { border: 0, background: "transparent", color: "#be123c", fontWeight: 900, padding: 0, cursor: "pointer" };
const summaryGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, minmax(110px, 1fr))", gap: 10 };
const summaryCard: CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 11, display: "flex", flexDirection: "column", gap: 5 };
const chartGrid: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" };
const lineChart: CSSProperties = { width: "100%", height: 130, background: "#f8fafc", border: "1px solid #edf0f3", borderRadius: 8 };
const chartLegend: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, color: "#6b7280", fontSize: 11, fontWeight: 800 };
const barList: CSSProperties = { display: "flex", flexDirection: "column", gap: 7 };
const barRow: CSSProperties = { display: "grid", gridTemplateColumns: "72px 1fr 48px", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 850 };
const barTrack: CSSProperties = { height: 10, background: "#edf0f3", borderRadius: 999, overflow: "hidden" };
const barFill: CSSProperties = { height: "100%", background: "#0b50d0", borderRadius: 999 };
const statusChart: CSSProperties = { display: "grid", gap: 10 };
const statusRows: CSSProperties = { display: "grid", gap: 8 };
const statusRow: CSSProperties = { display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) 126px", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 850 };
const statusDate: CSSProperties = { color: "#374151", fontVariantNumeric: "tabular-nums" };
const statusStackTrack: CSSProperties = { height: 18, display: "flex", overflow: "hidden", borderRadius: 6, background: "#edf0f3", border: "1px solid #e5e7eb" };
const statusSegment: CSSProperties = { height: "100%", minWidth: 0 };
const statusRateGroup: CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 7, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const statusPositiveRate: CSSProperties = { color: "#15803d" };
const statusNegativeRate: CSSProperties = { color: "#dc2626" };
const statusLegend: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, color: "#6b7280", fontSize: 11, fontWeight: 850 };
const statusLegendItem: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4 };
const statusLegendDot: CSSProperties = { width: 9, height: 9, borderRadius: 3, display: "inline-block" };
const tableWrap: CSSProperties = { overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 };
const table: CSSProperties = { width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 13 };
const th: CSSProperties = { background: "#f3f4f6", color: "#374151", borderBottom: "1px solid #d1d5db", padding: "9px 8px", textAlign: "left", whiteSpace: "nowrap" };
const td: CSSProperties = { borderBottom: "1px solid #edf0f3", padding: "8px", whiteSpace: "nowrap", verticalAlign: "top" };
const nameLink: CSSProperties = { color: "#083891", fontWeight: 950, textDecoration: "none" };
const smallLink: CSSProperties = { border: "1px solid #d1d5db", borderRadius: 7, padding: "5px 8px", color: "#111827", textDecoration: "none", fontWeight: 900 };
const taskList: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const taskItem: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, border: "1px solid #edf0f3", borderRadius: 8, padding: 10, color: "#111827", textDecoration: "none" };
const statusBadge: CSSProperties = { display: "inline-flex", border: "1px solid", borderRadius: 999, padding: "5px 9px", fontWeight: 950, background: "#fff" };
const muted: CSSProperties = { color: "#6b7280", fontSize: 12, fontWeight: 800 };
const empty: CSSProperties = { padding: 22, textAlign: "center", color: "#6b7280", fontWeight: 800 };
