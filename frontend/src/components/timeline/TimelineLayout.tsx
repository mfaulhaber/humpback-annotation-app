import type { ReactNode } from "react";

interface TimelineLayoutProps {
  chrome: "index" | "viewer";
  children: ReactNode;
}

export function TimelineLayout({ chrome, children }: TimelineLayoutProps) {
  return (
    <div className={`timeline-shell timeline-shell--${chrome}`}>
      <div className="timeline-shell__backdrop" aria-hidden="true" />
      <div className="timeline-shell__glow timeline-shell__glow--top" aria-hidden="true" />
      <div
        className="timeline-shell__glow timeline-shell__glow--bottom"
        aria-hidden="true"
      />
      <div className="timeline-shell__content">{children}</div>
    </div>
  );
}
