import type { Inventory } from '../store/products';

export function applyBooster(kind: keyof Inventory, score: number) {
  if (kind === 'blast') return { score: score + 750, message: 'PAKUS BLAST! Reihe gesprengt · +750' };
  if (kind === 'wildcard') return { score: score + 500, message: 'WILDCARD! Schwieriger Block ersetzt · +500' };
  return { score: score + 250, message: 'RESCUE! Game Over einmal abgefangen · +250' };
}
