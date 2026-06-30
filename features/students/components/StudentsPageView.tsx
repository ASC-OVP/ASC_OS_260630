import Link from "next/link";
import type { CSSProperties } from "react";
import StudentClassGroupSelect from "@/features/students/components/StudentClassGroupSelect";
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

  return (
    <main style={page}>
      <section style={container}>
        <header style={header}>
          <div style={headingRow}>
            <p style={eyebrow}>학생 현황판</p>
            <h1 style={title}>스프레드시트 학생 관리</h1>
            <span style={desc}>반별 학생 정보와 날짜별 차시 기록</span>
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
            <Link
              href={effectiveClassGroupId ? `/students/new?classGroupId=${encodeURIComponent(effectiveClassGroupId)}` : "/students/new"}
              style={addButton}
            >
              + 학생 추가
            </Link>
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
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  background: "var(--asc-surface)",
  border: "1px solid var(--asc-border)",
  borderRadius: 8,
  padding: "6px 10px",
};
const headingRow: CSSProperties = { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minWidth: 0 };
const eyebrow: CSSProperties = { margin: 0, color: "var(--asc-primary)", fontSize: 11, fontWeight: 900 };
const title: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 950, lineHeight: 1.1 };
const desc: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 700 };
const addButton: CSSProperties = {
  height: 30,
  display: "inline-flex",
  alignItems: "center",
  background: "var(--asc-primary)",
  color: "#fff",
  border: "1px solid var(--asc-primary)",
  borderRadius: 7,
  padding: "0 11px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: "nowrap",
};
const headerActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};
