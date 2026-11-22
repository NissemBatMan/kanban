import { type Board, type CardDraft, emptyBoard, reducer } from "./board";

/** Dates relative to today, so the demo always shows "soon" and "overdue" badges. */
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEMO: [column: string, draft: CardDraft][] = [
  ["todo", { title: "Write the onboarding e-mail", notes: "Welcome + 3 tips", priority: "low", tags: ["marketing"], due: inDays(6) }],
  ["todo", { title: "Dark mode for the settings page", notes: "", priority: "medium", tags: ["ui"], due: "" }],
  ["todo", { title: "Fix login redirect loop", notes: "Happens when the session expires on a protected page.", priority: "high", tags: ["bug", "auth"], due: inDays(1) }],
  ["doing", { title: "Search API pagination", notes: "Cursor-based, 20 items per page.", priority: "medium", tags: ["api"], due: inDays(3) }],
  ["doing", { title: "Product photos upload", notes: "Resize to WebP, max 2 MB.", priority: "high", tags: ["api", "ui"], due: inDays(-1) }],
  ["done", { title: "Set up CI", notes: "Type-check, tests and build on every push.", priority: "medium", tags: ["devops"], due: "" }],
  ["done", { title: "Design system colours", notes: "", priority: "low", tags: ["ui"], due: "" }],
];

export function demoBoard(): Board {
  const now = Date.now();
  return DEMO.reduceRight(
    (board, [columnId, draft], i) => reducer(board, { type: "addCard", columnId, draft, id: `demo-${i}`, now: now - i }),
    emptyBoard(),
  );
}
