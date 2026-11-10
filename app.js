import { REGIONS, solvedState, rotate, applyMoves, createScramble, isSolved, restoreSession, encodeSession } from './engine.js';

const $ = selector => document.querySelector(selector);
const board = $('#board');
const colors = ['var(--blue)', 'var(--pink)', 'var(--gold)', 'var(--green)'];
const colorNames = ['青・丸', '桃・三角', '黄・ひし形', '緑・四角'];
const shapes = ['●', '▲', '◆', '■'];
const directions = ['上', '右', '下', '左'];
const storageKey = 'kasane.session.v1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let state, scramble, history, selected = 0, busy = false, storageAvailable = true;
let restored = null;
try { restored = restoreSession(localStorage.getItem(storageKey)); } catch { storageAvailable = false; }
if (restored) ({ state, scramble, history } = restored);
else { scramble = createScramble(); history = []; state = applyMoves(solvedState(), scramble); }

function makeSurface(id) {
  const surface = document.createElement('div');
  surface.className = 'tile-surface';
  surface.style.setProperty('--tile-color', colors[Math.floor(id / 4)]);
  const number = document.createElement('span');
  number.className = 'tile-number';
  number.textContent = id % 4 + 1;
  const shape = document.createElement('span');
  shape.className = 'tile-shape';
  shape.textContent = shapes[Math.floor(id / 4)];
  const arrow = document.createElement('span');
  arrow.className = 'tile-arrow';
  surface.append(number, shape, arrow);
  surface.setAttribute('aria-hidden', 'true');
  return surface;
}
const tiles = Array.from({ length: 16 }, (_, id) => {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.setAttribute('role', 'img');
  tile.append(makeSurface(id));
  board.append(tile);
  $('#goal-board').append(makeSurface(id));
  return tile;
});

function persist() {
  try {
    if (history.length > 20000) throw new Error('Session too long');
    localStorage.setItem(storageKey, encodeSession(scramble, history));
    storageAvailable = true;
  } catch { storageAvailable = false; }
  $('#save-note').textContent = storageAvailable
    ? 'このブラウザに進行状況を自動保存'
    : '自動保存を利用できません。このページを開いたまま遊んでください。';
}

function updateControls() {
  for (const button of document.querySelectorAll('.turn-controls button, #region-controls button, #scramble')) button.disabled = busy;
  $('#undo').disabled = busy || history.length === 0;
  board.setAttribute('aria-busy', String(busy));
}

function render(message) {
  state.forEach((piece, slot) => {
    const tile = tiles[piece.id];
    tile.style.transform = `translate(${slot % 4 * 100}%, ${Math.floor(slot / 4) * 100}%)`;
    tile.querySelector('.tile-arrow').style.transform = `rotate(${piece.orientation * 90}deg)`;
    tile.setAttribute('aria-label', `${Math.floor(slot / 4) + 1}行${slot % 4 + 1}列、${colorNames[Math.floor(piece.id / 4)]}の${piece.id % 4 + 1}、印は${directions[piece.orientation]}向き`);
  });
  const solved = isSolved(state);
  $('.puzzle').classList.toggle('solved', solved);
  $('#move-count').textContent = history.length;
  $('#status').textContent = solved ? '完成。すべてが揃いました。' : message || (history.length ? '位置と向きを、元の秩序へ。' : 'スクランブル済み · さあ、ほどこう');
  updateControls();
}

function selectRegion(region) {
  selected = region;
  const { row, col, name, label } = REGIONS[region];
  for (const button of document.querySelectorAll('[data-region]')) button.setAttribute('aria-pressed', String(Number(button.dataset.region) === region));
  $('#region-outline').style.transform = `translate(${col * 100 / 3}%, ${row * 100 / 3}%)`;
  $('#region-outline span').textContent = name;
  $('#selected-name').textContent = `${name} · ${label}の3×3`;
}

async function play(region, direction, undo = false) {
  if (busy) return;
  busy = true;
  const before = state;
  state = rotate(state, region, direction);
  if (undo) history.pop(); else history.push([region, direction]);
  selectRegion(region);
  render();
  persist();
  try {
    if (!reducedMotion.matches) {
      const { row, col } = REGIONS[region];
      const animations = [];
      before.forEach((piece, slot) => {
        const r = Math.floor(slot / 4), c = slot % 4;
        if (r < row || r > row + 2 || c < col || c > col + 2) return;
        const cx = col + 1, cy = row + 1, dx = c - cx, dy = r - cy;
        const frames = Array.from({ length: 9 }, (_, i) => {
          const angle = direction * Math.PI / 2 * i / 8;
          const x = cx + dx * Math.cos(angle) - dy * Math.sin(angle);
          const y = cy + dx * Math.sin(angle) + dy * Math.cos(angle);
          return { transform: `translate(${x * 100}%, ${y * 100}%)` };
        });
        const tile = tiles[piece.id];
        tile.style.zIndex = '1';
        animations.push(tile.animate(frames, { duration: 240, easing: 'ease-in-out' }));
        animations.push(tile.querySelector('.tile-arrow').animate([
          { transform: `rotate(${piece.orientation * 90}deg)` },
          { transform: `rotate(${(piece.orientation + direction) * 90}deg)` },
        ], { duration: 240, easing: 'ease-in-out' }));
      });
      await Promise.allSettled(animations.map(animation => animation.finished));
    }
  } finally {
    tiles.forEach(tile => tile.style.zIndex = '');
    busy = false;
    updateControls();
  }
}

function undo() {
  if (busy || !history.length) return;
  const [region, direction] = history.at(-1);
  void play(region, -direction, true);
}

function newPuzzle() {
  scramble = createScramble(); history = [];
  state = applyMoves(solvedState(), scramble);
  render(); persist();
}

for (const button of document.querySelectorAll('[data-region]')) button.addEventListener('click', () => selectRegion(Number(button.dataset.region)));
$('#turn-left').addEventListener('click', () => void play(selected, -1));
$('#turn-right').addEventListener('click', () => void play(selected, 1));
$('#undo').addEventListener('click', undo);
$('#scramble').addEventListener('click', () => {
  if (history.length && !isSolved(state)) $('#scramble-dialog').showModal();
  else newPuzzle();
});
$('#scramble-cancel').addEventListener('click', () => $('#scramble-dialog').close());
$('#scramble-confirm').addEventListener('click', () => { $('#scramble-dialog').close(); newPuzzle(); });
$('#help-open').addEventListener('click', () => $('#help-dialog').showModal());
for (const selector of ['#help-close', '#help-done']) $(selector).addEventListener('click', () => $('#help-dialog').close());
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || busy || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
  const key = event.key.toLowerCase();
  if (['a', 'b', 'c', 'd'].includes(key)) { event.preventDefault(); selectRegion(key.charCodeAt(0) - 97); }
  else if (key === 'arrowleft' || key === 'arrowright') { event.preventDefault(); void play(selected, key === 'arrowright' ? 1 : -1); }
  else if (key === 'z') { event.preventDefault(); undo(); }
});
render(restored && history.length ? '前回の続きから。' : undefined);
persist();
