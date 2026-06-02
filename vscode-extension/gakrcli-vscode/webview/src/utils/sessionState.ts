import type { GroupedSessionData, SessionData } from '../hooks/useSession';

export function removeDeletedSessionFromList(
  sessions: SessionData[],
  sessionId: string,
): SessionData[] {
  return sessions.filter((session) => session.id !== sessionId);
}

export function removeDeletedSessionFromGroups(
  groups: GroupedSessionData[],
  sessionId: string,
): GroupedSessionData[] {
  return groups
    .map((group) => ({
      ...group,
      sessions: group.sessions.filter((session) => session.id !== sessionId),
    }))
    .filter((group) => group.sessions.length > 0);
}
