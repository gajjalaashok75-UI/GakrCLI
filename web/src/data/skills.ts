// Seeded from src/skills/bundledSkills.ts + src/skills/bundled/*.ts.
// Internal/platform-gated skills are intentionally excluded.

export interface Skill {
  name: string
  invocation: string
  description: string
}

export const skills: Skill[] = [
  {
    name: 'batch',
    invocation: '/batch',
    description:
      'Research and plan a large-scale change, then execute it in parallel across 5–30 isolated worktree agents that each open a PR. Use for sweeping, mechanical changes (migrations, refactors, bulk renames) that decompose into independent units.',
  },
  {
    name: 'loop',
    invocation: '/loop',
    description:
      'Run a prompt on a fixed interval or dynamically reschedule it, including bare maintenance-mode loops. Use to poll for status, babysit a workflow, or keep re-running a prompt within the current session.',
  },
  {
    name: 'simplify',
    invocation: '/simplify',
    description:
      'Review changed code for reuse, quality, and efficiency, then fix any issues found.',
  },
  {
    name: 'ultracode',
    invocation: '/ultracode',
    description:
      'Multi-agent workflow orchestration: when to use the Workflow tool, script primitives, quality patterns (finder/verifier, judge panels), determinism constraints, resume, and budgets. Use when a task can be decomposed or parallelized, needs multi-perspective confidence, or exceeds a single context.',
  },
  {
    name: 'debug',
    invocation: '/debug',
    description:
      'Enable debug logging for this session and help diagnose issues.',
  },
  {
    name: 'dream',
    invocation: '/dream',
    description:
      'Manually trigger memory consolidation — review, organize, and prune your auto-memory files.',
  },
  {
    name: 'remember',
    invocation: '/remember',
    description:
      'Review auto-memory entries and propose promotions to GAKRCLI.md, gakrcli.local.md, or shared memory. Also detects outdated, conflicting, and duplicate entries across memory layers.',
  },
  {
    name: 'update-config',
    invocation: '/update-config',
    description:
      'Configure the harness via settings.json: permissions, env vars, hooks, and automated behaviors ("from now on when X…").',
  },
  {
    name: 'keybindings-help',
    invocation: '/keybindings-help',
    description:
      'Customize keyboard shortcuts: rebind keys, add chord bindings, or modify your keybindings file (default: ~/.gakrcli/keybindings.json; override via GAKR_CONFIG_DIR).',
  },
  {
    name: 'skillify',
    invocation: '/skillify',
    description:
      "Capture this session's repeatable process into a skill. Call at the end of the process you want to capture, with an optional description — the agent writes the skill file for you.",
  },
  {
    name: 'verify',
    invocation: '/verify',
    description:
      'Verify a code change does what it should by actually running the app, not just the tests.',
  },
  {
    name: 'stuck',
    invocation: '/stuck',
    description:
      'Investigate frozen/stuck/slow GakrCLI sessions on this machine and report local diagnostics.',
  },
  {
    name: 'schedule',
    invocation: '/schedule',
    description:
      'Create, update, list, or run scheduled remote agents (triggers) that execute on a cron schedule.',
  },
  {
    name: 'cron-list',
    invocation: '/cron-list',
    description: 'List all scheduled cron jobs in this session.',
  },
  {
    name: 'cron-delete',
    invocation: '/cron-delete',
    description: 'Cancel a scheduled cron job by ID.',
  },
  {
    name: 'pdf',
    invocation: '/pdf',
    description:
      'Generate PDF documents from structured content. Create reports, formatted documents, tables, and more.',
  },
  {
    name: 'gakrcli-api',
    invocation: '/gakrcli-api',
    description:
      'Build apps with the GakrCLI SDK: embedding the agent engine in a Node.js service, IDE integration, or automation worker.',
  },
  {
    name: 'gakrcli-in-chrome',
    invocation: '/gakrcli-in-chrome',
    description:
      'Automate your existing Chrome browser session — open pages in new tabs, click, fill forms, capture screenshots, and read console logs. Requires the GakrCLI Chrome extension with site-level permissions.',
  },
  {
    name: 'use-artifacts',
    invocation: '/use-artifacts',
    description:
      'Teach the agent when and how to use the artifact tool: living progress documents and deliverable HTML reports, including the deferred-tool invocation flow.',
  },
]
