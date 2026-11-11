import { COLORS, LEVELS } from './config';
import { icon, ICONS, rrect, text } from './draw';
import { btn, burst, drawParticles, Game, inp } from './ui';

const VW = 1440, VH = 900;
const SAVE_KEY = 'dropithmetic';
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let unlocked = 1;
try { unlocked = Math.max(1, Math.min(LEVELS, JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}').unlocked ?? 1)); } catch { /* bad save: start fresh */ }
const save = () => localStorage.setItem(SAVE_KEY, JSON.stringify({ unlocked }));

let game: Game | null = null;
let ended = false;

// Stats of all games in this page load, memory only. Run getStats() in the console.
// It returns compact JSON and tries to copy it to the clipboard.
const played: ReturnType<Game['report']>[] = [];
(window as unknown as { getStats: () => string }).getStats = () => {
  const json = JSON.stringify(game && !ended ? [...played, game.report('running')] : played);
  navigator.clipboard.writeText(json).then(
    () => console.log('getStats: copied to clipboard'),
    // Chrome rejects the write when the focus is in DevTools, not on the page.
    () => console.log('getStats: clipboard write failed. Run copy(getStats()) instead.'),
  );
  return json;
};
function quit() {
  if (game && !ended) played.push(game.report('quit'));
  game = null;
}

// ---- Scaling: one virtual 1440 x 900 screen, letterboxed into the window ----
let scale = 1, ox = 0, oy = 0, dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  scale = Math.min(innerWidth / VW, innerHeight / VH);
  ox = (innerWidth - VW * scale) / 2;
  oy = (innerHeight - VH * scale) / 2;
}
addEventListener('resize', resize);
resize();

const toVirtual = (e: PointerEvent) => { inp.x = (e.clientX - ox) / scale; inp.y = (e.clientY - oy) / scale; };
canvas.addEventListener('pointermove', toVirtual);
canvas.addEventListener('pointerdown', (e) => { toVirtual(e); inp.down = true; inp.downX = inp.x; inp.downY = inp.y; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', (e) => { toVirtual(e); inp.down = false; inp.released = true; });
canvas.addEventListener('pointercancel', () => { inp.down = false; inp.downX = inp.downY = -1; });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (game?.open) game.leave(); else quit(); return; }
  inp.keys.push(e.key);
  if (e.key === 'Backspace' || e.key === 'Enter' || e.key === ' ') e.preventDefault();
});

function button(label: string, x: number, y: number, w: number, h: number, color: string, shade: string) {
  const b = btn(x, y, w, h);
  if (!b.pressed) rrect(ctx, x, y + 4, w, h, 16, shade);
  rrect(ctx, x, y + (b.pressed ? 4 : 0), w, h, 16, b.hover ? color + 'DD' : color);
  text(ctx, label, x + w / 2, y + h / 2 + (b.pressed ? 4 : 0) + 1, 26, '#FFFFFF');
  if (b.clicked) burst(inp.x, inp.y, color, 12);
  return b.clicked;
}

function start(level: number) {
  quit();
  game = new Game(level);
  ended = false;
}

// public/logo.svg: Fredoka glyphs as outlines, so the page does not load the font. 1 em = 100 px at natural size.
const logo = new Image();
logo.src = 'logo.svg'; // relative: the Pages build lives under /dropithmetic/

function drawMenu() {
  const w = logo.width * 0.88, h = logo.height * 0.88; // 88 px font size
  ctx.drawImage(logo, (VW - w) / 2, 160 - 162 * 0.88, w, h); // baseline at y 160, the SVG top is 1.62 em above it
  text(ctx, 'Wybierz poziom', VW / 2, 250, 32, '#5A6478', 'center', 600);
  for (let i = 0; i < LEVELS; i++) {
    const lvl = i + 1, x = 160 + (i % 5) * 230, y = 320 + Math.floor(i / 5) * 230;
    const open = lvl <= unlocked;
    const b = btn(x, y, 200, 190);
    const lift = open && b.hover ? -3 : 0;
    rrect(ctx, x, y + 6, 200, 190, 24, COLORS.shadow);
    rrect(ctx, x, y + lift, 200, 190, 24, open ? '#FFFFFF' : '#F1F4F9');
    if (open) {
      text(ctx, String(lvl), x + 100, y + 85 + lift, 80, lvl < unlocked ? COLORS.player : COLORS.ink);
      text(ctx, lvl < unlocked ? 'Wygrany' : 'Graj', x + 100, y + 150 + lift, 22, lvl < unlocked ? COLORS.green : '#5A6478', 'center', 600);
      if (b.clicked) start(lvl);
    } else {
      icon(ctx, ICONS.lock, x + 100, y + 80, 56, '#B3BCCB', 2.6);
      text(ctx, String(lvl), x + 100, y + 150, 26, '#B3BCCB');
    }
  }
}

function drawEnd(g: Game) {
  const won = g.sim.winner === 0;
  if (!ended) {
    ended = true;
    played.push(g.report(won ? 'won' : 'lost'));
    if (won && g.level >= unlocked && unlocked < LEVELS) { unlocked = g.level + 1; save(); }
  }
  ctx.fillStyle = 'rgba(30, 42, 68, 0.45)';
  ctx.fillRect(0, 0, VW, VH);
  const x = 440, y = 260, w = 560, h = 360;
  rrect(ctx, x, y + 8, w, h, 28, COLORS.shadow);
  rrect(ctx, x, y, w, h, 28, '#FFFFFF');
  text(ctx, won ? 'Wygrana!' : 'Przegrana', VW / 2, y + 80, 64, won ? COLORS.green : COLORS.red);
  text(ctx, `Poziom ${g.level}`, VW / 2, y + 140, 26, '#5A6478', 'center', 600);
  let by = y + 190;
  if (won && g.level < LEVELS) {
    if (button('Następny poziom', x + 80, by, w - 160, 60, COLORS.green, '#1F5E3B')) return start(g.level + 1);
    by += 80;
  }
  if (button('Jeszcze raz', x + 80, by, (w - 180) / 2, 60, COLORS.player, '#2B4FA8')) return start(g.level);
  if (button('Menu', x + 100 + (w - 180) / 2, by, (w - 180) / 2, 60, '#7D879B', '#5A6478')) quit();
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  inp.hoverAny = false;

  if (game) {
    const g = game;
    if (g.sim.winner === null) g.update(dt);
    else inp.keys.length = 0;
    g.draw(ctx, now);
    if (g.sim.winner === null && !g.open && button('Menu', 1296, 828, 120, 48, '#7D879B', '#5A6478')) quit();
    if (g.sim.winner !== null) drawEnd(g);
  } else drawMenu();

  drawParticles(ctx, dt);
  canvas.style.cursor = inp.hoverAny ? 'pointer' : 'default';
  inp.released = false;
  if (!inp.down) inp.downX = inp.downY = -1;
  inp.keys.length = 0;
  requestAnimationFrame(frame);
}

// Wait for the font (max 2 s), so canvas text does not draw with the fallback font.
// The sample text makes the browser also load the latin-ext file with the Polish letters.
const PL = 'AaĄąĆćĘęŁłŃńÓóŚśŹźŻż×−';
const fonts = [600, 700].map((w) => document.fonts.load(`${w} 20px Nunito`, PL));
Promise.race([Promise.all([...fonts, logo.decode()]), new Promise((r) => setTimeout(r, 2000))]).then(() =>
  requestAnimationFrame((t) => { last = t; frame(t); }),
);
