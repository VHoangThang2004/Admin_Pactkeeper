import type { PlayerPresenceState } from '../types';

export type AstryxDotVariant = 'success' | 'warning' | 'error' | 'accent' | 'neutral';
export type AstryxBadgeColorVariant = 'green' | 'yellow' | 'blue' | 'red' | 'gray' | 'cyan';

export function getPresenceStatusDotVariant(
  presence?: PlayerPresenceState,
  isBanned?: boolean
): AstryxDotVariant {
  if (isBanned) return 'error';
  switch (presence) {
    case 'InBattle':
      return 'warning';
    case 'Online':
      return 'success';
    case 'Offline':
    default:
      return 'neutral';
  }
}

export function getPresenceBadgeVariant(
  presence?: PlayerPresenceState,
  isBanned?: boolean
): AstryxBadgeColorVariant {
  if (isBanned) return 'red';
  switch (presence) {
    case 'InBattle':
      return 'yellow';
    case 'Online':
      return 'green';
    case 'Offline':
    default:
      return 'gray';
  }
}

export function getPresenceDisplayLabel(
  presence?: PlayerPresenceState,
  isBanned?: boolean
): string {
  if (isBanned) return 'Banned';
  switch (presence) {
    case 'InBattle':
      return 'In Battle';
    case 'Online':
      return 'Online (Lobby)';
    case 'Offline':
    default:
      return 'Offline';
  }
}
