const paths: Record<string, string> = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  briefcase: "M9 7V4h6v3 M3 7h18v14H3z M3 12a20 20 0 0 0 18 0 M10 12h4v3h-4z",
  calendar: "M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18 M7 14h2 M13 14h2 M7 17h2",
  check: "m8 12 3 3 5-6 M21 12a9 9 0 1 1-5-8",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  document: "M14 2H4v20h16V8z M14 2v6h6 M8 12h8 M8 16h8",
  layout: "M3 3h18v18H3z M9 3v18 M9 9h12",
  message: "M21 3H3v14h4v4l5-4h9z M7 8h10 M7 12h6",
  history: "M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6z m-4 10 3 3 5-6",
  settings: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  chevron: "m14 6-6 6 6 6",
  close: "m6 6 12 12 M6 18 18 6",
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.document} /></svg>;
}
