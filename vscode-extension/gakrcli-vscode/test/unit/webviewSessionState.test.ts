import { describe, expect, it } from 'vitest';
import type { GroupedSessionData, SessionData } from '../../webview/src/hooks/useSession';
import {
  removeDeletedSessionFromGroups,
  removeDeletedSessionFromList,
} from '../../webview/src/utils/sessionState';

const baseSession: Omit<SessionData, 'id' | 'title'> = {
  model: 'gpt-5.4',
  timestamp: '2026-05-27T10:00:00.000Z',
  createdAt: '2026-05-27T09:00:00.000Z',
  messageCount: 2,
  cwd: 'C:/repo',
  gitBranch: 'main',
};

function session(id: string, title = id): SessionData {
  return { ...baseSession, id, title };
}

describe('webview session state helpers', () => {
  it('removes deleted sessions from the flat session list', () => {
    expect(removeDeletedSessionFromList([session('one'), session('two')], 'one'))
      .toEqual([session('two')]);
  });

  it('removes deleted sessions from grouped history and drops empty groups', () => {
    const groups: GroupedSessionData[] = [
      { group: 'Today', sessions: [session('one'), session('two')] },
      { group: 'Older', sessions: [session('old')] },
    ];

    expect(removeDeletedSessionFromGroups(groups, 'old')).toEqual([
      { group: 'Today', sessions: [session('one'), session('two')] },
    ]);
  });
});
