import type { TodoItem } from '../../types/chat';

interface TodoListViewerProps {
  todos: TodoItem[];
}

export function TodoListViewer({ todos }: TodoListViewerProps) {
  if (todos.length === 0) return null;

  return (
    <div className="todo-viewer" aria-label="Todo list">
      <div className="todo-viewer-header">
        <span>Tasks</span>
        <span>{todos.filter((todo) => todo.status === 'completed').length}/{todos.length}</span>
      </div>
      <div className="todo-viewer-list">
        {todos.map((todo, index) => (
          <div key={`${todo.status}-${todo.content}-${index}`} className="todo-viewer-row" data-status={todo.status}>
            <span className="todo-viewer-mark" aria-hidden="true" />
            <span className="todo-viewer-text">
              {todo.status === 'in_progress' && todo.activeForm ? todo.activeForm : todo.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
