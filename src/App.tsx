import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { type Board, type Card, emptyBoard, matches, parseBoard, reducer } from "./board";
import { CardEditor, type EditorTarget } from "./components/CardEditor";
import { ColumnView } from "./components/ColumnView";
import { demoBoard } from "./demo";

const STORAGE_KEY = "kanban:board";
const THEME_KEY = "kanban:theme";

function loadBoard(): Board {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return parseBoard(JSON.parse(saved)) ?? demoBoard();
  } catch {
    // Private mode or corrupted data: start from the demo board.
  }
  return demoBoard();
}

type Theme = "light" | "dark";

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // ignore
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const [board, dispatch] = useReducer(reducer, undefined, loadBoard);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    } catch {
      // Storage full or blocked: the board still works for this visit.
    }
  }, [board]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // "/" focuses search, "n" adds a card to the first column.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (editing || target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "/") {
        e.preventDefault();
        searchInput.current?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        setEditing({ mode: "new", columnId: board.columns[0].id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, board.columns]);

  const visible = useMemo(() => {
    const result: Record<string, Card[]> = {};
    for (const column of board.columns) {
      result[column.id] = column.cardIds.map((id) => board.cards[id]).filter((card) => matches(card, query));
    }
    return result;
  }, [board, query]);

  const total = Object.keys(board.cards).length;
  const doneColumn = board.columns[board.columns.length - 1];
  const progress = total ? Math.round((doneColumn.cardIds.length / total) * 100) : 0;

  const exportBoard = () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: `kanban-${new Date().toISOString().slice(0, 10)}.json`,
    });
    link.click();
    URL.revokeObjectURL(url);
  };

  const importBoard = async (file: File) => {
    try {
      const parsed = parseBoard(JSON.parse(await file.text()));
      if (!parsed) throw new Error("invalid");
      dispatch({ type: "replace", board: parsed });
      setToast(`Imported ${Object.keys(parsed.cards).length} cards`);
    } catch {
      setToast("This file is not a Kanban board export");
    }
  };

  const reset = (next: "demo" | "empty") => {
    const label = next === "demo" ? "Restore the demo board" : "Delete every card";
    if (!window.confirm(`${label}? This cannot be undone.`)) return;
    dispatch({ type: "replace", board: next === "demo" ? demoBoard() : emptyBoard() });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <div>
            <h1>Kanban</h1>
            <p className="muted">
              {total} cards · {progress}% done
            </p>
          </div>
        </div>

        <label className="search">
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchInput}
            type="search"
            placeholder="Search cards, #tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search cards"
          />
          <kbd>/</kbd>
        </label>

        <div className="actions">
          <button className="btn primary" onClick={() => setEditing({ mode: "new", columnId: board.columns[0].id })}>
            + New card <kbd>N</kbd>
          </button>
          <button
            className="btn icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title="Theme"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <details className="menu">
            <summary className="btn icon" aria-label="More actions" title="More">
              ⋯
            </summary>
            <div className="menu-panel">
              <button onClick={exportBoard}>Export JSON</button>
              <button onClick={() => fileInput.current?.click()}>Import JSON…</button>
              <button onClick={() => reset("demo")}>Restore demo board</button>
              <button className="danger" onClick={() => reset("empty")}>
                Delete everything
              </button>
            </div>
          </details>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importBoard(file);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <main className="board">
        {board.columns.map((column) => (
          <ColumnView
            key={column.id}
            column={column}
            columns={board.columns}
            cards={visible[column.id]}
            filtered={query.trim() !== ""}
            dispatch={dispatch}
            onAdd={() => setEditing({ mode: "new", columnId: column.id })}
            onOpen={(card) => setEditing({ mode: "edit", card })}
          />
        ))}
      </main>

      <footer className="foot muted">
        Saved in your browser · Drag cards, or focus one and use <kbd>Alt</kbd> + arrows ·{" "}
        <a href="https://github.com/NissemBatMan/kanban">Source on GitHub</a>
      </footer>

      {editing && (
        <CardEditor
          target={editing}
          columns={board.columns}
          dispatch={dispatch}
          onClose={() => setEditing(null)}
        />
      )}

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
