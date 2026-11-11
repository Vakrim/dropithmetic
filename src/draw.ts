import { CFG, COLORS, H, Kind, MONK, Side, W } from './config';
import { PEG_R, PEGS, POLYS, Sim, ZONE_BOT, ZONE_TOP } from './sim';

export const FONT = 'Nunito, sans-serif';
export const SIDE_COLOR = [COLORS.player, COLORS.enemy];

// 24x24 icon paths from the mock
export const ICONS = {
  soldier: 'M4 21V9h5V4h6v5h5v12M10 21v-5h4v5',
  archer: 'M7 21V8H5V3h3v2h2V3h4v2h2V3h3v5h-2v13zM10 21v-4h4v4',
  monk: 'M3 21V10l9-6 9 6v11M12 10v8M9 13h6',
  siege: 'M3 21V11l6 3v-3l6 3V5h4v16zM7 17h2M13 17h2',
  heart: 'M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z',
  target: 'M12 3a9 9 0 1 0 0.01 0zM12 8a4 4 0 1 0 0.01 0zM12 11.5v1',
  heal: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 9v6M9 12h6',
  sword: 'M14 4h6v6L9 21l-6-6zM5 13l6 6M3 21l3-3',
  star: 'M12 2l3 7h7l-5.5 4.5 2 7.5L12 16.5 5.5 21l2-7.5L2 9h7z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  back: 'M9 5h11v14H9l-6-7zM12 9l5 6M17 9l-5 6',
  check: 'M4 12l5 5L20 6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  castle: 'M6 50 V18 H20 V8 H34 V18 H46 V4 H86 V18 H98 V8 H112 V18 H126 V50 Z',
};
const paths = new Map<string, Path2D>();
const p2d = (d: string) => paths.get(d) ?? paths.set(d, new Path2D(d)).get(d)!;

export function icon(ctx: CanvasRenderingContext2D, d: string, x: number, y: number, size: number, stroke: string, lw = 2.4, fill?: string) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (fill) { ctx.fillStyle = fill; ctx.fill(p2d(d)); }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke(p2d(d));
  ctx.restore();
}

export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 4) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

export function coin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.coin;
  ctx.fill();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = r / 5;
  ctx.stroke();
}

export function unitBall(ctx: CanvasRenderingContext2D, kind: Kind, side: Side, x: number, y: number, r: number, flash = 0) {
  const c = SIDE_COLOR[side];
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = flash > 0 ? '#FFFFFF' : kind === 'monk' ? '#FFFFFF' : c;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
  ctx.fillStyle = kind === 'monk' ? c : '#FFFFFF';
  if (kind === 'archer') { ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, Math.PI * 2); ctx.fill(); }
  if (kind === 'monk') { const s = r * 0.22; ctx.fillRect(x - s / 2, y - s * 2, s, s * 4); ctx.fillRect(x - s * 2, y - s / 2, s * 4, s); }
  if (kind === 'siege') { ctx.fillStyle = COLORS.ink; ctx.fillRect(x - r * 0.4, y - r * 0.4, r * 0.8, r * 0.8); }
}

const BOARD_X = 24, BOARD_Y = 20;
export const BOARD = { x: BOARD_X, y: BOARD_Y, w: W, h: H };

export function drawBoard(ctx: CanvasRenderingContext2D, sim: Sim) {
  ctx.save();
  rrect(ctx, BOARD_X, BOARD_Y + 6, W, H, 24, COLORS.shadow);
  ctx.translate(BOARD_X, BOARD_Y);
  rrect(ctx, 0, 0, W, H, 24, '#FFFFFF');
  ctx.clip();

  // Castles and zones
  const zoneFill = [['#F4F6FA', '#E6ECF7', '#D2DDF3'], ['#FAF2EC', '#F6E5DA', '#F0D3C0']];
  for (const side of [0, 1] as Side[]) {
    const zy = side === 0 ? ZONE_TOP[0] : ZONE_BOT[0];
    ctx.fillStyle = SIDE_COLOR[side] + '22';
    ctx.fillRect(0, side === 0 ? 0 : ZONE_BOT[1], W, 60);
    CFG.zoneMult.forEach((m, i) => {
      ctx.fillStyle = zoneFill[side][[0, 1, 2, 1, 0][i]];
      ctx.fillRect(i * 120, zy, 120, 36);
      text(ctx, `×${m}`, i * 120 + 60, zy + 19, m === 4 ? 20 : 18, m === 4 ? COLORS.ink : '#5A6478', 'center', m === 4 ? 700 : 600);
    });
    ctx.save();
    ctx.translate(234, side === 0 ? 6 : H - 6);
    if (side === 1) ctx.scale(1, -1);
    ctx.fillStyle = SIDE_COLOR[side];
    ctx.fill(p2d(ICONS.castle));
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineJoin = 'round';
    ctx.stroke(p2d(ICONS.castle));
    rrect(ctx, 56, 30, 20, 20, 10, COLORS.ink);
    ctx.restore();
  }

  // Static geometry
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = '#E3E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  POLYS.forEach((p, i) => {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let j = 2; j < p.length; j += 2) ctx.lineTo(p[j], p[j + 1]);
    if (i === 6) { ctx.fillStyle = '#F1F4F9'; ctx.fill(); }
    const sep = i > 6;
    ctx.strokeStyle = sep ? (p[1] < H / 2 ? '#2B4FA8' : '#A8512B') : COLORS.line;
    ctx.lineWidth = 6;
    ctx.stroke();
  });
  ctx.fillStyle = COLORS.peg;
  for (const p of PEGS) { ctx.beginPath(); ctx.arc(p.x, p.y, PEG_R, 0, Math.PI * 2); ctx.fill(); }

  // Belts and buildings
  for (const side of [0, 1] as Side[]) drawBelt(ctx, sim, side);

  // Monk aura under the units
  for (const u of sim.units) if (u.kind === 'monk') {
    ctx.beginPath();
    ctx.arc(u.x, u.y, MONK.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#2E8B5714';
    ctx.fill();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = '#2E8B5766';
    ctx.lineWidth = 2;
    ctx.lineDashOffset = -sim.time * 20;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Units
  for (const u of sim.units) {
    ctx.beginPath();
    ctx.arc(u.x - u.vx * 0.035, u.y - u.vy * 0.035, u.r - 2, 0, Math.PI * 2);
    ctx.fillStyle = SIDE_COLOR[u.side] + '44';
    ctx.fill();
  }
  for (const u of sim.units) {
    unitBall(ctx, u.kind, u.side, u.x, u.y, u.r, u.flash);
    if (u.hp < u.maxHp) {
      rrect(ctx, u.x - 12, u.y - u.r - 9, 24, 5, 2.5, '#D3D9E4');
      rrect(ctx, u.x - 12, u.y - u.r - 9, 24 * Math.max(0, u.hp / u.maxHp), 5, 2.5, u.hp / u.maxHp > 0.4 ? COLORS.green : COLORS.red);
    }
  }

  // Effects
  for (const f of sim.fx) {
    const t = f.t;
    ctx.globalAlpha = Math.max(0, 1 - t);
    if (f.type === 'arrow') {
      const k = Math.min(1, t * 6), hx = f.x + (f.x2 - f.x) * k, hy = f.y + (f.y2 - f.y) * k;
      ctx.strokeStyle = SIDE_COLOR[f.side];
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(f.x + (hx - f.x) * 0.5, f.y + (hy - f.y) * 0.5); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath(); ctx.arc(hx, hy, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (f.type === 'spark') {
      const s = 26 + t * 30;
      icon(ctx, ICONS.star, f.x, f.y, s, COLORS.ink, 1.6, '#FFD84D');
    } else if (f.type === 'text') {
      text(ctx, f.text, f.x, f.y - t * 30, 18, f.color);
    } else {
      const y = f.side === 1 ? ZONE_BOT[0] + 18 : ZONE_TOP[0] + 18;
      ctx.font = `700 20px ${FONT}`;
      const w = ctx.measureText(f.text).width + 20;
      rrect(ctx, f.x - w / 2, y - 14 - (f.side === 1 ? t * 20 : -t * 20), w, 28, 10, COLORS.ink);
      text(ctx, f.text, f.x, y - (f.side === 1 ? t * 20 : -t * 20), 20, '#FFFFFF');
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBelt(ctx: CanvasRenderingContext2D, sim: Sim, side: Side) {
  const y = side === 0 ? 120 : 718, x0 = CFG.beltX, L = CFG.beltLen, dir = side === 0 ? 1 : -1;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y, L, 22, 11);
  ctx.fillStyle = '#C9D0DC';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#B3BCCB';
  const off = (((dir * sim.time * CFG.beltSpeed) % 20) + 20) % 20;
  for (let x = x0 - 20 + off; x < x0 + L; x += 20) ctx.fillRect(x, y, 10, 22);
  ctx.restore();
  rrect(ctx, x0, y, L, 22, 11, undefined, '#8F99AC', 4);
  // Arrow that shows the belt direction
  const ax = side === 0 ? x0 + L + 14 : x0 - 14;
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(ax - dir * 10, y + 11); ctx.lineTo(ax + dir * 10, y + 11);
  ctx.moveTo(ax + dir * 3, y + 4); ctx.lineTo(ax + dir * 10, y + 11); ctx.lineTo(ax + dir * 3, y + 18);
  ctx.stroke();

  // Buildings wrap from one end of the belt to the other.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - 4, 0, L + 8, H);
  ctx.clip();
  for (const b of sim.sides[side].buildings)
    for (const sx of [b.s - L, b.s, b.s + L]) {
      const cx = x0 + sx;
      if (cx < x0 - 30 || cx > x0 + L + 30) continue;
      const by = y + 11 + (side === 0 ? -7 : 7); // building center, a bit toward its castle
      rrect(ctx, cx - 26, by - 24, 52, 48, 12, SIDE_COLOR[side], COLORS.ink, 4);
      icon(ctx, ICONS[b.kind], cx, by, 26, '#FFFFFF', 2.4);
      const py = side === 0 ? by + 30 : by - 36;
      rrect(ctx, cx - 22, py, 44, 6, 3, '#D3D9E4');
      rrect(ctx, cx - 22, py, 44 * b.t, 6, 3, COLORS.ink);
    }
  ctx.restore();
}
