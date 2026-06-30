import type { CSSProperties } from "react";
import StudentClassGroupSelect from "@/features/students/components/StudentClassGroupSelect";
import StudentCreateModal from "@/features/students/components/StudentCreateModal";
import StudentExcelUploadModal from "@/features/students/components/StudentExcelUploadModal";
import StudentLessonSpreadsheet from "@/features/students/components/StudentLessonSpreadsheet";
import { loadStudentsPageData } from "@/features/students/lib/loadStudentsPageData";

type Props = {
  searchParams?: Promise<{
    date?: string;
    classGroupId?: string;
    testId?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function StudentsPage({ searchParams }: Props) {
  const {
    canUploadStudents,
    classGroupOptions,
    customColumns,
    effectiveClassGroupId,
    rows,
    selectedTestExamId,
    testOptions,
    uploadStudents,
  } = await loadStudentsPageData(await searchParams);
  const selectedClassGroup = classGroupOptions.find((classGroup) => classGroup.id === effectiveClassGroupId);
  const headerStats = [
    { label: "학생", value: `${rows.length}명` },
    { label: "반", value: effectiveClassGroupId ? selectedClassGroup?.name ?? "-" : "전체" },
    { label: "등록 반", value: `${classGroupOptions.length}개` },
    { label: "시험", value: `${testOptions.length}개` },
  ];

  return (
    <main style={page}>
      <section style={container}>
        <header style={header}>
          <div style={headerText}>
            <p style={eyebrow}>학생 현황판</p>
            <div style={titleLine}>
              <h1 style={title}>스프레드시트 학생 관리</h1>
              <HeaderStats items={headerStats} />
            </div>
            <p style={desc}>반별 학생 정보와 날짜별 차시 기록을 확인합니다.</p>
          </div>
          <div style={headerActions}>
            <StudentClassGroupSelect selectedId={effectiveClassGroupId} classGroups={classGroupOptions} />
            {canUploadStudents && (
              <StudentExcelUploadModal
                classGroups={classGroupOptions}
                existingStudents={uploadStudents}
                defaultClassGroupId={effectiveClassGroupId}
              />
            )}
            <StudentCreateModal classGroups={classGroupOptions} defaultClassGroupId={effectiveClassGroupId} />
          </div>
        </header>

        <StudentLessonSpreadsheet
          rows={rows}
          customColumns={customColumns}
          selectedClassGroupId={effectiveClassGroupId}
          classGroups={classGroupOptions}
          classTests={testOptions}
          selectedTestExamId={selectedTestExamId}
        />
      </section>
    </main>
  );
}

function HeaderStats({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <span style={headerStatsStyle} aria-label="학생 현황 요약 통계">
      {items.map((item) => (
        <span key={item.label} style={headerStat}>
          <span style={headerStatLabel}>{item.label}</span>
          <b style={headerStatValue}>{item.value}</b>
        </span>
      ))}
    </span>
  );
}

const page: CSSProperties = { height: "100vh", minHeight: 0, overflow: "hidden", background: "var(--asc-bg-subtle)", color: "var(--asc-text)" };
const container: CSSProperties = {
  width: "100%",
  height: "100%",
  maxWidth: "none",
  margin: 0,
  padding: 6,
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  gap: 6,
  minHeight: 0,
};
const header: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  padding: "10px 2px 8px",
};
const headerText: CSSProperties = { minWidth: 0, display: "grid", gap: 4 };
const titleLine: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap", minWidth: 0 };
const eyebrow: CSSProperties = { margin: 0, color: "var(--asc-primary)", fontSize: 12, fontWeight: 900 };
const title: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 950, lineHeight: 1.12, letterSpacing: 0 };
const desc: CSSProperties = { margin: 0, color: "var(--asc-text-muted)", fontSize: 13, fontWeight: 700 };
const headerStatsStyle: CSSProperties = { display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 0, paddingLeft: 12, borderLeft: "1px solid var(--asc-border)" };
const headerStat: CSSProperties = { display: "inline-flex", alignItems: "baseline", gap: 4, padding: "0 10px", borderRight: "1px solid var(--asc-border)", lineHeight: 1.1 };
const headerStatLabel: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 850, whiteSpace: "nowrap" };
const headerStatValue: CSSProperties = { color: "var(--asc-text)", fontSize: 14, fontWeight: 950, whiteSpace: "nowrap" };
const headerActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};
