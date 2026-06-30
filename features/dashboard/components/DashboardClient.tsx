"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Badge, Button, ButtonLink, EmptyState, Input, Select } from "@/components/ui";
import { DASHBOARD_SEVERITY_ORDER, DASHBOARD_SIGNAL_LABELS } from "@/features/dashboard/constants";
import type {
  DashboardFilterOption,
  DashboardFilterState,
  DashboardSignalSeverity,
  DashboardSignalType,
  DashboardSummaryCard,
  DashboardViewData,
  ManagementStudentItem,
  OperationsInboxItem,
  PaymentMaterialsWidgetData,
  RecentActivityItem,
  TodayClassOperation,
} from "@/features/dashboard/types";

const defaultFilters: DashboardFilterState = {
  query: "",
  dateScope: "all",
  classGroupId: "all",
  ownerId: "all",
  signalType: "all",
  severity: "all",
};

const inboxTabs: Array<{ value: "all" | "critical" | "warning" | "dueToday" | "mine"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "critical", label: "긴급" },
  { value: "warning", label: "주의" },
  { value: "dueToday", label: "오늘 마감" },
  { value: "mine", label: "내 담당" },
];

type DashboardBadgeTone = "gray" | "blue" | "green" | "yellow" | "red" | "navy";

export default function DashboardClient({ data }: { data: DashboardViewData }) {
  const [filters, setFilters] = useState<DashboardFilterState>(defaultFilters);
  const [tab, setTab] = useState<(typeof inboxTabs)[number]["value"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(data.inboxItems[0]?.id ?? null);

  const filteredItems = useMemo(() => filterInboxItems(data.inboxItems, filters, tab, data.today), [data.inboxItems, data.today, filters, tab]);
  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const activeFilterCount = countActiveFilters(filters);

  return (
    <section style={pageStack}>
      <DashboardFilterBar
        filters={filters}
        setFilters={setFilters}
        data={data}
        activeFilterCount={activeFilterCount}
      />

      <DashboardSummaryCards cards={data.summaryCards} />

      <section id="dashboard-inbox" style={mainGrid} aria-label="오늘의 운영 큐와 선택 항목 상세">
        <OperationsInboxPanel
          items={filteredItems}
          totalCount={data.inboxItems.length}
          tab={tab}
          setTab={setTab}
          filters={filters}
          setFilters={setFilters}
          data={data}
          selectedId={selectedItem?.id ?? null}
          onSelect={setSelectedId}
          activeFilterCount={activeFilterCount}
        />
        <DashboardDetailPanel item={selectedItem} />
      </section>

      <section style={secondaryGrid} aria-label="보조 운영 위젯">
        <TodayClassesWidget classes={data.todayClasses} />
        <ManagementNeededStudentsPanel students={data.managementStudents} />
        <PaymentMaterialsWidget paymentMaterials={data.paymentMaterials} />
        <RecentActivityPanel activities={data.recentActivities} />
      </section>
    </section>
  );
}

function DashboardFilterBar({
  filters,
  setFilters,
  data,
  activeFilterCount,
}: {
  filters: DashboardFilterState;
  setFilters: (filters: DashboardFilterState) => void;
  data: DashboardViewData;
  activeFilterCount: number;
}) {
  const classLabel = filters.classGroupId !== "all" ? filterOptionLabel(data.filterOptions.classGroups, filters.classGroupId) : null;
  const ownerLabel = filters.ownerId !== "all" ? filterOptionLabel(data.filterOptions.owners, filters.ownerId) : null;

  return (
    <section style={filterPanel} aria-label="대시보드 필터">
      <div style={filterFields}>
        <Input
          aria-label="검색"
          value={filters.query}
          onChange={(event) => setFilters({ ...filters, query: event.target.value })}
          placeholder="검색"
          style={filterControl}
        />
        <Select aria-label="기간" value={filters.dateScope} style={filterControl} onChange={(event) => setFilters({ ...filters, dateScope: event.target.value as DashboardFilterState["dateScope"] })}>
          <option value="all">기간 전체</option>
          <option value="today">오늘</option>
          <option value="week">최근/이번 주</option>
        </Select>
        <Select aria-label="반" value={filters.classGroupId} style={filterControl} onChange={(event) => setFilters({ ...filters, classGroupId: event.target.value })}>
          <option value="all">전체 반</option>
          {data.filterOptions.classGroups.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
        <Button variant="secondary" size="sm" style={filterResetButton} onClick={() => setFilters(defaultFilters)} disabled={activeFilterCount === 0}>
          초기화
        </Button>
      </div>
      {activeFilterCount > 0 && (
        <div style={activeFilters}>
          <Badge tone="blue">활성 필터 {activeFilterCount}개</Badge>
          {filters.query && <Badge>{`검색: ${filters.query}`}</Badge>}
          {filters.dateScope !== "all" && <Badge>{filters.dateScope === "today" ? "오늘" : "최근/이번 주"}</Badge>}
          {classLabel && <Badge>{classLabel}</Badge>}
          {ownerLabel && <Badge>{ownerLabel}</Badge>}
          {filters.signalType !== "all" && <Badge>{DASHBOARD_SIGNAL_LABELS[filters.signalType]}</Badge>}
          {filters.severity !== "all" && <Badge>{severityLabel(filters.severity)}</Badge>}
        </div>
      )}
    </section>
  );
}

function DashboardSummaryCards({ cards }: { cards: DashboardSummaryCard[] }) {
  return (
    <section style={summaryGrid} aria-label="운영 요약 카드">
      {cards.map((card) => {
        const meta = summaryCardMeta(card);
        const content = (
          <>
            <span style={summaryCardTop}>
              <span style={summaryLabel}>{card.label}</span>
              <Badge tone={meta.badgeTone}>{meta.statusLabel}</Badge>
            </span>
            <span style={summaryValueRow}>
              <span style={{ ...summaryIcon, ...summaryIconTone(card.severity, card.unavailable) }}>{meta.icon}</span>
              <strong style={card.unavailable ? summaryUnavailableValue : summaryValue}>{card.value}</strong>
            </span>
            <span style={summaryMetricList}>
              {splitSummaryNote(card.note).map((part) => (
                <small key={part} style={summaryNote}>{part}</small>
              ))}
            </span>
          </>
        );
        const style = { ...summaryCard, ...severityCardStyle(card.severity, card.unavailable) };
        return card.href ? (
          <Link key={card.id} href={card.href} style={style}>
            {content}
          </Link>
        ) : (
          <div key={card.id} style={style}>
            {content}
          </div>
        );
      })}
    </section>
  );
}

function OperationsInboxPanel({
  items,
  totalCount,
  tab,
  setTab,
  filters,
  setFilters,
  data,
  selectedId,
  onSelect,
  activeFilterCount,
}: {
  items: OperationsInboxItem[];
  totalCount: number;
  tab: (typeof inboxTabs)[number]["value"];
  setTab: (tab: (typeof inboxTabs)[number]["value"]) => void;
  filters: DashboardFilterState;
  setFilters: (filters: DashboardFilterState) => void;
  data: DashboardViewData;
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeFilterCount: number;
}) {
  return (
    <section style={panel} aria-label="운영 인박스">
      <PanelHeader
        title="오늘의 운영 큐"
        description={`${items.length}/${totalCount}개 표시 · 긴급도와 내 담당 항목을 우선 정렬합니다.`}
        action={<ButtonLink href="/tasks/new" variant="tertiary" size="sm">업무 생성</ButtonLink>}
      />
      <div style={queueToolbar}>
        <div style={tabList} role="tablist" aria-label="운영 큐 탭">
          {inboxTabs.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              style={tab === item.value ? activeTabButton : tabButton}
              onClick={() => setTab(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div style={queueFilters}>
          <Select aria-label="담당자 필터" value={filters.ownerId} style={queueSelect} onChange={(event) => setFilters({ ...filters, ownerId: event.target.value })}>
            <option value="all">담당자 전체</option>
            {data.filterOptions.owners.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Select aria-label="신호 유형 필터" value={filters.signalType} style={queueSelect} onChange={(event) => setFilters({ ...filters, signalType: event.target.value as DashboardSignalType | "all" })}>
            <option value="all">유형 전체</option>
            {data.filterOptions.signalTypes.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Select aria-label="중요도 필터" value={filters.severity} style={queueSelect} onChange={(event) => setFilters({ ...filters, severity: event.target.value as DashboardSignalSeverity | "all" })}>
            <option value="all">심각도순</option>
            {data.filterOptions.severities.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </div>
      </div>
      <div style={inboxList}>
        <div style={queueHead} aria-hidden="true">
          <span>우선순위</span>
          <span>유형</span>
          <span>업무명</span>
          <span>대상</span>
          <span>담당자</span>
          <span>마감/기준</span>
          <span>상태</span>
        </div>
        {items.length === 0 ? (
          <div style={inboxEmpty}>
            <EmptyState
              title={activeFilterCount > 0 ? "조건에 맞는 운영 신호가 없습니다." : "오늘 급한 운영 신호가 없습니다."}
              description={activeFilterCount > 0 ? "필터를 초기화하거나 다른 기준으로 다시 확인하세요." : "오늘 수업과 최근 활동을 확인하거나 필요한 업무를 새로 만들 수 있습니다."}
              actions={<ButtonLink href="/students" variant="secondary" size="sm">학생 현황판</ButtonLink>}
            />
          </div>
        ) : (
          items.map((item) => (
            <InboxListRow key={item.id} item={item} active={item.id === selectedId} onSelect={onSelect} />
          ))
        )}
      </div>
    </section>
  );
}

function InboxListRow({ item, active, onSelect }: { item: OperationsInboxItem; active: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      style={active ? activeQueueRow : queueRow}
      onClick={() => onSelect(item.id)}
      aria-pressed={active}
      aria-label={`${severityLabel(item.severity)} ${DASHBOARD_SIGNAL_LABELS[item.type]} 업무 선택: ${item.title}`}
    >
      <span style={queuePriorityCell}>
        <SeverityBadge severity={item.severity} />
      </span>
      <span style={queueTypeCell}>{DASHBOARD_SIGNAL_LABELS[item.type]}</span>
      <span style={queueTitleCell}>{item.title}</span>
      <span style={queueMutedCell}>{item.targetLabel}</span>
      <span style={queueMutedCell}>{item.ownerLabel}</span>
      <span style={item.timeLabel.includes("마감") ? queueDueCell : queueMutedCell}>{item.timeLabel}</span>
      <span style={queueStatusCell}>{item.statusLabel}</span>
    </button>
  );
}

function DashboardDetailPanel({ item }: { item: OperationsInboxItem | null }) {
  const decision = item ? detailDecision(item) : null;
  const riskItems = item ? detailRiskItems(item) : [];

  return (
    <aside style={detailPanel} aria-label="선택 항목 상세">
      {!item ? (
        <EmptyState
          title="운영 신호를 선택하세요."
          description="선택한 항목의 우선순위, 판단 기준, 바로 실행할 액션을 정리해 보여줍니다."
        />
      ) : (
        <>
          <section style={detailHero}>
            <div style={detailHeroTop}>
              <span style={badgeGroup}>
                <SeverityBadge severity={item.severity} />
                <TypeBadge type={item.type} />
              </span>
              <span style={detailHeroMeta}>
                <span>담당 {item.ownerLabel}</span>
                <span>기준일 {item.timeLabel}</span>
              </span>
            </div>
            <h2 style={detailTitle}>{item.title}</h2>
            <p style={detailTarget}>{item.targetLabel}</p>
            {decision && (
              <p style={decisionCopy}>
                <strong>{decision.title}</strong>
                <span>{decision.description}</span>
              </p>
            )}
          </section>

          <div style={detailSection}>
            <ul style={riskList}>
              {riskItems.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </div>

          <div style={detailSection}>
            <div style={detailSectionHeader}>
              <strong style={detailSectionTitle}>처리 액션</strong>
              <Link href={item.href} style={smallLink}>원본 보기</Link>
            </div>
            <RecommendedActions item={item} />
          </div>
        </>
      )}
    </aside>
  );
}

function RecommendedActions({ item }: { item: OperationsInboxItem }) {
  const primaryAction = item.actions.find((action) => action.tone === "primary") ?? item.actions[0];
  const secondaryActions = item.actions.filter((action) => action !== primaryAction).slice(0, 3);

  return (
    <div style={recommendedActionBox}>
      {primaryAction && (
        <Link href={primaryAction.href} style={recommendedPrimaryAction}>
          {primaryAction.label}
        </Link>
      )}
      <div style={recommendedSecondaryGrid}>
        {secondaryActions.map((action) => (
          <Link key={`${item.id}:detail:${action.label}`} href={action.href} style={recommendedSecondaryAction}>
            {action.label}
          </Link>
        ))}
        <Link href={item.href} style={recommendedResolveAction}>처리 화면</Link>
      </div>
    </div>
  );
}

function TodayClassesWidget({ classes }: { classes: TodayClassOperation[] }) {
  return (
    <Widget title="오늘 수업 운영" href="/classes">
      {classes.length === 0 ? (
        <CompactEmpty title="오늘 예정된 수업이 없습니다." desc="반 일정이 등록되면 출석/과제 체크 상태가 표시됩니다." />
      ) : (
        classes.map((classGroup) => (
          <div key={classGroup.id} style={compactItem}>
            <div style={compactMain}>
              <Link href={classGroup.href} style={itemTitleLink}>{classGroup.name}</Link>
              <span style={compactMeta}>{classGroup.scheduleLabel} · {classGroup.teacherLabel} · {classGroup.roomLabel}</span>
              <span style={compactMeta}>출석 {classGroup.attendanceChecked}/{classGroup.studentCount} · 과제 {classGroup.assignmentChecked}/{classGroup.studentCount}</span>
            </div>
            <SeverityBadge severity={classGroup.severity} label={classGroup.statusLabel} />
          </div>
        ))
      )}
    </Widget>
  );
}

function ManagementNeededStudentsPanel({ students }: { students: ManagementStudentItem[] }) {
  return (
    <Widget title="관리 필요 학생" href="/students?sort=name">
      {students.length === 0 ? (
        <CompactEmpty title="관리 필요 학생이 없습니다." desc="주의 상태, 중요 메모, 출결/과제 신호가 생기면 표시됩니다." />
      ) : (
        students.map((student) => (
          <div key={student.id} style={compactItem}>
            <div style={compactMain}>
              <Link href={student.href} style={itemTitleLink}>{student.name}</Link>
              <span style={compactMeta}>{student.className} · {student.contextLabel}</span>
              <span style={compactMeta}>{student.reason}</span>
            </div>
            <SeverityBadge severity={student.severity} label={student.statusLabel} />
          </div>
        ))
      )}
    </Widget>
  );
}

function PaymentMaterialsWidget({ paymentMaterials }: { paymentMaterials: PaymentMaterialsWidgetData }) {
  return (
    <Widget title="미납/교재" href="/operations">
      {paymentMaterials.status === "unavailable" ? (
        <div style={unavailableBox}>
          <Badge tone="yellow">데이터 연결 예정</Badge>
          <strong>결제·교재 데이터 연결 예정</strong>
          <p>수강료, 교재비, 교재 배부 상태는 결제/교재 모델 연결 후 표시됩니다.</p>
        </div>
      ) : (
        paymentMaterials.items.map((item) => (
          <WidgetLine key={item.id} title={item.studentName} meta={`${item.itemLabel} · ${item.statusLabel}`} href={item.href} severity="warning" status={item.dueText ?? "확인"} />
        ))
      )}
    </Widget>
  );
}

function RecentActivityPanel({ activities }: { activities: RecentActivityItem[] }) {
  return (
    <Widget title="최근 활동" href="/memos">
      {activities.length === 0 ? (
        <CompactEmpty title="최근 활동이 없습니다." desc="메모, 업무 댓글, 문자, OMR 기록이 표시됩니다." />
      ) : (
        activities.map((activity) => (
          <WidgetLine key={activity.id} title={activity.title} meta={`${activity.label} · ${activity.meta}`} href={activity.href} severity={activity.severity} status={activity.label} />
        ))
      )}
    </Widget>
  );
}

function Widget({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <section style={widgetPanel}>
      <div style={widgetHeader}>
        <h2 style={widgetTitle}>{title}</h2>
        <Link href={href} style={smallLink}>전체 보기</Link>
      </div>
      <div style={widgetBody}>{children}</div>
    </section>
  );
}

function WidgetLine({ title, meta, href, severity, status }: { title: string; meta: string; href: string; severity: DashboardSignalSeverity; status: string }) {
  return (
    <Link href={href} style={compactItem}>
      <div style={compactMain}>
        <strong style={itemTitle}>{title}</strong>
        <span style={compactMeta}>{meta}</span>
      </div>
      <SeverityBadge severity={severity} label={status} />
    </Link>
  );
}

function CompactEmpty({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={compactEmpty}>
      <strong>{title}</strong>
      <span>{desc}</span>
    </div>
  );
}

function PanelHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div style={panelHeader}>
      <div>
        <h2 style={panelTitle}>{title}</h2>
        <p style={panelDescription}>{description}</p>
      </div>
      {action}
    </div>
  );
}

function SeverityBadge({ severity, label }: { severity: DashboardSignalSeverity; label?: string }) {
  const tone = severity === "critical" ? "red" : severity === "warning" ? "yellow" : severity === "success" ? "green" : severity === "info" ? "blue" : "gray";
  return <Badge tone={tone}>{label ?? severityLabel(severity)}</Badge>;
}

function TypeBadge({ type }: { type: DashboardSignalType }) {
  return <Badge tone="blue">{DASHBOARD_SIGNAL_LABELS[type]}</Badge>;
}

function filterInboxItems(items: OperationsInboxItem[], filters: DashboardFilterState, tab: string, today: string) {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (query && !item.searchText.includes(query)) return false;
    if (filters.dateScope === "today" && item.dateScope !== "today" && item.dueKey !== today && item.dateKey !== today) return false;
    if (filters.dateScope === "week" && item.dateScope !== "today" && item.dateScope !== "week" && item.dateScope !== "recent") return false;
    if (filters.classGroupId !== "all" && item.classGroupId !== filters.classGroupId) return false;
    if (filters.ownerId !== "all" && item.ownerId !== filters.ownerId) return false;
    if (filters.signalType !== "all" && item.type !== filters.signalType) return false;
    if (filters.severity !== "all" && item.severity !== filters.severity) return false;
    if (tab === "critical" && item.severity !== "critical") return false;
    if (tab === "warning" && item.severity !== "warning") return false;
    if (tab === "dueToday" && item.dueKey !== today && item.dateScope !== "today") return false;
    if (tab === "mine" && !item.isMine) return false;
    return true;
  }).sort((a, b) => DASHBOARD_SEVERITY_ORDER[a.severity] - DASHBOARD_SEVERITY_ORDER[b.severity] || Number(b.isMine) - Number(a.isMine));
}

function countActiveFilters(filters: DashboardFilterState) {
  return Number(Boolean(filters.query.trim())) +
    Number(filters.dateScope !== "all") +
    Number(filters.classGroupId !== "all") +
    Number(filters.ownerId !== "all") +
    Number(filters.signalType !== "all") +
    Number(filters.severity !== "all");
}

function severityLabel(severity: DashboardSignalSeverity) {
  if (severity === "critical") return "긴급";
  if (severity === "warning") return "주의";
  if (severity === "info") return "확인";
  if (severity === "success") return "정상";
  return "일반";
}

function severityCardStyle(severity?: DashboardSignalSeverity, unavailable?: boolean): CSSProperties {
  if (unavailable) return { border: "1px solid #d1d5db", background: "#f9fafb" };
  if (severity === "critical") return { border: "1px solid #f5b5a7", background: "var(--asc-danger-soft)" };
  if (severity === "warning") return { border: "1px solid #ffd166", background: "var(--asc-warning-soft)" };
  if (severity === "success") return { border: "1px solid #bbf7d0", background: "var(--asc-success-soft)" };
  return {};
}

function summaryCardMeta(card: DashboardSummaryCard): { icon: string; statusLabel: string; badgeTone: DashboardBadgeTone } {
  const iconById: Record<string, string> = {
    todayClasses: "수업",
    urgent: "긴급",
    attentionStudents: "학생",
    messages: "문자",
    paymentMaterials: "납부",
    omr: "OMR",
  };
  if (card.unavailable) return { icon: iconById[card.id] ?? "운영", statusLabel: "예정", badgeTone: "gray" };
  if (card.severity === "critical") return { icon: iconById[card.id] ?? "긴급", statusLabel: "긴급", badgeTone: "red" };
  if (card.severity === "warning") return { icon: iconById[card.id] ?? "주의", statusLabel: "주의", badgeTone: "yellow" };
  if (card.severity === "success") return { icon: iconById[card.id] ?? "정상", statusLabel: "정상", badgeTone: "green" };
  return { icon: iconById[card.id] ?? "운영", statusLabel: "확인", badgeTone: "blue" };
}

function splitSummaryNote(note: string) {
  return note.split("·").map((part) => part.trim()).filter(Boolean).slice(0, 2);
}

function summaryIconTone(severity?: DashboardSignalSeverity, unavailable?: boolean): CSSProperties {
  if (unavailable) return { background: "#f3f4f6", color: "var(--asc-text-muted)" };
  if (severity === "critical") return { background: "var(--asc-danger-soft)", color: "var(--asc-danger)" };
  if (severity === "warning") return { background: "var(--asc-warning-soft)", color: "var(--asc-warning-text)" };
  if (severity === "success") return { background: "var(--asc-success-soft)", color: "var(--asc-success)" };
  return { background: "var(--asc-info-soft)", color: "var(--asc-info)" };
}

function filterOptionLabel(options: DashboardFilterOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function detailDecision(item: OperationsInboxItem) {
  const typeLabel = DASHBOARD_SIGNAL_LABELS[item.type];
  if (item.severity === "critical") {
    return {
      title: "즉시 처리 대상",
      description: `${typeLabel} 신호가 긴급 상태입니다. 담당자와 기준 시간을 먼저 확인하고 바로 액션으로 이동하세요.`,
    };
  }
  if (item.severity === "warning") {
    return {
      title: "오늘 확인 대상",
      description: `${typeLabel} 신호가 운영 흐름을 막을 수 있습니다. 맥락 확인 후 담당 액션을 실행하세요.`,
    };
  }
  if (item.severity === "success") {
    return {
      title: "정상 흐름",
      description: "오늘 기준으로 큰 이슈는 없습니다. 관련 기록만 빠르게 확인하면 됩니다.",
    };
  }
  return {
    title: "후속 확인",
    description: `${typeLabel} 관련 상태를 점검하고 필요하면 업무나 메모로 남기세요.`,
  };
}

function detailRiskItems(item: OperationsInboxItem) {
  const risks = [
    item.reason,
    `현재 상태: ${item.statusLabel}`,
    `담당: ${item.ownerLabel}`,
    item.contextLabel !== "-" ? `맥락: ${item.contextLabel}` : null,
  ];
  return risks.filter((risk): risk is string => Boolean(risk));
}

const pageStack: CSSProperties = { display: "grid", gap: 7, fontSize: 13 };
const filterPanel: CSSProperties = { background: "var(--asc-surface)", border: "1px solid var(--asc-border)", borderRadius: 8, padding: 7, display: "grid", gap: 5 };
const filterFields: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(180px, 1.4fr) minmax(96px, .55fr) minmax(130px, .8fr) 74px", gap: 6, alignItems: "center" };
const filterControl: CSSProperties = { minHeight: 28, padding: "4px 8px", fontSize: 12 };
const filterResetButton: CSSProperties = { minHeight: 28, padding: "0 8px", fontSize: 12 };
const activeFilters: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 5 };
const summaryGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(6, minmax(108px, 1fr))", gap: 6 };
const summaryCard: CSSProperties = { border: "1px solid var(--asc-border)", borderRadius: 8, padding: "6px 8px", background: "var(--asc-surface)", display: "flex", flexDirection: "column", gap: 3, minHeight: 64, color: "var(--asc-text)", textDecoration: "none" };
const summaryCardTop: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 };
const summaryIcon: CSSProperties = { minWidth: 25, height: 25, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 950 };
const summaryLabel: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 11, fontWeight: 950 };
const summaryValueRow: CSSProperties = { display: "flex", alignItems: "center", gap: 7, minWidth: 0 };
const summaryValue: CSSProperties = { fontSize: 18, lineHeight: 1.05 };
const summaryUnavailableValue: CSSProperties = { fontSize: 13, lineHeight: 1.15 };
const summaryMetricList: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 15, overflow: "hidden" };
const summaryNote: CSSProperties = { color: "var(--asc-text-subtle)", fontSize: 10, fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap" };
const mainGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(310px, 340px)", gap: 10, alignItems: "start" };
const panel: CSSProperties = { background: "var(--asc-surface)", border: "1px solid var(--asc-border)", borderRadius: 8, padding: 9, display: "grid", gap: 7 };
const panelHeader: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" };
const panelTitle: CSSProperties = { margin: 0, fontSize: 16, fontWeight: 950 };
const panelDescription: CSSProperties = { margin: "3px 0 0", color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 800 };
const queueToolbar: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" };
const tabList: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 5 };
const tabButton: CSSProperties = { border: "1px solid var(--asc-border)", borderRadius: 8, background: "var(--asc-surface)", padding: "6px 8px", color: "var(--asc-text-subtle)", fontSize: 12, fontWeight: 900, cursor: "pointer" };
const activeTabButton: CSSProperties = { ...tabButton, background: "var(--asc-primary-soft)", color: "var(--asc-primary-hover)", border: "1px solid #b1cefb" };
const queueFilters: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(96px, 1fr))", gap: 6, minWidth: 330 };
const queueSelect: CSSProperties = { minHeight: 30, padding: "5px 8px", fontSize: 12 };
const queueColumns = "86px 64px minmax(170px, 1.25fr) minmax(124px, .85fr) minmax(70px, .55fr) minmax(90px, .65fr) minmax(70px, .5fr)";
const inboxList: CSSProperties = { border: "1px solid var(--asc-border-subtle)", borderRadius: 8, overflow: "auto", maxHeight: 360, background: "var(--asc-surface)" };
const queueHead: CSSProperties = { display: "grid", gridTemplateColumns: queueColumns, alignItems: "center", minWidth: 760, position: "sticky", top: 0, zIndex: 1, background: "var(--asc-bg-subtle)", borderBottom: "1px solid var(--asc-border-subtle)", color: "var(--asc-text-muted)", fontSize: 11, fontWeight: 950, padding: "7px 10px" };
const queueRow: CSSProperties = { width: "100%", minWidth: 760, minHeight: 40, display: "grid", gridTemplateColumns: queueColumns, alignItems: "center", borderWidth: 0, borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "var(--asc-border-subtle)", background: "var(--asc-surface)", color: "var(--asc-text)", padding: "8px 10px", textAlign: "left", cursor: "pointer", font: "inherit" };
const activeQueueRow: CSSProperties = { ...queueRow, background: "var(--asc-primary-soft)", boxShadow: "inset 3px 0 0 var(--asc-primary)" };
const inboxEmpty: CSSProperties = { padding: 12 };
const queuePriorityCell: CSSProperties = { minWidth: 0, display: "flex", alignItems: "center" };
const queueTypeCell: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--asc-text-subtle)", fontSize: 12, fontWeight: 950 };
const queueTitleCell: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--asc-text)", fontSize: 13, fontWeight: 950 };
const queueMutedCell: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--asc-text-muted)", fontSize: 11.5, fontWeight: 800 };
const queueDueCell: CSSProperties = { ...queueMutedCell, color: "var(--asc-danger)" };
const queueStatusCell: CSSProperties = { ...queueMutedCell, color: "var(--asc-text)", fontWeight: 900 };
const badgeGroup: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" };
const detailPanel: CSSProperties = { background: "var(--asc-surface)", border: "1px solid var(--asc-border)", borderRadius: 8, padding: 9, position: "sticky", top: 10, display: "grid", gap: 6, alignContent: "start" };
const detailHero: CSSProperties = { display: "grid", gap: 5, border: "1px solid var(--asc-border-subtle)", borderRadius: 8, background: "var(--asc-bg-subtle)", padding: 8 };
const detailHeroTop: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 };
const detailHeroMeta: CSSProperties = { display: "grid", gap: 2, color: "var(--asc-text-muted)", fontSize: 11, fontWeight: 850, textAlign: "right", whiteSpace: "nowrap" };
const detailTitle: CSSProperties = { margin: 0, fontSize: 16, lineHeight: 1.25 };
const detailTarget: CSSProperties = { margin: 0, color: "var(--asc-text-subtle)", fontWeight: 900 };
const decisionCopy: CSSProperties = { margin: 0, display: "grid", gap: 2, color: "var(--asc-text-subtle)", lineHeight: 1.3 };
const detailSection: CSSProperties = { borderTop: "1px solid var(--asc-border-subtle)", paddingTop: 5, display: "grid", gap: 5 };
const detailSectionHeader: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const detailSectionTitle: CSSProperties = { color: "var(--asc-text)", fontSize: 12, fontWeight: 950 };
const riskList: CSSProperties = { margin: 0, padding: "6px 9px 6px 22px", border: "1px solid #f5b5a7", borderRadius: 8, background: "var(--asc-danger-soft)", color: "var(--asc-danger)", display: "grid", gap: 3, lineHeight: 1.3, fontWeight: 800 };
const recommendedActionBox: CSSProperties = { display: "grid", gap: 5 };
const recommendedPrimaryAction: CSSProperties = { border: "1px solid var(--asc-primary)", borderRadius: 8, background: "var(--asc-primary)", color: "#fff", minHeight: 31, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 10px", textDecoration: "none", fontSize: 12, fontWeight: 950 };
const recommendedSecondaryGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 };
const recommendedSecondaryAction: CSSProperties = { border: "1px solid var(--asc-border-strong)", borderRadius: 8, background: "var(--asc-surface)", color: "var(--asc-text)", minHeight: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px", textDecoration: "none", fontSize: 11, fontWeight: 900, textAlign: "center" };
const recommendedResolveAction: CSSProperties = { ...recommendedSecondaryAction, border: "1px solid var(--asc-success)", color: "var(--asc-success)", background: "var(--asc-success-soft)" };
const secondaryGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 };
const widgetPanel: CSSProperties = { background: "var(--asc-surface)", border: "1px solid var(--asc-border)", borderRadius: 8, padding: 10, display: "grid", gap: 8, alignContent: "start" };
const widgetHeader: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 7, alignItems: "center" };
const widgetTitle: CSSProperties = { margin: 0, fontSize: 14, fontWeight: 950 };
const smallLink: CSSProperties = { color: "var(--asc-primary)", textDecoration: "none", fontWeight: 900, whiteSpace: "nowrap", fontSize: 11 };
const widgetBody: CSSProperties = { display: "grid", gap: 7 };
const compactItem: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 7, border: "1px solid var(--asc-border-subtle)", borderRadius: 8, padding: 8, color: "var(--asc-text)", textDecoration: "none", background: "var(--asc-bg-subtle)" };
const compactMain: CSSProperties = { minWidth: 0, display: "grid", gap: 4 };
const itemTitle: CSSProperties = { color: "var(--asc-text)" };
const itemTitleLink: CSSProperties = { ...itemTitle, textDecoration: "none" };
const compactMeta: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 11, fontWeight: 800, lineHeight: 1.35 };
const compactEmpty: CSSProperties = { border: "1px dashed var(--asc-border)", borderRadius: 8, padding: 10, display: "grid", gap: 4, color: "var(--asc-text-muted)", background: "var(--asc-bg-subtle)" };
const unavailableBox: CSSProperties = { border: "1px dashed var(--asc-border)", borderRadius: 8, padding: 10, display: "grid", gap: 6, background: "var(--asc-bg-subtle)" };
