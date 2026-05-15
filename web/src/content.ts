export const installCommand = 'npm install -g @gakr-gakr/gakrcli'

export const features = [
  {
    title: 'terminal-first coding agent',
    body: 'gakrcli works inside your project folder, reads the code you point it at, edits files, runs checks, and keeps every change visible.',
  },
  {
    title: 'any model, one workflow',
    body: 'use openai-compatible apis, gemini, codex, ollama, lm studio, github models, or a gateway without changing how you work.',
  },
  {
    title: 'built for real development',
    body: 'ask it to fix bugs, explain code, update docs, run tests, inspect diffs, create commits, or coordinate focused agents for larger work.',
  },
  {
    title: 'purpose: ship safely',
    body: 'the goal is not just chat. it helps move from task to reviewed code with tool calls, validation, build checks, and traceable edits.',
  },
  {
    title: 'project-aware setup',
    body: 'profiles, rules, hooks, mcp servers, slash commands, and permissions let each repo define how the agent should behave.',
  },
  {
    title: 'editor and server modes',
    body: 'use it from the terminal, connect it to vs code, or run the grpc server so other tools can drive the same agent loop.',
  },
] as const

export const useCases = [
  {
    title: 'understand a repo',
    body: 'ask where features live, how flows connect, or what changed before touching code.',
  },
  {
    title: 'make focused changes',
    body: 'describe the bug or feature, review the plan, then let gakrcli edit and validate locally.',
  },
  {
    title: 'verify before shipping',
    body: 'run type checks, builds, tests, reviews, and git workflows from the same conversation.',
  },
] as const

export const navLinks = [
  { href: '#features', label: 'features' },
  { href: '#purpose', label: 'purpose' },
  { href: '#install', label: 'install' },
  { href: '/get-started', label: 'get started' },
  { href: '/providers', label: 'providers' },
  { href: '/commands', label: 'commands' },
  { href: 'https://github.com/gajjalaashok75-UI/GakrCLI', label: 'github' },
] as const
