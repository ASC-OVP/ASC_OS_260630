"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";

type Assignee = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  assignees: Assignee[];
  selectedIds: string[];
};

export default function AssigneeFilterDropdown({ assignees, selectedIds }: Props) {
  const dropdownRef = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set(selectedIds));
  const filteredAssignees = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return assignees;
    return assignees.filter((assignee) => `${assignee.name} ${roleLabel(assignee.role)}`.toLowerCase().includes(keyword));
  }, [assignees, query]);

  const selectedLabel = selected.size > 0 ? `${selected.size}명 선택` : "전체 담당자";

  function toggleAssignee(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyFilter() {
    dropdownRef.current?.removeAttribute("open");
    const params = new URLSearchParams(window.location.search);
    params.delete("tab");
    params.delete("view");
    if (selected.size > 0) params.set("assignee", [...selected].join(","));
    else params.delete("assignee");
    const suffix = params.toString();
    window.location.href = suffix ? `/tasks?${suffix}` : "/tasks";
  }

  function clearFilter() {
    dropdownRef.current?.removeAttribute("open");
    setSelected(new Set());
    const params = new URLSearchParams(window.location.search);
    params.delete("tab");
    params.delete("view");
    params.delete("assignee");
    const suffix = params.toString();
    window.location.href = suffix ? `/tasks?${suffix}` : "/tasks";
  }

  return (
    <div style={controlGroup}>
      <span style={controlLabel}>담당자별</span>
      <details ref={dropdownRef} style={dropdown}>
        <summary style={summary}>{selectedLabel}</summary>
        <div style={menu}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="담당자 이름 검색"
            style={searchInput}
          />
          <div style={assigneeList}>
            {filteredAssignees.map((assignee) => (
              <label key={assignee.id} style={assigneeItem}>
                <input type="checkbox" checked={selected.has(assignee.id)} onChange={() => toggleAssignee(assignee.id)} />
                <span>{assignee.name}</span>
                <small>{roleLabel(assignee.role)}</small>
              </label>
            ))}
            {filteredAssignees.length === 0 && <div style={empty}>검색 결과 없음</div>}
          </div>
          <div style={actions}>
            <button type="button" style={ghostButton} onClick={clearFilter}>초기화</button>
            <button type="button" style={primaryButton} onClick={applyFilter}>적용</button>
          </div>
        </div>
      </details>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "관리자";
  if (role === "MANAGER") return "실장";
  if (role === "TEACHER") return "강사";
  if (role === "ASSISTANT") return "조교";
  return role;
}

const controlGroup: CSSProperties = { display: "grid", gap: 3, minWidth: 156 };
const controlLabel: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 10, fontWeight: 950, lineHeight: 1, paddingLeft: 2 };
const dropdown: CSSProperties = { position: "relative", minWidth: 156, width: "100%" };
const summary: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  height: 34,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--asc-border-strong)",
  borderRadius: 7,
  background: "var(--asc-bg)",
  color: "var(--asc-text)",
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 950,
  cursor: "pointer",
  listStyle: "none",
  boxShadow: "inset 0 -1px 0 rgba(15, 23, 42, 0.03)",
};
const menu: CSSProperties = {
  position: "absolute",
  zIndex: 30,
  top: 38,
  left: 0,
  width: 290,
  display: "grid",
  gap: 8,
  padding: 10,
  border: "1px solid var(--asc-border)",
  borderRadius: 8,
  background: "var(--asc-surface)",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.16)",
};
const searchInput: CSSProperties = {
  width: "100%",
  height: 34,
  border: "1px solid var(--asc-border)",
  borderRadius: 7,
  background: "var(--asc-bg)",
  color: "var(--asc-text)",
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 850,
};
const assigneeList: CSSProperties = { display: "grid", gap: 3, maxHeight: 220, overflowY: "auto" };
const assigneeItem: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 7,
  borderRadius: 6,
  padding: "8px 9px",
  background: "var(--asc-bg-subtle)",
  fontSize: 12,
  fontWeight: 900,
};
const empty: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 900, padding: 8, textAlign: "center" };
const actions: CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 6 };
const primaryButton: CSSProperties = { height: 30, border: "1px solid var(--asc-primary)", borderRadius: 7, background: "var(--asc-primary)", color: "#fff", padding: "0 11px", fontSize: 12, fontWeight: 950 };
const ghostButton: CSSProperties = { ...primaryButton, border: "1px solid var(--asc-border-strong)", background: "var(--asc-bg)", color: "var(--asc-text)" };
