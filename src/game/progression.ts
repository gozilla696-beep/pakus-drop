export type Progress = { level: number; xp: number; leveledUp: boolean };

export function xpNeeded(level: number) {
  return 500 + (level - 1) * 120;
}

export function nextProgress(level: number, xp: number, points: number): Progress {
  let nextLevel = level;
  let nextXp = xp + Math.max(0, Math.floor(points));
  let leveledUp = false;
  while (nextXp >= xpNeeded(nextLevel)) {
    nextXp -= xpNeeded(nextLevel);
    nextLevel += 1;
    leveledUp = true;
  }
  return { level: nextLevel, xp: nextXp, leveledUp };
}

export function stageForLevel(level: number) {
  return Math.floor((Math.max(1, level) - 1) / 10) + 1;
}

export function rankForLevel(level: number) {
  if (level >= 51) return 'PAKUS LEGEND';
  if (level >= 41) return 'NEON MASTER';
  if (level >= 31) return 'DIAMOND';
  if (level >= 21) return 'GOLD';
  if (level >= 11) return 'SILVER';
  return 'BRONZE';
}

export function fallDelayForLevel(level: number) {
  return Math.max(160, 820 - (level - 1) * 28);
}
