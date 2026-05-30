import React from 'react';

interface ChatHeaderProps {
  sessionTitle: string;
  isSessionListOpen: boolean;
  onToggleSessionList: () => void;
  onNewConversation: () => void;
  onRefreshRuntime: () => void;
  onOpenSettings: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  sessionTitle,
  isSessionListOpen,
  onToggleSessionList,
  onNewConversation,
  onRefreshRuntime,
  onOpenSettings,
}) => {
  return (
    <div style={{
      display: 'flex',
      userSelect: 'none',
      justifyContent: 'flex-start',
      gap: 4,
      padding: 6,
      alignItems: 'center',
      minHeight: 40,
    }} className="gakr-chat-header">
      {/* History button */}
      <button
        onClick={onToggleSessionList}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)] ${
          isSessionListOpen ? 'bg-[var(--vscode-toolbar-activeBackground)]' : ''
        }`}
        title="Past Conversations"
        aria-label="Past Conversations"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.507 12.324a7 7 0 0 0 .065-8.56A7 7 0 0 0 2 4.393V2H1v3.5l.5.5H5V5H2.811a6.008 6.008 0 1 1-.135 5.77l-.887.462a7 7 0 0 0 11.718 1.092zM8 4v4.5l.5.5H11v-1H9V4H8z"/>
        </svg>
        <span className="hidden sm:inline">History</span>
      </button>

      {/* Session title */}
      <div className="flex-1 text-center truncate px-2">
        <span className="text-xs font-medium opacity-80" title={sessionTitle}>
          {sessionTitle}
        </span>
      </div>

      <button
        onClick={onRefreshRuntime}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)]"
        title="Refresh GakrCLI runtime"
        aria-label="Refresh GakrCLI runtime"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.2 5.2A5.5 5.5 0 1 0 14 8" />
          <path d="M13.5 1.8v3.8H9.7" />
        </svg>
        <span className="hidden sm:inline">Refresh</span>
      </button>

      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)]"
        title="Runtime Settings"
        aria-label="Runtime Settings"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M9.1 1l.35 1.47c.28.1.55.21.8.35l1.3-.79 1.5 1.5-.79 1.3c.14.25.26.52.35.8L14 6v2l-1.39.37c-.09.28-.21.55-.35.8l.79 1.3-1.5 1.5-1.3-.79c-.25.14-.52.26-.8.35L9.1 13H6.9l-.35-1.47c-.28-.09-.55-.21-.8-.35l-1.3.79-1.5-1.5.79-1.3a5.2 5.2 0 0 1-.35-.8L2 8V6l1.39-.37c.09-.28.21-.55.35-.8l-.79-1.3 1.5-1.5 1.3.79c.25-.14.52-.25.8-.35L6.9 1h2.2zM8 5a2 2 0 100 4 2 2 0 000-4z"/>
        </svg>
        <span className="hidden sm:inline">Settings</span>
      </button>
      <button
        onClick={onNewConversation}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)]"
        title="New Conversation"
        aria-label="New Conversation"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/>
        </svg>
        <span className="hidden sm:inline">New</span>
      </button>
    </div>
  );
};
