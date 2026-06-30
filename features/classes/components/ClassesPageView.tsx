import Link from "next/link";
import type { CSSProperties } from "react";
import { ButtonLink } from "@/components/ui";
import ClassCreateModal from "@/features/classes/components/ClassCreateModal";
import ClassOpenRow from "@/features/classes/components/ClassOpenRow";
import { buildClassStats } from "@/lib/classGroupStats";
import {
  canManageClassGroups,
  classGroupWhereForUser,
  classStatusLabel,
  classStatusTone,
  effectiveClassStatus,
  formatClassSchedule,
} from "@/lib/classGroups";
import { todayKoreaDate } from "@/lib/date";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClassGroupStatus } from "@/lib/generated/prisma";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ view?: string }>;
};

type StudentInClass = {
  id: string;
  name: string;
  scoreRecords: Array<{ date: string; title: string; score: number | null; maxScore: number | null; createdAt: Date }>;
  attendanceRecords: Array<{ date: string; status: string }>;
  assignmentRecords: Array<{ date: string; status: string }>;
};
type ClassLessonLite = { id: string; position: number; title: string; lessonDate: string | null; startTime: string | null; endTime: string | null };
type ClassGroupView = {
  id: string;
  name: string;
  teacherId: string | null;
  subject: string | null;
  grade: string | null;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  schedule: string | null;
  status: ClassGroupStatus;
  iconText: string | null;
  iconColor: string | null;
  teacher: { id: string; name: string } | null;
  assistant: { id: string; name: string } | null;
  classAssistants: Array<{ assistantId: string; assistant: { id: string; name: string } }>;
  studentClasses: Array<{ student: StudentInClass }>;
  lessons: ClassLessonLite[];
};
type ClassRow = {
  classGroup: ClassGroupView;
  effectiveStatus: string;
  stats: ReturnType<typeof buildClassStats>;
  lessonSignal: { label: string; value: string };
};

export default async function ClassesPage({ searchParams }: Props) {
  const user = await requireUser();
  const sp = (await searchParams) ?? {};
  const canManage = canManageClassGroups(user.role);
  const since = daysAgo(120);
  const today = todayKoreaDate();

  const [staff, classGroups] = await Promise.all([
    prisma.user.findMany({
      where: { academyId: user.academyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    prisma.classGroup.findMany({
      where: classGroupWhereForUser(user),
      include: {
        teacher: { select: { id: true, name: true } },
        assistant: { select: { id: true, name: true } },
        classAssistants: {
          orderBy: { createdAt: "asc" },
          include: { assistant: { select: { id: true, name: true } } },
        },
        lessons: {
          orderBy: [{ position: "asc" }],
          select: { id: true, position: true, title: true, lessonDate: true, startTime: true, endTime: true },
        },
        studentClasses: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                scoreRecords: {
                  where: { date: { gte: since } },
                  orderBy: [{ date: "desc" }, { createdAt: "desc" }],
                  take: 10,
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
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
  ]);

  const teachers = staff.filter((member) => member.role === "ADMIN" || member.role === "MANAGER" || member.role === "TEACHER");
  const assistants = staff.filter((member) => member.role === "ASSISTANT");
  const rows: ClassRow[] = classGroups
    .map((classGroup) => {
      const students = classGroup.studentClasses.map((membership) => membership.student);
      return {
        classGroup,
        effectiveStatus: effectiveClassStatus(classGroup),
        stats: buildClassStats(students),
        lessonSignal: lessonSignal(classGroup.lessons, today),
      };
    })
    .sort((a, b) => classStatusRank(a.effectiveStatus) - classStatusRank(b.effectiveStatus) || a.classGroup.name.localeCompare(b.classGroup.name, "ko"));

  const operatingRows = rows.filter((row) => row.effectiveStatus !== "ENDED");
  const endedRows = rows.filter((row) => row.effectiveStatus === "ENDED");
  const activeView = sp.view === "ended" ? "ended" : "operating";
  const visibleRows = activeView === "ended" ? endedRows : operatingRows;
  const totalStudents = rows.reduce((sum, row) => sum + row.stats.studentCount, 0);
  const activeCount = operatingRows.length;
  const averageScore = average(rows.map((row) => row.stats.averageScore).filter((score): score is number => score !== null));
  const averageAttendance = average(rows.map((row) => row.stats.attendanceRate).filter((rate): rate is number => rate !== null));

  return (
    <main style={page}>
      <section style={container}>
        <div style={header}>
          <div style={headerLayout}>
            <div style={headerText}>
              <p style={eyebrow}>반 관리</p>
              <div style={titleRow}>
                <h1 style={pageTitle}>수업 그룹 운영 보드</h1>
                <div style={compactStats} aria-label="반 운영 요약 통계">
                  <SmallStat label="전체" value={`${rows.length}개`} />
                  <SmallStat label="운영중" value={`${activeCount}개`} />
                  <SmallStat label="학생" value={`${totalStudents}명`} />
                  <SmallStat label="최근 평균" value={averageScore === null ? "-" : `${averageScore}점`} />
                  <SmallStat label="출석률" value={averageAttendance === null ? "-" : `${averageAttendance}%`} />
                </div>
              </div>
              <p style={pageDescription}>반을 검색하고, 더블클릭해서 각 반의 상세 운영 화면으로 들어갑니다.</p>
            </div>
            <div className="asc-action-group" style={headerActions}>
              <ButtonLink href="/students" variant="tertiary" size="sm">학생 현황판</ButtonLink>
              {canManage && (
                <ClassCreateModal
                  teachers={teachers}
                  assistants={assistants}
                  currentUserId={user.id}
                  currentUserRole={user.role}
                />
              )}
            </div>
          </div>
        </div>

        <ClassTableSection
          activeView={activeView}
          operatingCount={operatingRows.length}
          endedCount={endedRows.length}
          rows={visibleRows}
          canManage={canManage}
          emptyTitle={activeView === "ended" ? "끝난 강의가 없습니다" : "운영중인 강의가 없습니다"}
          emptyBody={activeView === "ended" ? "종료된 강의가 생기면 여기에 표시됩니다." : "반 추가 버튼으로 새 강의를 등록해 주세요."}
        />
      </section>
    </main>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <span style={smallStat}>
      <span>{label}</span>
      <b>{value}</b>
    </span>
  );
}

function ClassTableSection({
  activeView,
  operatingCount,
  endedCount,
  rows,
  canManage,
  emptyTitle,
  emptyBody,
}: {
  activeView: "operating" | "ended";
  operatingCount: number;
  endedCount: number;
  rows: ClassRow[];
  canManage: boolean;
  emptyTitle: string;
  emptyBody: string;
}) {
  return (
    <section style={listPanel}>
      <div style={panelHead}>
        <nav style={courseTabs} aria-label="강의 상태 보기">
          <Link href="/classes" style={{ ...courseTab, ...(activeView === "operating" ? activeCourseTab : {}) }}>
            운영중인 강의 <span style={tabCount}>{operatingCount}개</span>
          </Link>
          <Link href="/classes?view=ended" style={{ ...courseTab, ...(activeView === "ended" ? activeCourseTab : {}) }}>
            끝난 강의 <span style={tabCount}>{endedCount}개</span>
          </Link>
        </nav>
      </div>
      {rows.length > 0 ? (
        <div style={tableWrap}>
          <table style={classTable}>
            <thead>
              <tr>
                <th style={th}>반</th>
                <th style={th}>상태</th>
                <th style={th}>담당 강사</th>
                <th style={th}>담당 조교</th>
                <th style={{ ...th, textAlign: "right" }}>학생</th>
                <th style={th}>요일/시간</th>
                <th style={th}>최근/다음 차시</th>
                <th style={{ ...th, textAlign: "right" }}>평균</th>
                <th style={{ ...th, textAlign: "right" }}>출석률</th>
                <th style={{ ...th, textAlign: "right" }}>과제율</th>
                <th style={{ ...th, textAlign: "center" }} aria-label="반 관리" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { classGroup, stats, effectiveStatus, lessonSignal } = row;
                return (
                  <ClassOpenRow
                    key={classGroup.id}
                    href={`/classes/${classGroup.id}`}
                    classGroupId={classGroup.id}
                    name={classGroup.name}
                    meta={`${classGroup.subject || "과목 미지정"} / ${classGroup.grade || "학년 미지정"}`}
                    iconText={classGroup.iconText}
                    iconColor={classGroup.iconColor}
                    statusLabel={classStatusLabel(effectiveStatus)}
                    statusTone={classStatusTone(effectiveStatus)}
                    teacherName={classGroup.teacher?.name ?? "-"}
                    assistantName={assistantNames(classGroup)}
                    studentCount={stats.studentCount}
                    schedule={formatClassSchedule(classGroup)}
                    latestLabel={lessonSignal.label}
                    latestValue={lessonSignal.value}
                    averageScore={stats.averageScore === null ? "-" : `${stats.averageScore}점`}
                    attendanceRate={stats.attendanceRate === null ? "-" : `${stats.attendanceRate}%`}
                    assignmentRate={stats.assignmentCompletionRate === null ? "-" : `${stats.assignmentCompletionRate}%`}
                    canManage={canManage}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={emptyTitle} body={emptyBody} />
      )}
    </section>
  );
}

function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div style={empty}>
      <b>{title}</b>
      {body && <span>{body}</span>}
    </div>
  );
}

function assistantNames(classGroup: { assistant?: { name: string } | null; classAssistants?: Array<{ assistant: { name: string } }> }) {
  const names = classGroup.classAssistants?.map((link) => link.assistant.name).filter(Boolean) ?? [];
  return names.length > 0 ? names.join(", ") : classGroup.assistant?.name ?? "-";
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function classStatusRank(status: string) {
  if (status === "ACTIVE") return 0;
  if (status === "UPCOMING") return 1;
  if (status === "PAUSED") return 2;
  if (status === "ENDED") return 3;
  return 4;
}

function lessonSignal(lessons: ClassLessonLite[], today: string) {
  const dated = lessons.filter((lesson) => lesson.lessonDate).sort((a, b) => String(a.lessonDate).localeCompare(String(b.lessonDate)));
  const next = dated.find((lesson) => String(lesson.lessonDate) >= today);
  if (next) return { label: "다음 수업", value: `${next.lessonDate} · ${next.title}` };
  const recent = [...dated].reverse()[0] ?? [...lessons].sort((a, b) => b.position - a.position)[0];
  if (recent) return { label: "최근 차시", value: `${recent.lessonDate ?? `${recent.position}차시`} · ${recent.title}` };
  return { label: "차시", value: "등록된 차시 없음" };
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const page: CSSProperties = { padding: 12, color: "var(--asc-text)", background: "var(--asc-bg-subtle)", minHeight: "100vh" };
const container: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const header: CSSProperties = { padding: "10px 2px 8px" };
const headerLayout: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 };
const headerText: CSSProperties = { minWidth: 0, flex: "1 1 auto" };
const eyebrow: CSSProperties = { margin: "0 0 4px", color: "var(--asc-primary)", fontSize: 12, fontWeight: 900 };
const titleRow: CSSProperties = { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" };
const pageTitle: CSSProperties = { margin: 0, color: "var(--asc-text)", fontSize: 28, lineHeight: 1.15, fontWeight: 950, letterSpacing: 0 };
const pageDescription: CSSProperties = { margin: "6px 0 0", color: "var(--asc-text-muted)", fontSize: 13, lineHeight: 1.35 };
const compactStats: CSSProperties = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0, paddingLeft: 12, borderLeft: "1px solid var(--asc-border)" };
const headerActions: CSSProperties = { justifyContent: "flex-end", alignSelf: "start", flex: "0 0 auto" };
const smallStat: CSSProperties = { display: "inline-flex", alignItems: "baseline", gap: 4, padding: "0 10px", borderRight: "1px solid var(--asc-border)", color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 850, lineHeight: 1.1, whiteSpace: "nowrap" };
const listPanel: CSSProperties = { background: "var(--asc-surface)", border: "1px solid var(--asc-border)", borderRadius: "var(--asc-radius-lg)", padding: 10 };
const panelHead: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 };
const courseTabs: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 18, borderBottom: "1px solid var(--asc-border)", minHeight: 38 };
const courseTab: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, minHeight: 38, borderBottom: "3px solid transparent", color: "var(--asc-text-muted)", textDecoration: "none", fontSize: 15, fontWeight: 900 };
const activeCourseTab: CSSProperties = { color: "var(--asc-text)", borderBottomColor: "var(--asc-text)" };
const tabCount: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 30, height: 22, border: "1px solid var(--asc-border)", borderRadius: 999, background: "var(--asc-bg)", color: "var(--asc-text)", padding: "0 7px", fontSize: 12, fontWeight: 950 };
const tableWrap: CSSProperties = { overflowX: "auto", border: "1px solid var(--asc-border)", borderRadius: "var(--asc-radius-md)", background: "var(--asc-bg)" };
const classTable: CSSProperties = { width: "100%", minWidth: 1200, borderCollapse: "collapse", tableLayout: "auto" };
const th: CSSProperties = { background: "var(--asc-bg-subtle)", borderBottom: "1px solid var(--asc-border-strong)", padding: "10px 12px", color: "var(--asc-text-muted)", textAlign: "left", whiteSpace: "nowrap", fontSize: 12, fontWeight: 950 };
const empty: CSSProperties = { border: "1px dashed var(--asc-border)", borderRadius: "var(--asc-radius-lg)", padding: 18, display: "grid", gap: 4, textAlign: "center", color: "var(--asc-text-muted)", fontWeight: 800, background: "var(--asc-bg-subtle)" };
