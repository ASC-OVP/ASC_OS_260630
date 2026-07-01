import type { CSSProperties, ReactElement } from "react";

export type ToolbarIconName =
  | "undo"
  | "redo"
  | "save"
  | "settings"
  | "columns"
  | "check"
  | "reset"
  | "fillDown"
  | "eraser"
  | "addLesson"
  | "allLessons"
  | "fullscreen"
  | "collapse"
  | "panel"
  | "border"
  | "search";

export function ToolbarIcon({ name }: { name: ToolbarIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const icons: Record<ToolbarIconName, ReactElement> = {
    undo: <><path {...common} d="M9 7 5 11l4 4" /><path {...common} d="M5 11h9a5 5 0 1 1 0 10h-2" /></>,
    redo: <><path {...common} d="m15 7 4 4-4 4" /><path {...common} d="M19 11h-9a5 5 0 1 0 0 10h2" /></>,
    save: <><path {...common} d="M5 3h12l2 2v16H5z" /><path {...common} d="M8 3v6h8" /><path {...common} d="M8 21v-7h8v7" /></>,
    settings: <><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-4l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h4l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" /></>,
    columns: <><rect {...common} x="4" y="5" width="16" height="14" rx="1.5" /><path {...common} d="M9 5v14M15 5v14" /></>,
    check: <path {...common} d="m5 12 4 4L19 6" />,
    reset: <path {...common} d="M5 8a7 7 0 1 1 1 9.3M5 8v5h5" />,
    fillDown: <><path {...common} d="M8 4h8v5H8zM12 9v9m-4-4 4 4 4-4" /></>,
    eraser: <><path {...common} d="m4 15 8-8 6 6-5 5H7z" /><path {...common} d="M10 18h10" /></>,
    addLesson: <><path {...common} d="M5 6h14M5 12h14M5 18h8" /><path {...common} d="M17 15v6M14 18h6" /></>,
    allLessons: <><rect {...common} x="4" y="5" width="16" height="14" rx="1.5" /><path {...common} d="M4 10h16M4 15h16M9 5v14" /></>,
    fullscreen: <><path {...common} d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" /></>,
    collapse: <><path {...common} d="M7 4v16M17 4v16M10 8l4 4-4 4" /></>,
    panel: <><rect {...common} x="4" y="5" width="16" height="14" rx="1.5" /><path {...common} d="M14 5v14" /></>,
    border: <><rect {...common} x="5" y="5" width="14" height="14" /><path {...common} d="M5 12h14M12 5v14" /></>,
    search: <><circle {...common} cx="10.5" cy="10.5" r="5.5" /><path {...common} d="m15 15 5 5" /></>,
  };

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={toolbarSvgIcon}>
      {icons[name]}
    </svg>
  );
}

export function ToolbarIconButton({
  icon,
  title,
  onClick,
  disabled = false,
  active = false,
}: {
  icon: ToolbarIconName;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={active ? "student-sheet-toolbar-button is-active" : "student-sheet-toolbar-button"}
      style={{ ...toolbarIconButton, ...(active ? activeToolbarButton : {}), ...(disabled ? disabledToolbarButton : {}) }}
      title={title}
      aria-label={title}
    >
      <ToolbarIcon name={icon} />
    </button>
  );
}

const toolbarSvgIcon: CSSProperties = {
  display: "block",
  flex: "0 0 auto",
  overflow: "visible",
};

const toolbarIconButton: CSSProperties = {
  width: 30,
  height: 30,
  border: 0,
  borderRadius: 7,
  background: "transparent",
  color: "#3c4043",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

const activeToolbarButton: CSSProperties = {
  background: "#dfe8fd",
  color: "#174ea6",
};

const disabledToolbarButton: CSSProperties = {
  opacity: 0.45,
};
