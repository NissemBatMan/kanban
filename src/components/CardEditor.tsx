import { type Dispatch, useEffect, useRef, useState } from "react";
import { type Action, type Card, type CardDraft, type Column, PRIORITIES, cleanDraft } from "../board";

export type EditorTarget = { mode: "new"; columnId: string } | { mode: "edit"; card: Card };

type Props = { target: EditorTarget; columns: Column[]; dispatch: Dispatch<Action>; onClose: () => void };

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Add / edit dialog. A native <dialog>: focus trap, Esc to close and backdrop for free. */
export function CardEditor({ target, columns, dispatch, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const editing = target.mode === "edit" ? target.card : null;
  const currentColumn =
    target.mode === "new" ? target.columnId : columns.find((c) => c.cardIds.includes(target.card.id))?.id ?? "";

  const [draft, setDraft] = useState<CardDraft>({
    title: editing?.title ?? "",
    notes: editing?.notes ?? "",
    priority: editing?.priority ?? "medium",
    tags: editing?.tags ?? [],
    due: editing?.due ?? "",
  });
  const [tagText, setTagText] = useState(draft.tags.join(", "));
  const [columnId, setColumnId] = useState(currentColumn);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanDraft({ ...draft, tags: tagText.split(",") });
    if (!clean) {
      setError("Give the card a title.");
      return;
    }
    if (editing) {
      dispatch({ type: "updateCard", id: editing.id, draft: clean });
      if (columnId !== currentColumn) dispatch({ type: "moveCard", id: editing.id, toColumnId: columnId, toIndex: 0 });
    } else {
      dispatch({ type: "addCard", columnId, draft: clean, id: newId(), now: Date.now() });
    }
    onClose();
  };

  const remove = () => {
    if (editing && window.confirm(`Delete "${editing.title}"?`)) {
      dispatch({ type: "deleteCard", id: editing.id });
      onClose();
    }
  };

  return (
    <dialog
      ref={dialog}
      className="editor"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-labelledby="editor-title"
    >
      <form onSubmit={save} noValidate>
        <h2 id="editor-title">{editing ? "Edit card" : "New card"}</h2>

        <label>
          Title
          <input
            autoFocus
            required
            maxLength={140}
            value={draft.title}
            onChange={(e) => {
              setDraft({ ...draft, title: e.target.value });
              setError("");
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "title-error" : undefined}
          />
        </label>
        {error && (
          <p id="title-error" className="error">
            {error}
          </p>
        )}

        <label>
          Notes
          <textarea
            rows={4}
            maxLength={2000}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>

        <div className="row">
          <fieldset>
            <legend>Priority</legend>
            <div className="segmented">
              {PRIORITIES.map((p) => (
                <label key={p} className={`priority-${p}`}>
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    checked={draft.priority === p}
                    onChange={() => setDraft({ ...draft, priority: p })}
                  />
                  {p}
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Due date
            <input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
          </label>
        </div>

        <div className="row">
          <label>
            Tags <span className="muted">(comma separated)</span>
            <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="design, api" />
          </label>
          <label>
            Column
            <select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="editor-actions">
          {editing && (
            <button type="button" className="btn danger-ghost" onClick={remove}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {editing ? "Save" : "Add card"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
