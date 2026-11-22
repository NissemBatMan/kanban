import { describe, expect, it } from "vitest";
import { type Board, type CardDraft, dueState, emptyBoard, matches, parseBoard, reducer } from "../src/board";

const draft = (title: string, extra: Partial<CardDraft> = {}): CardDraft => ({
  title,
  notes: "",
  priority: "medium",
  tags: [],
  due: "",
  ...extra,
});

function boardWith(...titles: string[]): Board {
  return titles.reduce(
    (board, title, i) => reducer(board, { type: "addCard", columnId: "todo", draft: draft(title), id: `c${i}`, now: i }),
    emptyBoard(),
  );
}

const ids = (board: Board, column: string) => board.columns.find((c) => c.id === column)!.cardIds;

describe("cards", () => {
  it("adds new cards at the top of a column, cleaned", () => {
    const board = reducer(emptyBoard(), {
      type: "addCard",
      columnId: "todo",
      draft: draft("  Write tests  ", { tags: ["UI", "ui", " api "], due: "nope" }),
      id: "a",
      now: 1,
    });
    expect(board.cards.a).toMatchObject({ title: "Write tests", tags: ["ui", "api"], due: "" });
    expect(ids(board, "todo")).toEqual(["a"]);
  });

  it("ignores empty titles, unknown columns and duplicate ids", () => {
    const base = boardWith("one");
    expect(reducer(base, { type: "addCard", columnId: "todo", draft: draft("   "), id: "x", now: 0 })).toBe(base);
    expect(reducer(base, { type: "addCard", columnId: "nope", draft: draft("x"), id: "x", now: 0 })).toBe(base);
    expect(reducer(base, { type: "addCard", columnId: "todo", draft: draft("x"), id: "c0", now: 0 })).toBe(base);
  });

  it("updates and deletes", () => {
    let board = boardWith("one", "two");
    board = reducer(board, { type: "updateCard", id: "c0", draft: draft("One!", { priority: "high" }) });
    expect(board.cards.c0).toMatchObject({ title: "One!", priority: "high", createdAt: 0 });
    board = reducer(board, { type: "deleteCard", id: "c0" });
    expect(board.cards.c0).toBeUndefined();
    expect(ids(board, "todo")).toEqual(["c1"]);
  });
});

describe("moveCard", () => {
  // todo: [c2, c1, c0]
  const base = boardWith("a", "b", "c");

  it("moves to another column at a position", () => {
    let board = reducer(base, { type: "moveCard", id: "c1", toColumnId: "doing", toIndex: 0 });
    board = reducer(board, { type: "moveCard", id: "c2", toColumnId: "doing", toIndex: 1 });
    expect(ids(board, "todo")).toEqual(["c0"]);
    expect(ids(board, "doing")).toEqual(["c1", "c2"]);
  });

  it("reorders inside a column (index = slot before which to drop)", () => {
    expect(ids(reducer(base, { type: "moveCard", id: "c2", toColumnId: "todo", toIndex: 3 }), "todo")).toEqual([
      "c1",
      "c0",
      "c2",
    ]);
    expect(ids(reducer(base, { type: "moveCard", id: "c0", toColumnId: "todo", toIndex: 0 }), "todo")).toEqual([
      "c0",
      "c2",
      "c1",
    ]);
  });

  it("returns the same board when nothing moves", () => {
    expect(reducer(base, { type: "moveCard", id: "c1", toColumnId: "todo", toIndex: 1 })).toBe(base);
    expect(reducer(base, { type: "moveCard", id: "c1", toColumnId: "todo", toIndex: 2 })).toBe(base);
    expect(reducer(base, { type: "moveCard", id: "zz", toColumnId: "todo", toIndex: 0 })).toBe(base);
  });

  it("clamps out-of-range indexes", () => {
    const board = reducer(base, { type: "moveCard", id: "c2", toColumnId: "done", toIndex: 99 });
    expect(ids(board, "done")).toEqual(["c2"]);
  });
});

describe("columns", () => {
  it("renames (not to empty) and clears", () => {
    let board = boardWith("a", "b");
    board = reducer(board, { type: "renameColumn", columnId: "todo", title: "  Backlog " });
    expect(board.columns[0].title).toBe("Backlog");
    expect(reducer(board, { type: "renameColumn", columnId: "todo", title: " " })).toBe(board);
    board = reducer(board, { type: "clearColumn", columnId: "todo" });
    expect(ids(board, "todo")).toEqual([]);
    expect(board.cards).toEqual({});
  });
});

describe("parseBoard", () => {
  it("accepts a saved board", () => {
    const board = boardWith("a", "b");
    expect(parseBoard(JSON.parse(JSON.stringify(board)))).toEqual(board);
  });

  it("rejects garbage and repairs inconsistencies", () => {
    expect(parseBoard(null)).toBeNull();
    expect(parseBoard({ version: 2, columns: [], cards: {} })).toBeNull();
    expect(parseBoard({ version: 1, columns: [{ id: "x" }], cards: {} })).toBeNull();

    const repaired = parseBoard({
      version: 1,
      columns: [
        { id: "a", title: "A", cardIds: ["1", "ghost", "1"] },
        { id: "b", title: "B", cardIds: ["1"] },
      ],
      cards: { "1": { title: "One", priority: "urgent" }, orphan: { title: "Lost" } },
    });
    expect(repaired?.columns.map((c) => c.cardIds)).toEqual([["1"], []]);
    expect(Object.keys(repaired!.cards)).toEqual(["1"]);
    expect(repaired!.cards["1"].priority).toBe("medium");
  });
});

describe("search and due dates", () => {
  const card = {
    id: "1",
    title: "Préparer la démo",
    notes: "slides + vidéo",
    priority: "high" as const,
    tags: ["client"],
    due: "",
    createdAt: 0,
  };

  it("matches words anywhere, ignoring case and accents", () => {
    expect(matches(card, "")).toBe(true);
    expect(matches(card, "preparer DEMO")).toBe(true);
    expect(matches(card, "#client video")).toBe(true);
    expect(matches(card, "facture")).toBe(false);
  });

  it("flags overdue and soon", () => {
    const today = new Date(2026, 10, 23);
    expect(dueState("2026-11-22", today)).toBe("overdue");
    expect(dueState("2026-11-23", today)).toBe("soon");
    expect(dueState("2026-11-25", today)).toBe("soon");
    expect(dueState("2026-11-26", today)).toBeNull();
    expect(dueState("", today)).toBeNull();
  });
});
