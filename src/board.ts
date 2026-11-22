/**
 * Board model and state changes. Pure functions only (no React, no storage), so every rule is unit-tested.
 */

export type Priority = "low" | "medium" | "high";

export type Card = {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  tags: string[];
  /** ISO date (YYYY-MM-DD) or empty. */
  due: string;
  createdAt: number;
};

export type Column = { id: string; title: string; cardIds: string[]; limit?: number };

export type Board = {
  version: 1;
  columns: Column[];
  cards: Record<string, Card>;
};

export type CardDraft = Pick<Card, "title" | "notes" | "priority" | "tags" | "due">;

export type Action =
  | { type: "addCard"; columnId: string; draft: CardDraft; id: string; now: number }
  | { type: "updateCard"; id: string; draft: CardDraft }
  | { type: "deleteCard"; id: string }
  | { type: "moveCard"; id: string; toColumnId: string; toIndex: number }
  | { type: "renameColumn"; columnId: string; title: string }
  | { type: "clearColumn"; columnId: string }
  | { type: "replace"; board: Board };

export const PRIORITIES: Priority[] = ["high", "medium", "low"];

export function emptyBoard(): Board {
  return {
    version: 1,
    columns: [
      { id: "todo", title: "To do", cardIds: [] },
      { id: "doing", title: "In progress", cardIds: [], limit: 3 },
      { id: "done", title: "Done", cardIds: [] },
    ],
    cards: {},
  };
}

/** Trims text, keeps tags unique and lower-case, refuses an empty title. */
export function cleanDraft(draft: CardDraft): CardDraft | null {
  const title = draft.title.trim().slice(0, 140);
  if (!title) return null;
  const tags = [...new Set(draft.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 6);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(draft.due) ? draft.due : "";
  const priority = PRIORITIES.includes(draft.priority) ? draft.priority : "medium";
  return { title, notes: draft.notes.trim().slice(0, 2000), priority, tags, due };
}

function findColumnOf(board: Board, cardId: string): Column | undefined {
  return board.columns.find((c) => c.cardIds.includes(cardId));
}

export function reducer(board: Board, action: Action): Board {
  switch (action.type) {
    case "addCard": {
      const draft = cleanDraft(action.draft);
      const column = board.columns.find((c) => c.id === action.columnId);
      if (!draft || !column || board.cards[action.id]) return board;
      return {
        ...board,
        cards: { ...board.cards, [action.id]: { id: action.id, createdAt: action.now, ...draft } },
        columns: board.columns.map((c) => (c.id === column.id ? { ...c, cardIds: [action.id, ...c.cardIds] } : c)),
      };
    }

    case "updateCard": {
      const card = board.cards[action.id];
      const draft = cleanDraft(action.draft);
      if (!card || !draft) return board;
      return { ...board, cards: { ...board.cards, [card.id]: { ...card, ...draft } } };
    }

    case "deleteCard": {
      if (!board.cards[action.id]) return board;
      const { [action.id]: _removed, ...cards } = board.cards;
      return {
        ...board,
        cards,
        columns: board.columns.map((c) => ({ ...c, cardIds: c.cardIds.filter((id) => id !== action.id) })),
      };
    }

    case "moveCard": {
      const from = findColumnOf(board, action.id);
      const to = board.columns.find((c) => c.id === action.toColumnId);
      if (!from || !to) return board;
      const fromIndex = from.cardIds.indexOf(action.id);

      // Moving down inside the same column: the card's own slot disappears first.
      let index = action.toIndex;
      if (from.id === to.id && fromIndex < index) index -= 1;
      const targetIds = to.cardIds.filter((id) => id !== action.id);
      index = Math.max(0, Math.min(index, targetIds.length));
      if (from.id === to.id && index === fromIndex) return board;
      targetIds.splice(index, 0, action.id);

      return {
        ...board,
        columns: board.columns.map((c) => {
          if (c.id === to.id) return { ...c, cardIds: targetIds };
          if (c.id === from.id) return { ...c, cardIds: c.cardIds.filter((id) => id !== action.id) };
          return c;
        }),
      };
    }

    case "renameColumn": {
      const title = action.title.trim().slice(0, 40);
      if (!title) return board;
      return { ...board, columns: board.columns.map((c) => (c.id === action.columnId ? { ...c, title } : c)) };
    }

    case "clearColumn": {
      const column = board.columns.find((c) => c.id === action.columnId);
      if (!column) return board;
      const cards = { ...board.cards };
      for (const id of column.cardIds) delete cards[id];
      return { ...board, cards, columns: board.columns.map((c) => (c.id === column.id ? { ...c, cardIds: [] } : c)) };
    }

    case "replace":
      return action.board;
  }
}

/** Checks a board read from storage or an imported file. Returns null when it is not a valid board. */
export function parseBoard(value: unknown): Board | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Board>;
  if (raw.version !== 1 || !Array.isArray(raw.columns) || !raw.cards || typeof raw.cards !== "object") return null;

  const cards: Record<string, Card> = {};
  for (const [id, card] of Object.entries(raw.cards as Record<string, Partial<Card>>)) {
    if (!card || typeof card.title !== "string") return null;
    const draft = cleanDraft({
      title: card.title,
      notes: typeof card.notes === "string" ? card.notes : "",
      priority: (card.priority as Priority) ?? "medium",
      tags: Array.isArray(card.tags) ? card.tags.filter((t): t is string => typeof t === "string") : [],
      due: typeof card.due === "string" ? card.due : "",
    });
    if (!draft) return null;
    cards[id] = { id, createdAt: typeof card.createdAt === "number" ? card.createdAt : 0, ...draft };
  }

  const seen = new Set<string>();
  const columns: Column[] = [];
  for (const column of raw.columns) {
    if (!column || typeof column.id !== "string" || typeof column.title !== "string" || !Array.isArray(column.cardIds))
      return null;
    const cardIds: string[] = [];
    for (const id of column.cardIds) {
      // A card lives in one place only: unknown ids and duplicates (same or other column) are dropped.
      if (typeof id === "string" && cards[id] && !seen.has(id)) {
        seen.add(id);
        cardIds.push(id);
      }
    }
    columns.push({
      id: column.id,
      title: column.title,
      cardIds,
      ...(typeof column.limit === "number" ? { limit: column.limit } : {}),
    });
  }
  // Cards that no column lists are dropped.
  for (const id of Object.keys(cards)) if (!seen.has(id)) delete cards[id];
  return columns.length ? { version: 1, columns, cards } : null;
}

/** Case- and accent-insensitive search in title, notes and tags. */
export function matches(card: Card, query: string): boolean {
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const q = normalize(query.trim());
  if (!q) return true;
  return q
    .split(/\s+/)
    .every((word) =>
      [card.title, card.notes, ...card.tags.map((t) => `#${t}`)].some((field) => normalize(field).includes(word)),
    );
}

/** "overdue" | "soon" (within 2 days) | null, compared with today's local date. */
export function dueState(due: string, today: Date = new Date()): "overdue" | "soon" | null {
  if (!due) return null;
  const [y, m, d] = due.split("-").map(Number);
  const dueDay = Date.UTC(y, m - 1, d);
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = (dueDay - todayDay) / 86_400_000;
  if (days < 0) return "overdue";
  if (days <= 2) return "soon";
  return null;
}
