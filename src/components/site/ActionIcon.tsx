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
} as const;

export function ActionIcon({ name }: { name: keyof typeof PATHS }) {
  return <svg className="action-icon fit-action-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name]} /></svg>;
}
