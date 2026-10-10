// Seeded from src/tools.ts (getAllBaseTools) and the per-tool name/prompt
// constants under src/tools/<Tool>/. Test-only, internal, and platform-gated
// tools are intentionally excluded.

export interface ToolDoc {
  name: string
  description: string
}

export interface ToolGroup {
  id: string
  label: string
  intro?: string
  tools: ToolDoc[]
}

export const toolGroups: ToolGroup[] = [
  {
    id: 'files',
    label: 'files & code',
    intro: 'The core read/write loop: the agent uses these to inspect and modify your repository.',
    tools: [
      { name: 'Read', description: 'Read a file from disk with line numbers, supporting offsets and limits for large files. Images are returned as image blocks.' },
      { name: 'Write', description: 'Create a new file or completely overwrite an existing one.' },
      { name: 'Edit', description: 'Make a targeted string replacement in a file. Refuses ambiguous or missing matches so edits can not land in the wrong place.' },
      { name: 'NotebookEdit', description: 'Create, edit, or delete cells in Jupyter notebooks (.ipynb).' },
      { name: 'Bash', description: 'Run a shell command in the project directory. Commands pass through a safety classifier and the permission system; long output is truncated.' },
      { name: 'PowerShell', description: 'Windows-native PowerShell execution with auto-detection of when to use it over the default shell.' },
      { name: 'Glob', description: 'Find files by name pattern (e.g. **/*.test.ts), sorted by modification time.' },
      { name: 'Grep', description: 'Regex search across file contents with includes/excludes, powered by ripgrep.' },
      { name: 'LSP', description: 'Language-server code intelligence: go-to-definition, find references, diagnostics, and code actions for symbols the agent is working with.' },
      { name: 'RepoMap', description: 'Build a structural map of the repository (files, symbols, PageRank-weighted) so the model can reason about large codebases without reading every file.' },
    ],
  },
  {
    id: 'web',
    label: 'web & research',
    intro: 'Everything the agent uses to look things up online — from one-shot fetches to a full controllable browser.',
    tools: [
      { name: 'WebFetch', description: 'Fetch a URL and return its content converted to markdown, ready for the model to read.' },
      { name: 'WebSearch', description: 'Search the web and return results with snippets the agent can follow up on.' },
      { name: 'ImageSearch', description: 'Search for images matching a query and return them to the conversation.' },
      { name: 'VideoSearch', description: 'Search for videos matching a query and return metadata/results to the conversation.' },
      { name: 'WebBrowser', description: 'Full browser automation (see the dedicated section below): navigate, click, type, fill forms, take screenshots, read console/network logs, manage tabs and storage, and record sessions.' },
    ],
  },
  {
    id: 'agents',
    label: 'agents & delegation',
    intro: 'Spawn focused subagents, monitor them, and coordinate multi-agent work. See the agents page for the full picture.',
    tools: [
      { name: 'Agent', description: 'Delegate a task to a subagent with its own context window. Specialized types include Explore (fast read-only search), Plan (design before implementation), and a read-only verification agent; omitting subagent_type forks the current conversation instead.' },
      { name: 'TaskOutput', description: 'Read the output of a background task the agent started earlier.' },
      { name: 'TaskStop', description: 'Stop a running background task or subagent.' },
      { name: 'Monitor', description: 'Watch and stream output from MCP servers / long-running processes so the agent can react as output arrives.' },
      { name: 'SendMessage', description: 'Send a message to another agent in a multi-agent (coordinator) session.' },
      { name: 'TeamCreate / TeamDelete', description: 'Create or tear down a team of cooperating agents for swarm-style execution.' },
    ],
  },
  {
    id: 'planning',
    label: 'planning & tracking',
    intro: 'How the agent breaks work down, asks you questions, and stays on track toward a goal.',
    tools: [
      { name: 'EnterPlanMode', description: 'Enter research/plan mode: explore the codebase and produce an implementation plan for review before touching any files.' },
      { name: 'ExitPlanMode', description: 'Present the finished plan to the user for approval, then (on approval) continue with implementation.' },
      { name: 'TodoWrite', description: 'Create and update a hierarchical task list that is shown in the UI and steers multi-step work.' },
      { name: 'GoalTool', description: 'Track a session completion goal: after each turn an evaluator checks whether the goal condition is met and feeds a continuation instruction back to the agent (see /goal on the slash commands page).' },
      { name: 'AskUserQuestion', description: 'Pause and ask the user a structured multiple-choice question when a decision is genuinely needed.' },
    ],
  },
  {
    id: 'memory',
    label: 'memory & skills',
    intro: 'Reusable knowledge: persistent memory files, the searchable memory index, and skill prompts.',
    tools: [
      { name: 'memory_recall', description: 'On-demand search over the SQLite (FTS5/BM25) memory index — auto-memory markdown files plus every session summary. Returns provenance-tagged hits (path, heading, session, score, excerpt). Enabled when auto-memory is on.' },
      { name: 'Skill', description: 'Invoke a skill: a reusable, versionable prompt that teaches the agent a repeatable process (bundled or your own in ~/.gakrcli/skills/).' },
      { name: 'DiscoverSkills', description: 'Search available skills by topic (TF-IDF) so the agent can find a relevant skill it was not explicitly told about.' },
    ],
  },
  {
    id: 'background',
    label: 'background & scheduling',
    intro: 'Run work while you are away: background shells, cron-style schedules, and wake-ups.',
    tools: [
      { name: 'CronCreate / CronList / CronDelete', description: 'Schedule recurring in-session jobs on a cron expression, list them, or cancel them by ID.' },
      { name: 'Sleep', description: 'Pause the agent for a duration — the pacing primitive behind proactive/autonomous tick-driven runs.' },
      { name: 'RemoteTrigger', description: 'Register a remote trigger that can wake the session (used with scheduled agents).' },
      { name: 'SubscribePR', description: 'Subscribe to a pull request so the agent can react to its updates.' },
      { name: 'SuggestBackgroundPR', description: 'Suggest spinning off a background PR for work that should not block the main thread.' },
    ],
  },
  {
    id: 'integrations',
    label: 'integrations & extensibility',
    intro: 'MCP servers plug external tools into the agent; these tools manage that surface.',
    tools: [
      { name: 'mcp__* (dynamic)', description: 'Every tool exposed by a connected MCP server becomes a first-class tool (named mcp__<server>__<tool>), with its own permission rules.' },
      { name: 'ListMcpResources / ReadMcpResource', description: 'Enumerate and read resources published by MCP servers (files, docs, data sources).' },
      { name: 'ToolSearch', description: 'Search the full tool catalog when the tool list is deferred to save context — the model discovers tools on demand instead of carrying every schema in the prompt.' },
      { name: 'SearchExtraTools / ExecuteExtraTool', description: 'The deferred-tool pair: search discovers an extra tool, ExecuteExtraTool invokes it without loading it permanently into context.' },
      { name: 'Config', description: 'Read or update GakrCLI settings (permissions, env, model defaults) in a structured way.' },
    ],
  },
  {
    id: 'worktree',
    label: 'worktree isolation',
    intro: 'Do risky or parallel work in an isolated git worktree without touching your working tree.',
    tools: [
      { name: 'EnterWorktree', description: 'Create/enter an isolated git worktree for the current task; file tools operate there until the agent exits.' },
      { name: 'ExitWorktree', description: 'Leave the worktree, optionally opening a PR from its branch.' },
    ],
  },
]

export interface BrowserAction {
  action: string
  description: string
}

/** All actions of the WebBrowser tool, from src/tools/WebBrowserTool/types.ts. */
export const browserActions: BrowserAction[] = [
  { action: 'navigate', description: 'Open a URL, optionally in a new tab.' },
  { action: 'click', description: 'Click an element by its get_state index or a CSS selector.' },
  { action: 'type', description: 'Type text into an input field by index or selector (optionally submitting).' },
  { action: 'fill_form', description: 'Fill multiple form fields in a single call.' },
  { action: 'get_state', description: 'Snapshot the page: a numbered list of every interactive element, backed by stable xpaths and bounding boxes. The number shown is the exact index to pass to click/type. Highlight overlays are painted only when a screenshot is requested.' },
  { action: 'get_content', description: 'Extract the main page content as clean markdown via a structural DOM walker (headings, lists, links, code preserved; ads/noise filtered).' },
  { action: 'scroll', description: 'Scroll the page up or down.' },
  { action: 'scroll_to_text', description: 'Scroll to the first occurrence of given text.' },
  { action: 'find_elements', description: 'Query DOM elements by CSS selector (grep for the page).' },
  { action: 'search_page', description: 'Search page text for a pattern.' },
  { action: 'send_keys', description: 'Send key combos (e.g. Control+a) to the active page.' },
  { action: 'press_key', description: 'Press a single keyboard key.' },
  { action: 'screenshot', description: 'Capture the visible page (optionally full page); can be saved to disk under .agent_tmp/browser_observations/.' },
  { action: 'evaluate', description: 'Run JavaScript in the page and return the result.' },
  { action: 'dropdown_options', description: 'List all options of a native dropdown or ARIA menu.' },
  { action: 'select_dropdown', description: 'Select a dropdown/ARIA menu option by text.' },
  { action: 'upload_file', description: 'Upload files to a file input element, with actionable errors for missing elements or unreachable paths.' },
  { action: 'search_google', description: 'Run a Google search and return results.' },
  { action: 'save_as_pdf', description: 'Save the current page as a PDF.' },
  { action: 'go_back', description: 'Go back in browser history.' },
  { action: 'list_tabs', description: 'List all open tabs.' },
  { action: 'switch_tab', description: 'Switch to another tab.' },
  { action: 'close_tab', description: 'Close a specific tab.' },
  { action: 'close_all_tabs', description: 'Close every open tab.' },
  { action: 'get_storage', description: 'Read cookies, localStorage, and sessionStorage.' },
  { action: 'set_storage', description: 'Write cookies, localStorage, and sessionStorage (defends against malformed payloads).' },
  { action: 'start_recording', description: 'Start recording the browser session with a vendored rrweb bundle — replayable session footage, no CDN dependency.' },
  { action: 'stop_recording', description: 'Stop recording and write the replay data to disk.' },
  { action: 'read_console_messages', description: 'Read recent console output (log/warn/error/debug) from the page.' },
  { action: 'read_network_requests', description: 'Read the page’s network request log, optionally filtered by URL or failures.' },
  { action: 'refresh', description: 'Reload the current page.' },
  { action: 'wait', description: 'Wait for a fixed duration.' },
  { action: 'wait_for_element', description: 'Wait for an element to reach a state (visible/hidden/attached/detached) with a bounded timeout — cheaper than polling with get_state.' },
  { action: 'resize_window', description: 'Resize the browser viewport.' },
]

export interface BrowserFeature {
  title: string
  body: string
}

export const browserFeatures: BrowserFeature[] = [
  {
    title: 'Real Chromium, headless or headed',
    body: 'Driven by Playwright. Headless mode uses a fixed 1280×720 viewport with automation-hardening args; headed mode uses the real OS window (window_size / window_position are configurable). On Linux without a display server it fails fast with an actionable xvfb-run hint.',
  },
  {
    title: 'Interactive-element DOM tree',
    body: 'A browser-use-style extraction pass finds every interactive element and renders a numbered list for the model. Each number backs a stable xpath in a selector map plus bounding-box data, so clicks and typing stay reliable across page updates.',
  },
  {
    title: 'Session recording',
    body: 'start_recording / stop_recording capture a replayable session video using a vendored rrweb bundle (bundled from assets/, with CDN only as last-resort fallback) — great for debugging flaky flows.',
  },
  {
    title: 'Storage & auth flows',
    body: 'Read and write cookies, localStorage, and sessionStorage directly. Secret-injection paths redact <secret>-tagged values and support TOTP code generation (HMAC-SHA1, 6 digits).',
  },
  {
    title: 'Observability',
    body: 'read_console_messages and read_network_requests expose what the page logged and fetched; screenshots and get_content give visual and textual snapshots for verification.',
  },
  {
    title: 'Scratch outputs stay scoped',
    body: 'Screenshots saved to disk land in .agent_tmp/browser_observations/ (sanitized filenames) so transient captures never pollute the repo.',
  },
]
