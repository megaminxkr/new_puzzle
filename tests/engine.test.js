import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, solvedState, rotate, applyMoves, inverse, createScramble, isSolved, matchedCount, restoreSession, encodeSession } from '../engine.js';

function seeded(seed) { let x = seed; return n => { x = (Math.imul(1664525, x) + 1013904223) >>> 0; return Math.floor(x / 2 ** 32 * n); }; }
const solved = solvedState();
test('clockwise A agrees with independently specified slot mapping', () => {
  const next = rotate(solved, 0, 1);
  assert.deepEqual(next.map(p => p.id), [8, 4, 0, 3, 9, 5, 1, 7, 10, 6, 2, 11, 12, 13, 14, 15]);
  assert.equal(next[5].orientation, 1); // stationary center also turns
  assert.equal(next[15].orientation, 0);
  assert.deepEqual(solved, solvedState()); // no input mutation
});
test('each generator has order 4 and both inverse directions cancel', () => {
  for (let r = 0; r < 4; r++) for (const d of [-1, 1]) {
    assert.deepEqual(applyMoves(solved, Array.from({length: 4}, () => [r, d])), solved);
    assert.deepEqual(rotate(rotate(solved, r, d), r, -d), solved);
    assert.ok(!isSolved(rotate(rotate(solved, r, d), r, d)));
  }
});
test('only selected 3x3 changes, and positions preserve checkerboard class', () => {
  for (let r = 0; r < 4; r++) {
    const {row, col} = REGIONS[r];
    const next = rotate(solved, r, 1);
    next.forEach((p, i) => {
      assert.equal((Math.floor(p.id / 4) + p.id % 4) % 2, (Math.floor(i / 4) + i % 4) % 2);
      if (Math.floor(i / 4) < row || Math.floor(i / 4) > row + 2 || i % 4 < col || i % 4 > col + 2) assert.deepEqual(p, solved[i]);
    });
  }
});
test('overlapping generators do not commute', () => {
  assert.notDeepEqual(applyMoves(solved, [[0, 1], [1, 1]]), applyMoves(solved, [[1, 1], [0, 1]]));
  assert.ok(!isSolved(applyMoves(solved, [[0,1],[1,1],[0,-1],[1,-1]])));
});
test('1000 deterministic scrambles are reachable, reversible and nontrivial', () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const moves = createScramble(seeded(seed));
    assert.ok(moves.length >= 48 && moves.length <= 49);
    for (let i = 1; i < moves.length; i++) assert.notEqual(moves[i][0], moves[i-1][0]);
    const state = applyMoves(solved, moves);
    assert.ok(!isSolved(state));
    assert.equal(new Set(state.map(p => p.id)).size, 16);
    assert.ok(state.every(p => p.orientation >= 0 && p.orientation < 4));
    assert.deepEqual(applyMoves(state, inverse(moves)), solved);
  }
});
test('10,000 mixed turns preserve pieces; full inverse restores all orientations', () => {
  const pick = seeded(9207);
  const moves = Array.from({ length: 10000 }, () => [pick(4), pick(2) ? 1 : -1]);
  const state = applyMoves(solved, moves);
  assert.equal(new Set(state.map(p => p.id)).size, 16);
  assert.deepEqual(applyMoves(state, inverse(moves)), solved);
});
test('completion requires exact identity and orientation, not color alone', () => {
  assert.equal(matchedCount(solved), 16);
  const turned = solvedState(); turned[0].orientation = 1;
  assert.equal(isSolved(turned), false);
  assert.equal(matchedCount(turned), 15);
  const swapped = solvedState(); [swapped[0],swapped[1]] = [swapped[1],swapped[0]];
  assert.equal(isSolved(swapped), false);
});
test('session replay preserves state, undo and solved saves', () => {
  const scramble = createScramble(seeded(31));
  const history = [[1, 1], [3, -1], [0, 1]];
  const loaded = restoreSession(encodeSession(scramble, history));
  assert.deepEqual(loaded.state, applyMoves(applyMoves(solved, scramble), history));
  assert.deepEqual(rotate(loaded.state, 0, -1), applyMoves(applyMoves(solved, scramble), history.slice(0, -1)));
  assert.ok(isSolved(restoreSession(encodeSession(scramble, inverse(scramble))).state));
});
test('malformed and oversized storage safely resets', () => {
  for (const raw of [null, '', 'not-json', '{}', 'null', '[]', '{"version":2}', 'x'.repeat(250001),
    JSON.stringify({version:1,scramble:[],history:[]}),
    JSON.stringify({version:1,scramble:[[4,1]],history:[]}),
    JSON.stringify({version:1,scramble:[[0,1]],history:[[1,0]]}),
    JSON.stringify({version:1,scramble:[[0,1]],history:[[1.5,1]]}),
    JSON.stringify({version:1,scramble:[[0,1]],history:Array(20001).fill([0,1])}),
  ]) assert.equal(restoreSession(raw), null);
});
test('invalid turns rejected instead of corrupting state', () => {
  for (const move of [[-1,1],[4,1],[1,0],[0,2],[0,'1'],[NaN,1]]) assert.throws(() => rotate(solved,...move), RangeError);
});
