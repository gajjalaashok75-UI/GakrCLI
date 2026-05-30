import { useState, useCallback, useEffect, useRef } from 'react';
import { vscode } from '../vscode';
import { useStream } from './useStream';
import type { ChatMessage, SessionCost, TodoItem } from '../types/chat';
import type {
  SDKMessage,
  StreamEvent,
  AssistantMessage,
  UserMessage,
  ResultMessage,
  SystemInitMessage,
} from '../types/messages';
import {
  attachToolResults,
  blocksSignature,
  blocksSoftSignature,
  extractToolResultBlocks,
  extractUserVisibleText,
  formatFilesPersistedMessage,
  isToolUseBlock,
  mergeExistingToolResults,
  normalizeRenderableBlocks,
  normalizeTextContentBlock,
  stripInternalTextWrappers,
} from '../utils/chatMessageTransforms';

const EMPTY_COST: SessionCost = {
  totalCostUSD: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  numTurns: 0,
  durationMs: 0,
};

interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface RateLimitInfo {
  resetsAt: number;       // Unix timestamp seconds
  rateLimitType: string;
  message: string;
}

export interface ToolActivity {
  toolName: string;
  description: string;  // e.g. "Editing src/App.tsx" or "Running: npm test"
}

export interface RetryInfo {
  attempt: number;
  retryAt: number;
  delayMs: number;
}

/** Format a human-readable description of tool activity */
function formatToolActivity(
  toolName: string,
  progress?: string,
  input?: Record<string, unknown>,
): string {
  if (progress) return progress;

  // Map known tool names to human-readable descriptions
  const name = toolName.toLowerCase();

  if (name.includes('bash') || name.includes('terminal')) {
    const cmd = input?.command as string;
    if (cmd) {
      const short = cmd.length > 60 ? cmd.slice(0, 57) + '...' : cmd;
      return `Running: ${short}`;
    }
    return 'Running command...';
  }

  if (name.includes('edit') || name.includes('write') || name.includes('file_edit')) {
    const filePath = (input?.file_path ?? input?.path ?? input?.filename) as string;
    if (filePath) {
      const fileName = filePath.split('/').pop() ?? filePath;
      return `Editing ${fileName}`;
    }
    return 'Editing file...';
  }

  if (name.includes('read')) {
    const filePath = (input?.file_path ?? input?.path ?? input?.filename) as string;
    if (filePath) {
      const fileName = filePath.split('/').pop() ?? filePath;
      return `Reading ${fileName}`;
    }
    return 'Reading file...';
  }

  if (name.includes('search') || name.includes('grep') || name.includes('glob')) {
    const pattern = (input?.pattern ?? input?.query ?? input?.regex) as string;
    if (pattern) return `Searching: ${pattern}`;
    return 'Searching...';
  }

  if (name.includes('web') || name.includes('fetch') || name.includes('browser')) {
    return 'Browsing web...';
  }

  return `${toolName}...`;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cost, setCost] = useState<SessionCost>(EMPTY_COST);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [processState, setProcessState] = useState<'idle' | 'starting' | 'running' | 'stopped' | 'crashed' | 'restarting'>('idle');
  const [fastModeState, setFastModeState] = useState<{ enabled: boolean; canToggle: boolean }>({
    enabled: false,
    canToggle: true,
  });
  const [availableModels, setAvailableModels] = useState<Array<{ value: string; displayName: string }>>([]);
  const [effortLevel, setEffortLevel] = useState<string>('medium');
  const [toolActivity, setToolActivity] = useState<ToolActivity | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [retryInfo, setRetryInfo] = useState<RetryInfo | null>(null);

  const { processStreamEvent, resetStream } = useStream();
  const streamingUuidRef = useRef<string | null>(null);
  const resultTargetAssistantIdRef = useRef<string | null>(null);
  const activeToolUseIdsRef = useRef<Set<string>>(new Set());
  const userInterruptedRef = useRef(false);

  const handleUserMessage = useCallback((msg: UserMessage) => {
    const id = msg.uuid || `user-${Date.now()}`;
    const toolResults = extractToolResultBlocks(msg.message.content);
    if (toolResults.length > 0) {
      setMessages((prev) => attachToolResults(prev, toolResults));
      for (const result of toolResults) {
        activeToolUseIdsRef.current.delete(result.tool_use_id);
      }
      if (activeToolUseIdsRef.current.size === 0) {
        setToolActivity(null);
      }
      return;
    }

    const text = extractUserVisibleText(msg.message.content);

    if (!text) {
      return;
    }
    if (isUserInterruptText(text)) {
      return;
    }

    resultTargetAssistantIdRef.current = null;
    const chatMsg: ChatMessage = {
      id,
      role: 'user',
      text,
      isStreaming: false,
      timestamp: Date.now(),
      parentToolUseId: null,
    };
    setMessages((prev) => {
      // Skip if this message was already loaded from session history
      if (msg.uuid && prev.some((m) => m.id === msg.uuid)) return prev;
      return [...prev, chatMsg];
    });
  }, []);

  const handleStreamEvent = useCallback(
    (streamEvent: StreamEvent) => {
      const update = processStreamEvent(streamEvent);

      switch (update.type) {
        case 'message_start': {
          streamingUuidRef.current = update.uuid;
          resultTargetAssistantIdRef.current = update.uuid;
          setIsStreaming(true);
          if (update.model) setModel(update.model);

          const chatMsg: ChatMessage = {
            id: update.uuid,
            role: 'assistant',
            blocks: [],
            isStreaming: true,
            timestamp: Date.now(),
            parentToolUseId: update.parentToolUseId,
            model: update.model || undefined,
          };
          setMessages((prev) => [...prev, chatMsg]);
          break;
        }

        case 'block_start':
        case 'block_delta':
        case 'block_stop': {
          const uuid = streamingUuidRef.current;
          if (!uuid) break;
          const displayBlocks = normalizeRenderableBlocks(update.blocks);
          const nextTodos = extractTodosFromRenderableBlocks(displayBlocks);
          if (nextTodos) {
            setTodos(nextTodos);
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === uuid ? { ...msg, blocks: displayBlocks } : msg,
            ),
          );
          // Extract tool activity from tool_use blocks
          if (update.type === 'block_start' && displayBlocks) {
            const latestBlock = displayBlocks[displayBlocks.length - 1];
            if (latestBlock) {
              const block = latestBlock.block;
              if (block.type === 'tool_use' || block.type === 'server_tool_use') {
                const toolInput = (block as { input?: Record<string, unknown> }).input;
                if (typeof block.id === 'string') {
                  activeToolUseIdsRef.current.add(block.id);
                }
                setToolActivity({
                  toolName: block.name,
                  description: formatToolActivity(block.name, undefined, toolInput),
                });
              }
            }
          }
          break;
        }

        case 'message_stop': {
          const uuid = streamingUuidRef.current;
          const stoppedBlocks = normalizeRenderableBlocks(update.blocks ?? []);
          if (uuid) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === uuid) {
                  return {
                    ...msg,
                    isStreaming: false,
                    blocks: msg.blocks?.map((b) => ({ ...b, isStreaming: false })),
                  };
                }
                return msg;
              }),
            );
          }
          const waitingForTools =
            activeToolUseIdsRef.current.size > 0 ||
            stoppedBlocks.some((b) => isToolUseBlock(b.block));

          if (waitingForTools) {
            setIsStreaming(true);
            if (!toolActivity) {
              setToolActivity({
                toolName: 'Tool',
                description: 'Waiting for tool result...',
              });
            }
          } else {
            setIsStreaming(false);
            setToolActivity(null);
          }
          streamingUuidRef.current = null;
          resetStream();
          break;
        }
      }
    },
    [processStreamEvent, resetStream, toolActivity],
  );

  const handleAssistantMessage = useCallback((msg: AssistantMessage) => {
    const blocks = (msg.message.content || []).map((block, index) => ({
      index,
      block: normalizeTextContentBlock(block),
      isStreaming: false,
    }));
    if (isUserAbortAssistantBlocks(blocks)) {
      return;
    }

    const chatMsg: ChatMessage = {
      id: msg.uuid,
      role: 'assistant',
      blocks,
      isStreaming: false,
      timestamp: Date.now(),
      parentToolUseId: msg.parent_tool_use_id,
      model: msg.message.model,
    };
    const nextTodos = extractTodosFromRenderableBlocks(blocks);
    if (nextTodos) {
      setTodos(nextTodos);
    }
    let resolvedAssistantId = msg.uuid;
    setMessages((prev) => {
      const existingIndex = msg.uuid ? prev.findIndex((m) => m.id === msg.uuid) : -1;
      if (existingIndex >= 0) {
        resolvedAssistantId = msg.uuid;
        return prev.map((m, index) =>
          index === existingIndex
            ? { ...m, ...chatMsg, blocks: mergeExistingToolResults(blocks, m.blocks ?? []) }
            : m,
        );
      }

      const finalSignature = blocksSignature(blocks);
      const finalSoftSignature = blocksSoftSignature(blocks);
      for (let index = prev.length - 1, checked = 0; index >= 0 && checked < 8; index--) {
        const candidate = prev[index];
        if (!candidate || candidate.role !== 'assistant') continue;
        checked++;
        const candidateBlocks = candidate.blocks ?? [];
        if (
          blocksSignature(candidateBlocks) === finalSignature ||
          (finalSoftSignature && blocksSoftSignature(candidateBlocks) === finalSoftSignature)
        ) {
          resolvedAssistantId = candidate.id;
          return prev.map((m, msgIndex) =>
            msgIndex === index
              ? {
                  ...m,
                  blocks: mergeExistingToolResults(blocks, candidateBlocks),
                  isStreaming: false,
                  model: chatMsg.model ?? m.model,
                }
              : m,
          );
        }
      }

      return [...prev, chatMsg];
    });
    resultTargetAssistantIdRef.current = resolvedAssistantId;
    if (!streamingUuidRef.current && activeToolUseIdsRef.current.size === 0) {
      setIsStreaming(false);
      setToolActivity(null);
    }
  }, []);

  const handleResultMessage = useCallback((msg: ResultMessage) => {
    setIsStreaming(false);
    setToolActivity(null);
    setRetryInfo(null);
    activeToolUseIdsRef.current.clear();
    streamingUuidRef.current = null;
    resetStream();
    const usage = normalizeUsage(msg);
    const msgAny = msg as unknown as Record<string, unknown>;
    const wasUserAbort = userInterruptedRef.current || isUserAbortResult(msg);
    const rawTurns = readNumber(msgAny, 'num_turns', 'numTurns') ?? 0;

    const nextCost = {
      totalCostUSD: readNumber(msgAny, 'total_cost_usd', 'totalCostUsd', 'totalCostUSD') ?? 0,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      numTurns: wasUserAbort && rawTurns > 0 ? rawTurns - 1 : rawTurns,
      durationMs: readNumber(msgAny, 'duration_ms', 'durationMs') ?? 0,
    };
    setCost(nextCost);
    setMessages((prev) => attachCostToAssistant(prev, resultTargetAssistantIdRef.current, nextCost, wasUserAbort));

    if (msg.is_error && !wasUserAbort) {
      const resultText = (msg as unknown as Record<string, unknown>).result as string | undefined;
      if (resultText) {
        setError(resultText);
      } else if (msg.errors && msg.errors.length > 0) {
        setError(msg.errors.join('\n'));
      } else {
        setError('An error occurred');
      }
    }
    userInterruptedRef.current = false;
  }, [resetStream]);

  const handleSystemInit = useCallback((msg: SystemInitMessage) => {
    setSessionId(msg.session_id);
    setModel(msg.model);
  }, []);

  const handleSessionTitle = useCallback((title: string) => {
    setSessionTitle(title);
  }, []);

  // Add a system-style inline message to the chat
  const addSystemMessage = useCallback((text: string, id?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: id ?? `sys-${Date.now()}`,
        role: 'system' as const,
        text,
        isStreaming: false,
        timestamp: Date.now(),
        parentToolUseId: null,
      },
    ]);
  }, []);
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Handle process state changes
      if (data.type === 'process_state') {
        setProcessState(data.state);
        if (data.state === 'stopped' || data.state === 'crashed') {
          setIsStreaming(false);
          setToolActivity(null);
          setRetryInfo(null);
          streamingUuidRef.current = null;
          resultTargetAssistantIdRef.current = null;
        }
        // Clear errors when process comes back up
        if (data.state === 'running' || data.state === 'starting') {
          setError(null);
          setRateLimitInfo(null);
        }
        return;
      }

      if (data.type === 'provider_state') {
        if (typeof data.currentModel === 'string' && data.currentModel.trim()) {
          setModel(data.currentModel);
        }
        if (Array.isArray(data.models)) {
          setAvailableModels(
            (data.models as Array<Record<string, unknown>>)
              .map((m) => ({
                value: (m.value as string) || (m.id as string) || '',
                displayName: (m.displayName as string) || (m.value as string) || (m.id as string) || '',
              }))
              .filter((m) => m.value),
          );
        }
        return;
      }

      // Unwrap cli_output envelope
      const msg: SDKMessage = data.type === 'cli_output' ? data.data : data;
      if (!msg || typeof msg !== 'object') return;

      try {
        const msgAny = msg as Record<string, unknown>;

        switch (msgAny.type) {
          case 'stream_event':
            handleStreamEvent(msg as StreamEvent);
            break;

          case 'user':
            handleUserMessage(msg as UserMessage);
            break;

          case 'assistant':
            handleAssistantMessage(msg as AssistantMessage);
            break;

          case 'result':
            handleResultMessage(msg as ResultMessage);
            {
              const resultAny = msg as Record<string, unknown>;
              if (resultAny.fast_mode_state) {
                const fms = resultAny.fast_mode_state as Record<string, unknown>;
                setFastModeState({
                  enabled: (fms.enabled as boolean) ?? false,
                  canToggle: (fms.canToggle as boolean) ?? true,
                });
              }
              if (typeof resultAny.effort === 'string') {
                setEffortLevel(resultAny.effort);
              }
            }
            break;

          case 'rate_limit_event': {
            const info = msgAny.rate_limit_info as Record<string, unknown> | undefined;
            if (info) {
              const resetsAt = info.resetsAt as number;
              const rateLimitType = info.rateLimitType as string ?? 'unknown';
              const resetTime = resetsAt
                ? new Date(resetsAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'soon';
              setRateLimitInfo({
                resetsAt,
                rateLimitType,
                message: `Rate limited (${rateLimitType}). Resets at ${resetTime}.`,
              });
              // Don't also setError — ErrorBanner shows rateLimitInfo directly
            }
            break;
          }

          case 'tool_progress': {
            // Show tool progress inline — update last assistant message or add system msg
            const toolName = msgAny.tool_name as string ?? 'tool';
            const progress = msgAny.progress as string ?? '';
            // Update tool activity indicator
            if (toolName || progress) {
              setToolActivity({
                toolName,
                description: formatToolActivity(toolName, progress, undefined),
              });
              setIsStreaming(true);
            }
            // Don't add a message for every progress tick — just update streaming state
            if (progress) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && last.isStreaming) {
                  return prev; // already showing streaming indicator
                }
                return prev;
              });
            }
            break;
          }

          case 'tool_use_summary': {
            const toolName = msgAny.tool_name as string ?? 'tool';
            const summary = msgAny.summary as string ?? '';
            if (summary) {
              addSystemMessage(`${toolName}: ${summary}`, `tool-summary-${Date.now()}`);
            }
            // Clear tool activity after summary
            setToolActivity(null);
            break;
          }

          case 'prompt_suggestion': {
            const suggestion = msgAny.suggestion as string;
            if (suggestion) {
              setPromptSuggestions((prev) =>
                [...prev.filter((s) => s !== suggestion), suggestion].slice(-5),
              );
            }
            break;
          }

          case 'system': {
            const subtype = msgAny.subtype as string;
            switch (subtype) {
              case 'init':
                handleSystemInit(msg as SystemInitMessage);
                {
                  const initAny = msg as Record<string, unknown>;
                  if (initAny.fast_mode_state) {
                    const fms = initAny.fast_mode_state as Record<string, unknown>;
                    setFastModeState({
                      enabled: (fms.enabled as boolean) ?? false,
                      canToggle: (fms.canToggle as boolean) ?? true,
                    });
                  }
                  if (Array.isArray(initAny.models)) {
                    setAvailableModels(
                      (initAny.models as Array<Record<string, unknown>>)
                        .map((m) => ({
                          value: (m.value as string) || (m.id as string) || '',
                          displayName: (m.value as string) || (m.id as string) || (m.displayName as string) || (m.name as string) || '',
                        }))
                        .filter((m) => m.value),
                    );
                  }
                  if (typeof initAny.effort === 'string') {
                    setEffortLevel(initAny.effort);
                  }
                }
                break;
              case 'ai-title': {
                const title = msgAny.title as string;
                if (title) handleSessionTitle(title);
                break;
              }
              case 'api_retry': {
                const attempt = msgAny.attempt as number ?? 1;
                const delayMs = readNumber(msgAny, 'retry_delay_ms', 'retryDelayMs') ?? 0;
                if (delayMs > 0) {
                  setRetryInfo({
                    attempt,
                    delayMs,
                    retryAt: Date.now() + delayMs,
                  });
                }
                const delayText = delayMs > 0 ? `, next attempt in ${formatShortDuration(delayMs)}` : '';
                addSystemMessage(`Retrying API call (attempt ${attempt}${delayText})...`, `retry-${Date.now()}`);
                break;
              }
              case 'compact_boundary':
                addSystemMessage('Context compacted to fit within limits.', `compact-${Date.now()}`);
                break;
              case 'permission_rule_added':
                if (typeof msgAny.text === 'string') {
                  addSystemMessage(msgAny.text, `permission-${Date.now()}`);
                }
                break;
              case 'files_persisted':
                addSystemMessage(formatFilesPersistedMessage(msgAny), `files-${Date.now()}`);
                break;
              // Other system events are handled by the extension host.
              default:
                break;
            }
            break;
          }

          default:
            break;
        }

        // Session title from extension host (legacy format)
        if (data.type === 'sessionTitle' && typeof data.title === 'string') {
          handleSessionTitle(data.title);
        }

        // Clear messages on new conversation
        if (data.type === 'clearMessages') {
          setMessages([]);
          setSessionTitle(null);
          setCost(EMPTY_COST);
          setIsStreaming(false);
          setError(null);
          setRateLimitInfo(null);
          setPromptSuggestions([]);
          setToolActivity(null);
          setRetryInfo(null);
          streamingUuidRef.current = null;
          resultTargetAssistantIdRef.current = null;
          userInterruptedRef.current = false;
          setTodos([]);
          resetStream();
        }

        // Bulk load session history on resume
        if (data.type === 'session_history' && Array.isArray(data.messages)) {
          const historyMsgs: ChatMessage[] = [];
          setCost(EMPTY_COST);
          setTodos([]);
          let lastHistoryAssistantId: string | null = null;
          for (const entry of data.messages as Array<Record<string, unknown>>) {
            if (entry.type === 'user') {
              // Handle both { message: { content } } and direct content formats
              const msg = (typeof entry.message === 'object' && entry.message)
                ? entry.message as Record<string, unknown>
                : null;
              const content = msg?.content ?? entry.content;
              const toolResults = extractToolResultBlocks(content as UserMessage['message']['content']);
              if (toolResults.length > 0) {
                const attachedMessages = attachToolResults(historyMsgs, toolResults);
                historyMsgs.splice(0, historyMsgs.length, ...attachedMessages);
                continue;
              }

              let text = '';
              if (typeof content === 'string') {
                text = stripInternalTextWrappers(content);
              } else if (Array.isArray(content)) {
                // Collect all text blocks (not just the first)
                const texts: string[] = [];
                for (const b of content as Array<Record<string, unknown>>) {
                  if (b.type === 'text' && typeof b.text === 'string') {
                    texts.push(b.text);
                  }
                }
                text = stripInternalTextWrappers(texts.join('\n'));
              }
              if (!text) continue;
              historyMsgs.push({
                id: (entry.uuid as string) || `user-hist-${historyMsgs.length}`,
                role: 'user',
                text,
                isStreaming: false,
                timestamp: entry.timestamp ? new Date(entry.timestamp as string).getTime() : Date.now(),
                parentToolUseId: (entry.parent_tool_use_id as string) || null,
              });
            } else if (entry.type === 'assistant') {
              const msg = (typeof entry.message === 'object' && entry.message)
                ? entry.message as Record<string, unknown>
                : null;
              const rawContent = msg?.content ?? entry.content;
              const contentArr = Array.isArray(rawContent) ? rawContent as Array<Record<string, unknown>> : [];
              const blocks = contentArr.map((block, index) => ({
                index,
                block: block as unknown as import('../types/messages').ContentBlock,
                isStreaming: false,
              }));
              const assistantId = (entry.uuid as string) || `asst-hist-${historyMsgs.length}`;
              const nextTodos = extractTodosFromRenderableBlocks(blocks);
              if (nextTodos) {
                setTodos(nextTodos);
              }
              historyMsgs.push({
                id: assistantId,
                role: 'assistant',
                blocks,
                isStreaming: false,
                timestamp: entry.timestamp ? new Date(entry.timestamp as string).getTime() : Date.now(),
                parentToolUseId: (entry.parent_tool_use_id as string) || null,
                model: (msg?.model as string) || undefined,
              });
              lastHistoryAssistantId = assistantId;
            } else if (entry.type === 'result') {
              const historyCost = costFromResultEntry(entry);
              if (historyCost) {
                const updated = attachCostToAssistant(historyMsgs, lastHistoryAssistantId, historyCost);
                historyMsgs.splice(0, historyMsgs.length, ...updated);
                setCost(historyCost);
              }
            }
          }
          if (historyMsgs.length > 0) {
            setMessages(historyMsgs);
          }
        }

      } catch (err) {
        console.error('[useChat] Error processing message:', err, data);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [
    handleStreamEvent,
    handleUserMessage,
    handleAssistantMessage,
    handleResultMessage,
    handleSystemInit,
    handleSessionTitle,
    addSystemMessage,
    resetStream,
  ]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    // Optimistically add user message
    const id = createUserMessageId();
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: 'user',
        text,
        isStreaming: false,
        timestamp: Date.now(),
        parentToolUseId: null,
      },
    ]);
    setError(null);
    setRateLimitInfo(null);
    setRetryInfo(null);
    setPromptSuggestions([]);
    if (!isStreaming) {
      setToolActivity(null);
    }
    setIsStreaming(!isLocalUiCommand(text));
    streamingUuidRef.current = null;
    resultTargetAssistantIdRef.current = null;
    userInterruptedRef.current = false;

    vscode.postMessage({
      type: 'send_prompt',
      text,
      uuid: id,
      priority: isStreaming ? 'next' : undefined,
    });
  }, [isStreaming]);

  const editMessage = useCallback((uuid: string, newContent: string) => {
    const text = newContent.trim();
    if (!text) return;
    const newId = isUuid(uuid) ? uuid : createUserMessageId();

    setMessages((prev) => {
      const index = prev.findIndex((message) => message.id === uuid);
      if (index === -1) return prev;

      return [
        ...prev.slice(0, index),
        {
          ...prev[index]!,
          id: newId,
          text,
          timestamp: Date.now(),
        },
      ];
    });
    setError(null);
    setRateLimitInfo(null);
    setRetryInfo(null);
    setPromptSuggestions([]);
    setToolActivity(null);
    setIsStreaming(!isLocalUiCommand(text));
    streamingUuidRef.current = null;
    resultTargetAssistantIdRef.current = null;
    userInterruptedRef.current = false;
    resetStream();

    vscode.postMessage({
      type: 'send_prompt',
      text,
      uuid: newId,
      priority: isStreaming ? 'next' : undefined,
    });
  }, [isStreaming, resetStream]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionTitle(null);
    setCost(EMPTY_COST);
    setIsStreaming(false);
    setError(null);
    setRateLimitInfo(null);
    setRetryInfo(null);
    setPromptSuggestions([]);
    setToolActivity(null);
    streamingUuidRef.current = null;
    resultTargetAssistantIdRef.current = null;
    userInterruptedRef.current = false;
    setTodos([]);
    resetStream();
  }, [resetStream]);

  const interrupt = useCallback(() => {
    userInterruptedRef.current = true;
    setRetryInfo(null);
    vscode.postMessage({ type: 'interrupt' });
    setIsStreaming(false);
  }, []);

  return {
    messages,
    sessionTitle,
    sessionId,
    cost,
    isStreaming,
    model,
    error,
    rateLimitInfo,
    promptSuggestions,
    processState,
    fastModeState,
    setFastModeState,
    availableModels,
    effortLevel,
    setEffortLevel,
    toolActivity,
    todos,
    retryInfo,
    sendMessage,
    editMessage,
    clearMessages,
    interrupt,
  };
}

function isLocalUiCommand(text: string): boolean {
  return /^\/providers?\s*$/i.test(text.trim());
}

function createUserMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function attachCostToAssistant(
  messages: ChatMessage[],
  assistantId: string | null,
  cost: SessionCost,
  appendStatsOnly = false,
): ChatMessage[] {
  if (assistantId) {
    const index = messages.findIndex((message) => message.id === assistantId && message.role === 'assistant');
    if (index >= 0) {
      return messages.map((message, msgIndex) =>
        msgIndex === index ? { ...message, cost } : message,
      );
    }
  }

  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'assistant') {
      return messages.map((message, msgIndex) =>
        msgIndex === index ? { ...message, cost } : message,
      );
    }
  }

  if (appendStatsOnly) {
    return [
      ...messages,
      {
        id: `asst-stats-${Date.now()}`,
        role: 'assistant',
        blocks: [],
        isStreaming: false,
        timestamp: Date.now(),
        parentToolUseId: null,
        cost,
      },
    ];
  }

  return messages;
}

function isUserInterruptText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === '[request interrupted by user]' ||
    normalized === 'request interrupted by user' ||
    normalized.startsWith('[request interrupted by user ');
}

function isUserAbortAssistantBlocks(blocks: ChatMessage['blocks']): boolean {
  const text = (blocks ?? [])
    .filter((item) => item.block.type === 'text')
    .map((item) => (item.block as { text?: string }).text ?? '')
    .join('\n')
    .trim();
  if (!text) return false;
  return isUserAbortText(text);
}

function isUserAbortResult(msg: ResultMessage): boolean {
  const record = msg as unknown as Record<string, unknown>;
  const result = typeof record.result === 'string' ? record.result : '';
  const errors = Array.isArray(msg.errors) ? msg.errors.join('\n') : '';
  return isUserAbortText(`${result}\n${errors}`);
}

function isUserAbortText(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.includes('request interrupted by user') ||
    normalized.includes('operation was aborted') ||
    normalized.includes('request was aborted') ||
    normalized.includes('apiuserabort') ||
    normalized.includes('aborterror');
}

function formatShortDuration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
}

function costFromResultEntry(entry: Record<string, unknown>): SessionCost | null {
  if (entry.type !== 'result') return null;
  const usage = normalizeUsage(entry as unknown as ResultMessage);
  return {
    totalCostUSD: readNumber(entry, 'total_cost_usd', 'totalCostUsd', 'totalCostUSD') ?? 0,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheCreationTokens: usage.cacheCreationTokens,
    numTurns: readNumber(entry, 'num_turns', 'numTurns') ?? 0,
    durationMs: readNumber(entry, 'duration_ms', 'durationMs') ?? 0,
  };
}

function extractTodosFromRenderableBlocks(blocks: ChatMessage['blocks'] | undefined): TodoItem[] | null {
  if (!blocks) return null;

  for (let index = blocks.length - 1; index >= 0; index--) {
    const block = blocks[index]?.block;
    if (!block || block.type !== 'tool_use') continue;
    const tool = block as { name?: string; input?: Record<string, unknown> };
    if (tool.name !== 'TodoWrite') continue;
    const rawTodos = tool.input?.todos;
    if (!Array.isArray(rawTodos)) return null;
    const todos = rawTodos
      .map(normalizeTodoItem)
      .filter((todo): todo is TodoItem => Boolean(todo));
    return todos.every((todo) => todo.status === 'completed') ? [] : todos;
  }

  return null;
}

function normalizeTodoItem(item: unknown): TodoItem | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const content = typeof record.content === 'string' ? record.content : '';
  const status = record.status;
  if (!content || (status !== 'pending' && status !== 'in_progress' && status !== 'completed')) {
    return null;
  }
  const activeForm = typeof record.activeForm === 'string' ? record.activeForm : undefined;
  return { content, status, activeForm };
}

function normalizeUsage(msg: ResultMessage): NormalizedUsage {
  const usage = (msg.usage ?? {}) as Record<string, unknown>;
  const modelUsage = ((msg as unknown as { modelUsage?: unknown; model_usage?: unknown }).modelUsage ??
    (msg as unknown as { model_usage?: unknown }).model_usage) as Record<string, Record<string, unknown>> | undefined;
  const aggregate = aggregateModelUsage(modelUsage);

  return {
    inputTokens: readNumber(usage, 'inputTokens', 'input_tokens') ?? aggregate.inputTokens,
    outputTokens: readNumber(usage, 'outputTokens', 'output_tokens') ?? aggregate.outputTokens,
    cacheReadTokens:
      readNumber(usage, 'cacheReadInputTokens', 'cache_read_input_tokens') ?? aggregate.cacheReadTokens,
    cacheCreationTokens:
      readNumber(usage, 'cacheCreationInputTokens', 'cache_creation_input_tokens') ??
      aggregate.cacheCreationTokens,
  };
}

function aggregateModelUsage(modelUsage: Record<string, Record<string, unknown>> | undefined): NormalizedUsage {
  const total: NormalizedUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };

  if (!modelUsage || typeof modelUsage !== 'object') {
    return total;
  }

  for (const usage of Object.values(modelUsage)) {
    total.inputTokens += readNumber(usage, 'inputTokens', 'input_tokens') ?? 0;
    total.outputTokens += readNumber(usage, 'outputTokens', 'output_tokens') ?? 0;
    total.cacheReadTokens += readNumber(usage, 'cacheReadInputTokens', 'cache_read_input_tokens') ?? 0;
    total.cacheCreationTokens +=
      readNumber(usage, 'cacheCreationInputTokens', 'cache_creation_input_tokens') ?? 0;
  }

  return total;
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}
