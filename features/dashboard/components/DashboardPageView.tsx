import type { CSSProperties } from "react";
import { ButtonLink } from "@/components/ui";
import DashboardClient from "@/features/dashboard/components/DashboardClient";
import { buildDashboardViewData } from "@/features/dashboard/lib/dashboardMetrics";
import { getDashboardData } from "@/features/dashboard/lib/dashboardQueries";
import { requireUser } from "@/lib/auth";
import { todayKoreaDate } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function DashboardPageView() {
  const user = await requireUser();
  const today = todayKoreaDate();
  const raw = await getDashboardData({ user, today });
  const data = buildDashboardViewData({ raw, user, today });
  const urgentCount = data.inboxItems.filter((item) => item.severity === "critical").length;
  const todayCount = data.inboxItems.filter((item) => item.dateScope === "today" || item.dueKey === data.today || item.dateKey === data.today).length;

  return (
    <main style={pageShell}>
      <section style={pageContainer}>
        <header style={header}>
          <div style={headerText}>
            <h1 style={title}>{user.academy.name} 운영 현황</h1>
            <span style={description}>오늘 처리해야 할 수업, 학생, 업무, 문자, OMR 신호를 한 화면에서 확인합니다.</span>
          </div>
          <div style={headerActions}>
            <div style={flowSummary}>
              <strong>오늘 처리 흐름</strong>
              <span>긴급 {urgentCount}건 · 오늘 기준 {todayCount}건</span>
            </div>
            <a href="#dashboard-inbox" style={urgentAction}>긴급 항목 {urgentCount}건 처리</a>
            <ButtonLink href="/tasks/new" variant="tertiary" size="sm">업무 생성</ButtonLink>
          </div>
        </header>
        <DashboardClient data={data} />
      </section>
    </main>
  );
}

const pageShell: CSSProperties = {
  minHeight: "100%",
  background: "var(--asc-bg)",
  padding: 12,
  color: "var(--asc-text)",
};

const pageContainer: CSSProperties = {
  display: "grid",
  gap: 8,
};

const header: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  background: "var(--asc-surface)",
  border: "1px solid var(--asc-border)",
  borderRadius: 8,
  padding: "7px 10px",
};

const headerText: CSSProperties = { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", minWidth: 0 };
const title: CSSProperties = { margin: 0, fontSize: 18, lineHeight: 1.1, fontWeight: 950 };
const description: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 750 };
const headerActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 7,
  flexWrap: "wrap",
};
const flowSummary: CSSProperties = { display: "grid", gap: 2, color: "var(--asc-text-subtle)", fontSize: 12, fontWeight: 800, textAlign: "right" };
const urgentAction: CSSProperties = {
  minHeight: 30,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--asc-primary)",
  borderRadius: 8,
  background: "var(--asc-primary)",
  color: "#fff",
  padding: "0 12px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 950,
};
