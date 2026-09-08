export const ROWS = 18;
export const COLS = 10;

export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Board = Cell[][];
export type Shape = number[][];
export type SpecialKind = 'bomb' | 'pulse' | 'phase';
export type Piece = { shape: Shape; x: number; y: number; color: Cell; id: string; special?: SpecialKind };

const SHAPES: Record<string, Shape> = {
  I: [[1,1,1,1]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1]],
  S: [[0,1,1],[1,1,0]],
  Z: [[1,1,0],[0,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]],
};
const IDS = Object.keys(SHAPES);

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
}

export function randomPiece(): Piece {
  const id = IDS[Math.floor(Math.random() * IDS.length)];
  const shape = SHAPES[id].map(r => [...r]);
  const color = (1 + Math.floor(Math.random() * 7)) as Cell;
  return { id, shape, x: Math.floor((COLS - shape[0].length) / 2), y: -1, color };
}

export function rotate(shape: Shape): Shape {
  const h = shape.length;
  const w = shape[0].length;
  return Array.from({ length: w }, (_, x) => Array.from({ length: h }, (_, y) => shape[h - 1 - y][x]));
}

export function collides(board: Board, piece: Piece, dx = 0, dy = 0, shape: Shape = piece.shape) {
  for (let sy = 0; sy < shape.length; sy++) {
    for (let sx = 0; sx < shape[sy].length; sx++) {
      if (!shape[sy][sx]) continue;
      const x = piece.x + sx + dx;
      const y = piece.y + sy + dy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x] !== 0) return true;
    }
  }
  return false;
}

export function merge(board: Board, piece: Piece): Board {
  const next = board.map(r => [...r]) as Board;
  piece.shape.forEach((row, sy) => row.forEach((v, sx) => {
    if (!v) return;
    const y = piece.y + sy;
    const x = piece.x + sx;
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = piece.color;
  }));
  return next;
}

export function clearLines(board: Board): { board: Board; lines: number; clearedRows: number[] } {
  const clearedRows: number[] = [];
  board.forEach((row, y) => { if (row.every(v => v !== 0)) clearedRows.push(y); });
  const kept = board.filter((_, y) => !clearedRows.includes(y));
  const lines = clearedRows.length;
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(0) as Cell[]);
  return { board: kept as Board, lines, clearedRows };
}

export function addGlitchRow(board: Board): Board {
  const next = board.map(r => [...r]) as Board;
  next.shift();
  const gap = Math.floor(Math.random() * COLS);
  const row = Array.from({ length: COLS }, (_, x) => x === gap ? 0 : ((1 + Math.floor(Math.random() * 6)) as Cell)) as Cell[];
  next.push(row);
  return next;
}

export function hardDropY(board: Board, piece: Piece) {
  let dy = 0;
  while (!collides(board, piece, 0, dy + 1)) dy += 1;
  return piece.y + dy;
}

export function withGhost(board: Board, piece: Piece): Board {
  const next = board.map(r => [...r]) as Board;
  const gy = hardDropY(board, piece);
  piece.shape.forEach((row, sy) => row.forEach((v, sx) => {
    if (!v) return;
    const y = gy + sy;
    const x = piece.x + sx;
    if (y >= 0 && y < ROWS && next[y][x] === 0) next[y][x] = 7;
  }));
  return next;
}

export function blastBottom(board: Board): Board {
  const next = board.map(r => [...r]) as Board;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (next[y].some(v => v !== 0)) {
      next.splice(y, 1);
      next.unshift(Array(COLS).fill(0) as Cell[]);
      break;
    }
  }
  return next;
}

export function clearHighestColumn(board: Board): Board {
  const next = board.map(r => [...r]) as Board;
  let bestCol = 0;
  let bestHeight = -1;
  for (let x = 0; x < COLS; x++) {
    let height = 0;
    for (let y = 0; y < ROWS; y++) if (next[y][x] !== 0) { height = ROWS - y; break; }
    if (height > bestHeight) { bestHeight = height; bestCol = x; }
  }
  for (let y = 0; y < ROWS; y++) next[y][bestCol] = 0;
  return next;
}


export function specialBlast(board: Board, piece: Piece): Board {
  const next = board.map(r => [...r]) as Board;
  const occupied: Array<{x:number;y:number}> = [];
  piece.shape.forEach((row, sy) => row.forEach((v, sx) => {
    if (!v) return;
    const y = piece.y + sy;
    const x = piece.x + sx;
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) occupied.push({x, y});
  }));
  if (!occupied.length) return next;
  const cx = Math.round(occupied.reduce((a, c) => a + c.x, 0) / occupied.length);
  const cy = Math.round(occupied.reduce((a, c) => a + c.y, 0) / occupied.length);
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = 0;
    }
  }
  return next;
}

export function phaseCut(board: Board, piece: Piece): Board {
  const next = board.map(r => [...r]) as Board;
  const columns = new Set<number>();
  piece.shape.forEach((row, sy) => row.forEach((v, sx) => {
    if (!v) return;
    const x = piece.x + sx;
    if (x >= 0 && x < COLS) columns.add(x);
  }));
  columns.forEach(x => {
    for (let y = 0; y < ROWS; y++) {
      if (next[y][x] !== 0) { next[y][x] = 0; break; }
    }
  });
  return next;
}
