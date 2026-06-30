"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

type Props = {
  href: string;
  style: CSSProperties;
  children: ReactNode;
};

export default function DropdownOptionLink({ href, style, children }: Props) {
  function closeDropdown(event: MouseEvent<HTMLAnchorElement>) {
    const details = event.currentTarget.closest("details");
    if (details) details.open = false;
  }

  return (
    <Link href={href} style={style} onClick={closeDropdown}>
      {children}
    </Link>
  );
}
