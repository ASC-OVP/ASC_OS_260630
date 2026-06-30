"use client";

import { useFormStatus } from "react-dom";
import type { CSSProperties, MouseEvent } from "react";

type Props = {
  className: string;
};

export default function ClassRemoveButton({ className }: Props) {
  const { pending } = useFormStatus();

  function confirmRemove(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!window.confirm(`${className} 반을 목록에서 제거할까요? 학생 배정과 연결된 반 운영 기록도 함께 정리됩니다.`)) {
      event.preventDefault();
    }
  }

  return (
    <button
      type="submit"
      onClick={confirmRemove}
      disabled={pending}
      style={{ ...button, ...(pending ? disabledButton : {}) }}
      aria-label={`${className} 반 제거`}
      title="반 제거"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={icon}>
        <path d="M9 3h6l1 2h4v2H4V5h4l1-2Z" />
        <path d="M6 9h12l-1 11H7L6 9Zm4 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z" />
      </svg>
    </button>
  );
}

const button: CSSProperties = {
  width: 32,
  height: 32,
  display: "inline-grid",
  placeItems: "center",
  border: 0,
  borderRadius: "var(--asc-radius-md)",
  background: "transparent",
  color: "var(--asc-danger)",
  padding: 0,
  cursor: "pointer",
};

const icon: CSSProperties = {
  width: 18,
  height: 18,
  display: "block",
  fill: "currentColor",
};

const disabledButton: CSSProperties = {
  opacity: 0.45,
};
