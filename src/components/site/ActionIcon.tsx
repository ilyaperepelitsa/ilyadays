const PATHS = {
  edit: "m16 3 5 5M4 20l4-1L21 6a2.1 2.1 0 0 0-3-3L5 16l-1 4Z",
  swap: "M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4",
  up: "M12 20V4m-6 6 6-6 6 6",
  down: "M12 4v16m-6-6 6 6 6-6",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  filter: "M4 7h16M4 17h16M8 4v6m8 4v6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  food: "M4 3v5a3 3 0 0 0 6 0V3M7 3v18M18 3c-3 3-3 7 0 9h2M20 3v18",
  travel: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM16 8l-3 5-5 3 3-5 5-3Z",
  fitness: "M6 6v12M3 9v6M18 6v12M21 9v6M6 12h12",
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  progress: "M4 3v17h17M8 15l4-5 4 2 5-7",
  program: "M8 4H5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3M8 2h8v4H8V2ZM8 11h8M8 16h5",
  gym: "M3 21V7l9-4 9 4v14H3ZM9 21v-6h6v6M7 9h1m3 0h2m3 0h1M7 12h1m8 0h1",
  science: "M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1m0-15c3-2 7-2 10-1v15c-3-1-7-1-10 1V5Z",
  tools: "M4 7h16M4 17h16M8 4v6m8 4v6",
  download: "M12 3v12m-4-4 4 4 4-4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4",
} as const;

export type ActionIconName = keyof typeof PATHS;

export function ActionIcon({ name }: { name: ActionIconName }) {
  return <svg className="action-icon fit-action-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name]} /></svg>;
}
