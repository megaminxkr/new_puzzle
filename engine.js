// A state is an array of { id, orientation } in row-major slot order.
export const REGIONS = Object.freeze([
  Object.freeze({ name: 'A', row: 0, col: 0, label: '左上' }),
  Object.freeze({ name: 'B', row: 0, col: 1, label: '右上' }),
  Object.freeze({ name: 'C', row: 1, col: 0, label: '左下' }),
  Object.freeze({ name: 'D', row: 1, col: 1, label: '右下' }),
]);
export const solvedState = () => Array.from({ length: 16 }, (_, id) => ({ id, orientation: 0 }));
export const isMove = m => Array.isArray(m) && m.length === 2 && Number.isInteger(m[0]) && m[0] >= 0 && m[0] < 4 && (m[1] === 1 || m[1] === -1);
export function rotate(state, region, direction) {
  if (!isMove([region, direction])) throw new RangeError('Invalid move');
  const { row, col } = REGIONS[region];
  const next = state.map(piece => ({ ...piece }));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const source = (row + r) * 4 + col + c;
    const nr = direction === 1 ? c : 2 - c;
    const nc = direction === 1 ? 2 - r : r;
    next[(row + nr) * 4 + col + nc] = {
      id: state[source].id,
      orientation: (state[source].orientation + direction + 4) % 4,
    };
  }
  return next;
}
export const applyMoves = (state, moves) => moves.reduce((s, [r, d]) => rotate(s, r, d), state);
export const inverse = moves => moves.toReversed().map(([r, d]) => [r, -d]);
export const matchedCount = state => state.filter((p, i) => p.id === i && p.orientation === 0).length;
export const isSolved = state => matchedCount(state) === 16;
function randomIndex(n) {
  const value = new Uint32Array(1);
  const limit = 0x100000000 - (0x100000000 % n);
  do { globalThis.crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % n;
}
export function createScramble(pick = randomIndex) {
  const moves = [];
  let previous = -1;
  for (let i = 0; i < 48; i++) {
    const choices = [0, 1, 2, 3].filter(r => r !== previous);
    const region = choices[pick(choices.length)];
    moves.push([region, pick(2) ? 1 : -1]);
    previous = region;
  }
  // A random walk is reachable by construction, but is not a uniform sample.
  // In the rare solved result, add one legal turn instead of retrying forever.
  if (isSolved(applyMoves(solvedState(), moves))) moves.push([(previous + 1) % 4, 1]);
  return moves;
}
export function restoreSession(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 250000) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.scramble) ||
        data.scramble.length < 1 || data.scramble.length > 64 ||
        !Array.isArray(data.history) || data.history.length > 20000 ||
        !data.scramble.every(isMove) || !data.history.every(isMove)) return null;
    return {
      scramble: data.scramble,
      history: data.history,
      state: applyMoves(applyMoves(solvedState(), data.scramble), data.history),
    };
  } catch { return null; }
}
export const encodeSession = (scramble, history) => JSON.stringify({ version: 1, scramble, history });
