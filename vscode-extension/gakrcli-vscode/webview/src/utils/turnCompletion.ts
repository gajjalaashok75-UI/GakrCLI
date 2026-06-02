const TURN_COMPLETION_VERBS = [
  'Baked',
  'Brewed',
  'Churned',
  'Cogitated',
  'Cooked',
  'Crunched',
  'Sauteed',
  'Worked',
] as const;

export function formatTurnCompletion(durationMs: number, seed: string): string | null {
  if (durationMs <= 0) {
    return null;
  }
  return `${selectTurnCompletionVerb(seed)} for ${formatDuration(durationMs)}`;
}

function selectTurnCompletionVerb(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return TURN_COMPLETION_VERBS[hash % TURN_COMPLETION_VERBS.length] ?? 'Worked';
}

function formatDuration(ms: number): string {
  if (ms < 60_000) {
    if (ms === 0) return '0s';
    if (ms < 1_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 1000)}s`;
  }

  let days = Math.floor(ms / 86_400_000);
  let hours = Math.floor((ms % 86_400_000) / 3_600_000);
  let minutes = Math.floor((ms % 3_600_000) / 60_000);
  let seconds = Math.round((ms % 60_000) / 1000);

  if (seconds === 60) {
    seconds = 0;
    minutes++;
  }
  if (minutes === 60) {
    minutes = 0;
    hours++;
  }
  if (hours === 24) {
    hours = 0;
    days++;
  }

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
