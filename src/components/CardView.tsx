import { type Dispatch, useState } from "react";
import { type Action, type Card, type Column, dueState } from "../board";
import { DRAG_TYPE } from "./ColumnView";

type Props = { card: Card; column: Column; columns: Column[]; dispatch: Dispatch<Action>; onOpen: () => void };

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

/** Keyboard moves: Alt+←/→ changes column, Alt+↑/↓ reorders. Focus follows the card. */
function keyboardMove(e: React.KeyboardEvent, card: Card, column: Column, columns: Column[], dispatch: Dispatch<Action>) {
  if (!e.altKey) return;
  const columnIndex = columns.findIndex((c) => c.id === column.id);
  const index = column.cardIds.indexOf(card.id);
  let move: Action | null = null;
  if (e.key === "ArrowLeft" && columnIndex > 0)
    move = { type: "moveCard", id: card.id, toColumnId: columns[columnIndex - 1].id, toIndex: 0 };
  if (e.key === "ArrowRight" && columnIndex < columns.length - 1)
    move = { type: "moveCard", id: card.id, toColumnId: columns[columnIndex + 1].id, toIndex: 0 };
  if (e.key === "ArrowUp" && index > 0) move = { type: "moveCard", id: card.id, toColumnId: column.id, toIndex: index - 1 };
  if (e.key === "ArrowDown") move = { type: "moveCard", id: card.id, toColumnId: column.id, toIndex: index + 2 };
  if (!move) return;
  e.preventDefault();
  dispatch(move);
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-card-id="${card.id}"] .card`)?.focus());
}

export function CardView({ card, column, columns, dispatch, onOpen }: Props) {
  const [dragging, setDragging] = useState(false);
  const due = dueState(card.due);

  return (
    <article
      className={`card priority-${card.priority} ${dragging ? "dragging" : ""}`}
      tabIndex={0}
      draggable
      aria-label={`${card.title}, ${card.priority} priority. Enter to edit, Alt plus arrows to move.`}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, card.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        } else keyboardMove(e, card, column, columns, dispatch);
      }}
    >
      <div className="card-top">
        <span className={`dot priority-${card.priority}`} aria-hidden />
        <h3>{card.title}</h3>
      </div>
      {card.notes && <p className="notes">{card.notes}</p>}
      {(card.tags.length > 0 || card.due) && (
        <div className="meta">
          {card.tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
          {card.due && (
            <span className={`due ${due ?? ""}`}>
              {due === "overdue" ? "Overdue · " : ""}
              {dateFormat.format(new Date(`${card.due}T00:00:00`))}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
