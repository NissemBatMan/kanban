import { type Dispatch, useRef, useState } from "react";
import type { Action, Card, Column } from "../board";
import { CardView } from "./CardView";

type Props = {
  column: Column;
  columns: Column[];
  cards: Card[];
  filtered: boolean;
  dispatch: Dispatch<Action>;
  onAdd: () => void;
  onOpen: (card: Card) => void;
};

export const DRAG_TYPE = "application/x-kanban-card";

export function ColumnView({ column, columns, cards, filtered, dispatch, onAdd, onOpen }: Props) {
  const list = useRef<HTMLOListElement>(null);
  /** Index (in the full column) before which the dragged card would land. */
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);

  const over = column.limit !== undefined && column.cardIds.length > column.limit;

  /** Finds the slot under the pointer from the cards' vertical middles. */
  const indexAt = (clientY: number) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>("[data-card-id]") ?? [])];
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return column.cardIds.indexOf(item.dataset.cardId!);
    }
    const last = items[items.length - 1];
    return last ? column.cardIds.indexOf(last.dataset.cardId!) + 1 : column.cardIds.length;
  };

  const markerBefore = (cardId: string) => dropIndex !== null && column.cardIds[dropIndex] === cardId;
  const markerAtEnd =
    dropIndex !== null &&
    (dropIndex >= column.cardIds.length || !cards.some((c) => c.id === column.cardIds[dropIndex]));

  return (
    <section
      className={`column ${dropIndex !== null ? "drop-target" : ""}`}
      aria-labelledby={`col-${column.id}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropIndex(indexAt(e.clientY));
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropIndex(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData(DRAG_TYPE);
        if (id) dispatch({ type: "moveCard", id, toColumnId: column.id, toIndex: indexAt(e.clientY) });
        setDropIndex(null);
      }}
    >
      <header className="column-head">
        {renaming ? (
          <input
            className="rename"
            defaultValue={column.title}
            autoFocus
            maxLength={40}
            aria-label="Column name"
            onBlur={(e) => {
              dispatch({ type: "renameColumn", columnId: column.id, title: e.target.value });
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <h2 id={`col-${column.id}`} onDoubleClick={() => setRenaming(true)} title="Double-click to rename">
            {column.title}
          </h2>
        )}
        <span className={`count ${over ? "over" : ""}`} title={column.limit ? `Work-in-progress limit: ${column.limit}` : ""}>
          {filtered ? `${cards.length}/` : ""}
          {column.cardIds.length}
          {column.limit !== undefined ? ` / ${column.limit}` : ""}
        </span>
        <button className="btn ghost small" onClick={onAdd} aria-label={`Add a card to ${column.title}`}>
          +
        </button>
      </header>

      <ol ref={list} className="cards">
        {cards.map((card) => (
          <li key={card.id} data-card-id={card.id}>
            {markerBefore(card.id) && <div className="drop-marker" />}
            <CardView card={card} column={column} columns={columns} dispatch={dispatch} onOpen={() => onOpen(card)} />
          </li>
        ))}
        {markerAtEnd && <li className="drop-marker" aria-hidden />}
        {cards.length === 0 && dropIndex === null && (
          <li className="empty muted">{filtered ? "No matching cards" : "Drop cards here"}</li>
        )}
      </ol>
    </section>
  );
}
