"use client";

import { useState, type CSSProperties } from "react";

type Props = {
  name?: string;
  defaultValue?: string | string[];
};

function initialItems(defaultValue: Props["defaultValue"]) {
  if (Array.isArray(defaultValue)) return defaultValue.map((item) => item.trim()).filter(Boolean);
  return String(defaultValue ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ChecklistBuilder({ name = "checklist", defaultValue }: Props) {
  const [items, setItems] = useState(() => initialItems(defaultValue));
  const [draft, setDraft] = useState("");

  function addItem() {
    const nextItems = draft
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (nextItems.length === 0) return;
    setItems((current) => [...current, ...nextItems]);
    setDraft("");
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section style={wrap} className="asc-field asc-field--full">
      <label style={title}>체크리스트</label>
      <input type="hidden" name={name} value={items.join("\n")} />
      {items.length > 0 && (
        <div style={itemsWrap}>
          {items.map((item, index) => (
            <span key={`${item}-${index}`} style={itemPill}>
              <span style={emptyCheck} />
              <span style={itemText}>{item}</span>
              <button type="button" style={removeButton} aria-label={`${item} 삭제`} onClick={() => removeItem(index)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        value={draft}
        rows={2}
        style={textarea}
        placeholder="항목을 입력한 뒤 Enter를 누르세요."
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          addItem();
        }}
      />
      <button type="button" style={addButton} onClick={addItem}>
        항목 추가
      </button>
    </section>
  );
}

const wrap: CSSProperties = {
  display: "grid",
  gap: 8,
};

const title: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "var(--asc-text)",
};

const itemsWrap: CSSProperties = {
  display: "grid",
  gap: 6,
};

const itemPill: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 8,
  border: "1px solid var(--asc-border)",
  borderRadius: "var(--asc-radius-md)",
  background: "var(--asc-bg-subtle)",
  padding: "7px 8px",
};

const emptyCheck: CSSProperties = {
  width: 15,
  height: 15,
  border: "1px solid var(--asc-border-strong)",
  borderRadius: 4,
  background: "var(--asc-surface)",
};

const itemText: CSSProperties = {
  minWidth: 0,
  color: "var(--asc-text)",
  fontSize: 13,
  fontWeight: 850,
  overflowWrap: "anywhere",
};

const removeButton: CSSProperties = {
  width: 24,
  height: 24,
  border: "1px solid transparent",
  borderRadius: 6,
  background: "transparent",
  color: "var(--asc-text-muted)",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
};

const textarea: CSSProperties = {
  width: "100%",
  border: "1px solid var(--asc-border)",
  borderRadius: "var(--asc-radius-lg)",
  padding: 8,
  resize: "vertical",
  background: "var(--asc-bg)",
  color: "var(--asc-text)",
};

const addButton: CSSProperties = {
  justifySelf: "start",
  height: 30,
  border: "1px solid var(--asc-border-strong)",
  borderRadius: "var(--asc-radius-md)",
  background: "var(--asc-surface)",
  color: "var(--asc-text)",
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 950,
  cursor: "pointer",
};
