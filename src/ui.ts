import { CFG, COLORS, DT, KINDS, QUIZ, Side, UNITS, WALL, WORKER } from './config';
import { BOARD, coin, drawBoard, FONT, icon, ICONS, rrect, SIDE_COLOR, text, unitBall } from './draw';
import { Quiz, tierOf } from './quiz';
import { buildingPrice, levelPrice, repairPrice, Sim, workerPrice } from './sim';

// ---- Input (virtual 1440 x 900 coordinates) ----
export const inp = { x: -1, y: -1, down: false, downX: -1, downY: -1, released: false, hoverAny: false, block: false, keys: [] as string[] };

export function btn(x: number, y: number, w: number, h: number) {
  if (inp.block) return { hover: false, pressed: false, clicked: false }; // behind the math modal
  const inside = (px: number, py: number) => px >= x && px <= x + w && py >= y && py <= y + h;
  const hover = inside(inp.x, inp.y);
  if (hover) inp.hoverAny = true;
  const started = inside(inp.downX, inp.downY);
  return { hover, pressed: inp.down && started && hover, clicked: inp.released && started && hover };
}

// ---- Particles (real time, only for looks) ----
interface P { x: number; y: number; vx: number; vy: number; t: number; life: number; r: number; color: string; tx?: number; ty?: number }
let parts: P[] = [];
export function burst(x: number, y: number, color: string, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random(), s = 120 + Math.random() * 160;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.35 + Math.random() * 0.2, r: 3 + Math.random() * 3, color });
  }
}
function coinFly(x: number, y: number, tx: number, ty: number, n: number) {
  for (let i = 0; i < n; i++)
    parts.push({ x, y, vx: (Math.random() - 0.5) * 500, vy: -200 - Math.random() * 300, t: -i * 0.04, life: 0.8, r: 9, color: 'coin', tx, ty });
}
export function drawParticles(ctx: CanvasRenderingContext2D, dt: number) {
  for (const p of parts) {
    p.t += dt;
    if (p.t < 0) continue;
    const k = p.t / p.life;
    if (p.tx !== undefined) {
      // Fly out, then home in on the target.
      p.vx *= 0.92; p.vy *= 0.92;
      p.x += p.vx * dt + (p.tx - p.x) * Math.min(1, k * k * 0.5);
      p.y += p.vy * dt + (p.ty! - p.y) * Math.min(1, k * k * 0.5);
      coin(ctx, p.x, p.y, p.r);
    } else {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  parts = parts.filter((p) => p.t < p.life);
}

// ---- Game screen ----
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
const COIN_POS = { x: 772, y: 384 };
// The modal reuses the panel coordinates (x 736, y 20), moved to the screen center.
const MODAL = { dx: 380 - 736, dy: 190 - 20 };
const POT_POS = { x: 776 + MODAL.dx, y: 400 + MODAL.dy };
const num1 = (n: number) => n.toFixed(1).replace('.', ',');

export class Game {
  sim: Sim;
  quiz = new Quiz();
  acc = 0;
  wrong: { answer: number; t: number } | null = null;
  okFlash = 0;
  gain = { v: 0, t: 0 };
  shownMoney = 0;
  open = false; // the math modal is open and the battle is paused
  quizIn = QUIZ.every; // battle seconds until the next round
  round = 0; // questions in this round, one for each collected task
  left = 0; // questions left in this round
  pot = 0; // coins won in this round, paid when the modal closes
  shownPot = 0;
  potGain = { v: 0, t: 0 };
  streak = 0; // length of the current or last series
  pop = 0; // combo pop animation
  solved = 0; // correct answers in this level, they give the passive income
  passiveEarned = 0;
  // Balancing stats for the questions, per tier
  qTime = 0;
  realTime = 0;
  maxCombo = 0;
  earned = 0;
  tiers = [0, 1, 2, 3, 4].map(() => ({ correct: 0, wrong: 0, time: 0 }));
  mistakes: { q: string; given: string; t: number }[] = [];

  constructor(public level: number) {
    this.sim = new Sim(level);
  }

  // The round starts by itself every QUIZ.every seconds if the workers collected tasks.
  private start() {
    const s = this.sim.sides[0];
    this.quizIn = QUIZ.every;
    if (s.tasks <= 0 || this.sim.winner !== null) return;
    this.open = true;
    this.round = this.left = s.tasks;
    s.tasks = 0;
    this.streak = this.quiz.combo;
  }

  // Close the round and pay the coins.
  private close() {
    this.open = false;
    this.wrong = null;
    if (this.pot > 0) {
      this.sim.sides[0].money += this.pot;
      this.gain = { v: this.pot, t: 1.5 };
      coinFly(POT_POS.x, POT_POS.y, COIN_POS.x, COIN_POS.y, Math.min(16, 4 + this.pot / 20));
    }
    this.pot = this.shownPot = 0;
    this.quiz.next();
  }

  // Back to the battle before the end. The coins won so far are paid, the tasks not
  // answered wait for the next round, the combo stays.
  leave() {
    if (!this.open) return;
    this.sim.sides[0].tasks += this.left;
    this.left = 0;
    this.close();
  }

  private press(k: string) {
    if (!this.open || this.wrong || this.sim.winner !== null) return;
    if (k === 'del') this.quiz.input = this.quiz.input.slice(0, -1);
    else if (k === 'ok') this.submit();
    else if (this.quiz.input.length < 4) this.quiz.input += k;
  }

  private submit() {
    const tier = this.quiz.tier, given = this.quiz.input;
    const won = this.quiz.submit();
    if (won < 0) return;
    const st = this.tiers[tier];
    st.time += this.qTime;
    this.qTime = 0;
    if (won > 0) st.correct++;
    else { st.wrong++; this.mistakes.push({ q: this.quiz.q.text, given, t: Math.round(this.sim.time) }); }
    this.maxCombo = Math.max(this.maxCombo, this.quiz.combo);
    this.earned += won;
    this.left--;
    if (won > 0) {
      this.pot += won;
      this.solved++;
      this.streak = this.quiz.combo;
      this.potGain = { v: won, t: 1.2 };
      this.okFlash = 0.5;
      this.pop = 0.35;
      const bx = 840 + MODAL.dx, by = 200 + MODAL.dy;
      burst(bx, by, COLORS.green, 18);
      coinFly(bx, by, POT_POS.x, POT_POS.y, Math.min(12, 3 + won / 20));
      if (this.left > 0) this.quiz.next();
      else this.close();
    } else {
      // A wrong answer uses up the task and resets the combo. The round goes on.
      this.wrong = { answer: this.quiz.q.answer, t: 1.4 };
    }
  }

  update(dt: number) {
    for (const k of inp.keys) {
      if (!this.open) continue;
      if (/^[0-9]$/.test(k)) this.press(k);
      else if (k === 'Backspace') this.press('del');
      else if (k === 'Enter') this.press('ok');
    }
    this.realTime += dt;
    if (this.open) {
      if (!this.wrong) this.qTime += dt;
      else if ((this.wrong.t -= dt) <= 0) {
        if (this.left > 0) { this.wrong = null; this.quiz.next(); } else this.close();
      }
    } else {
      this.acc = Math.min(this.acc + dt, 0.25);
      while (this.acc >= DT && !this.open) {
        if ((this.quizIn -= DT) <= 0) this.start();
        this.sim.step(DT);
        const inc = QUIZ.passive * this.solved * DT;
        this.sim.sides[0].money += inc;
        this.passiveEarned += inc;
        this.acc -= DT;
      }
    }
    this.okFlash = Math.max(0, this.okFlash - dt);
    this.pop = Math.max(0, this.pop - dt);
    this.gain.t = Math.max(0, this.gain.t - dt);
    this.potGain.t = Math.max(0, this.potGain.t - dt);
    const ease = (shown: number, real: number) => (Math.abs(real - shown) < 0.5 ? real : shown + (real - shown) * Math.min(1, dt * 8));
    this.shownMoney = ease(this.shownMoney, this.sim.sides[0].money);
    this.shownPot = ease(this.shownPot, this.pot);
  }

  // One plain object for getStats(). `result` is 'won', 'lost' or 'quit'.
  report(result: string) {
    const sim = this.sim;
    sim.sample();
    const r1 = (n: number) => Math.round(n * 10) / 10;
    return {
      level: this.level,
      result,
      seed: sim.seed,
      duration: r1(sim.time), // simulation seconds
      realTime: r1(this.realTime),
      castleHp: sim.sides.map((s) => `${Math.round(s.hp)}/${s.maxHp}`),
      quiz: {
        answered: this.tiers.reduce((a, t) => a + t.correct + t.wrong, 0),
        earned: this.earned,
        passive: r1(this.passiveEarned),
        maxCombo: this.maxCombo,
        tiers: this.tiers.map((t) => ({ ...t, time: r1(t.time), avgTime: r1(t.time / Math.max(1, t.correct + t.wrong)) })),
        mistakes: this.mistakes,
      },
      player: { ...sim.stats[0], buildings: sim.sides[0].buildings.map((b) => `${b.kind}:${b.lvl}`), workers: sim.sides[0].workers, walls: sim.sides[0].walls },
      enemy: { ...sim.stats[1], buildings: sim.sides[1].buildings.map((b) => `${b.kind}:${b.lvl}`), workers: sim.sides[1].workers, walls: sim.sides[1].walls },
      timeline: sim.timeline,
    };
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    inp.block = this.open;
    drawBoard(ctx, this.sim);
    this.drawHp(ctx);
    this.drawPanel(ctx, now);
    this.drawShop(ctx);
    inp.block = false;
    if (this.open) {
      ctx.fillStyle = 'rgba(30, 42, 68, 0.35)';
      ctx.fillRect(0, 0, 1440, 900);
      ctx.save();
      ctx.translate(MODAL.dx, MODAL.dy);
      this.drawTask(ctx, now);
      ctx.restore();
    }
  }

  // Top right: the start button with the cooldown bar, the last series and the passive income.
  private drawPanel(ctx: CanvasRenderingContext2D, now: number) {
    rrect(ctx, 736, 26, 680, 310, 24, COLORS.shadow);
    rrect(ctx, 736, 20, 680, 310, 24, COLORS.card);

    // Next round: the bar fills up to the round start. No tasks = no round.
    const bx = 760, by = 44, bw = 632, bh = 110, tasks = this.sim.sides[0].tasks;
    rrect(ctx, bx, by, bw, bh, 22, '#E3E8F0');
    const k = this.open ? 1 : 1 - this.quizIn / QUIZ.every;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 22); ctx.clip();
    ctx.fillStyle = tasks > 0 || this.open ? '#BFE3CC' : '#D5DBE5';
    ctx.fillRect(bx, by, bw * k, bh);
    ctx.restore();
    const title = this.open ? 'Liczymy...' : tasks > 0 ? `Zadania za ${Math.ceil(this.quizIn)} s` : 'Robotnicy szukają zadań';
    text(ctx, title, bx + bw / 2, by + 42, 32, '#3D475C');
    coin(ctx, bx + bw / 2 - 70, by + 82, 11);
    text(ctx, '?', bx + bw / 2 - 70, by + 83, 14, COLORS.gold);
    text(ctx, `Zebrane zadania: ${tasks}`, bx + bw / 2 - 50, by + 83, 20, '#5A6478', 'left', 600);

    // Last series
    text(ctx, 'Seria', 760, 196, 18, '#5A6478', 'left', 600);
    const sc = 1 + this.pop * 1.2;
    ctx.save();
    ctx.translate(760, 252);
    ctx.scale(sc, sc);
    text(ctx, String(this.streak), 0, 0, 64, '#2B4FA8', 'left');
    ctx.restore();
    const tier = tierOf(this.streak);
    for (let i = 0; i < 5; i++) {
      const on = i <= tier;
      icon(ctx, ICONS.star, 862 + i * 30, 254, 26, on ? COLORS.gold : '#B3BCCB', 1.6, on ? COLORS.coin : '#E3E8F0');
    }
    text(ctx, `Nagroda w następnej rundzie: +${this.quiz.reward}`, 760, 304, 16, '#5A6478', 'left', 600);

    // Passive income
    rrect(ctx, 1052, 180, 340, 136, 18, '#FFF8E1');
    text(ctx, 'Stały dochód', 1072, 204, 18, COLORS.gold, 'left', 600);
    coin(ctx, 1088, 250, 16);
    text(ctx, `+${num1(this.sim.income + QUIZ.passive * this.solved)} / s`, 1114, 252, 40, COLORS.gold, 'left');
    text(ctx, `Rozwiązane zadania: ${this.solved}`, 1072, 296, 16, '#8A6A1A', 'left', 600);
  }

  private drawHp(ctx: CanvasRenderingContext2D) {
    for (const side of [0, 1] as Side[]) {
      const s = this.sim.sides[side], top = side === 0;
      const by = top ? 86 : 470, bh = 344, pct = s.hp / s.maxHp;
      ctx.save();
      ctx.translate(680 - 17, top ? 24 : 862);
      ctx.scale(34 / 132, (top ? 1 : -1) * (22 / 54));
      ctx.fillStyle = SIDE_COLOR[side];
      ctx.fill(new Path2D(ICONS.castle));
      ctx.lineWidth = 10;
      ctx.strokeStyle = COLORS.ink;
      ctx.stroke(new Path2D(ICONS.castle));
      ctx.restore();
      text(ctx, String(Math.ceil(s.hp)), 680, top ? 66 : 450 + 386, 18, COLORS.ink);
      rrect(ctx, 663, by, 34, bh, 17, '#FFFFFF');
      ctx.save();
      ctx.beginPath(); ctx.roundRect(663, by, 34, bh, 17); ctx.clip();
      ctx.fillStyle = SIDE_COLOR[side];
      const fh = bh * pct;
      ctx.fillRect(663, top ? by : by + bh - fh, 34, fh);
      ctx.restore();
      rrect(ctx, 663, by, 34, bh, 17, undefined, COLORS.ink, 4);
    }
  }

  private drawTask(ctx: CanvasRenderingContext2D, now: number) {
    const q = this.quiz;
    rrect(ctx, 736, 28, 680, 430, 24, COLORS.shadow);
    rrect(ctx, 736, 20, 680, 430, 24, COLORS.card);

    // Equation; the font gets smaller for long questions.
    const parts = [...q.q.text.split(' '), '='];
    let size = 72;
    ctx.font = `700 ${size}px ${FONT}`;
    const width = () => parts.reduce((a, p) => a + ctx.measureText(p).width + 16, -16);
    while (width() > 390 && size > 40) { size -= 4; ctx.font = `700 ${size}px ${FONT}`; }
    let x = 760;
    parts.forEach((p, i) => {
      const color = i === 1 ? '#2B4FA8' : i === 3 ? COLORS.line : COLORS.ink;
      text(ctx, p, x, 104, size, color, 'left');
      x += ctx.measureText(p).width + 16;
    });

    // Answer box
    const shake = this.wrong ? Math.sin(now * 0.06) * 6 * Math.max(0, this.wrong.t - 1) * 2.5 : 0;
    const border = this.wrong ? COLORS.red : this.okFlash > 0 ? COLORS.green : '#2B4FA8';
    const fill = this.wrong ? '#FBE9E7' : this.okFlash > 0 ? '#E3F4EA' : '#F2F5FA';
    rrect(ctx, 760 + shake, 162, 160, 76, 18, fill, border, 4);
    if (this.wrong) text(ctx, String(this.wrong.answer), 840 + shake, 202, 56, COLORS.red);
    else {
      text(ctx, q.input, 840, 202, 56, COLORS.ink);
      if (Math.floor(now / 500) % 2 === 0) {
        ctx.font = `700 56px ${FONT}`;
        const cx = 840 + ctx.measureText(q.input).width / 2 + 4;
        ctx.fillStyle = '#2B4FA8';
        ctx.fillRect(cx, 178, 3, 46);
      }
    }

    // Reward chip
    const label = `+${q.reward}`;
    ctx.font = `700 22px ${FONT}`;
    const cw = ctx.measureText(label).width + 54;
    rrect(ctx, 936, 181, cw, 40, 14, '#FFF3CC');
    coin(ctx, 958, 201, 10);
    text(ctx, label, 974, 202, 22, COLORS.gold, 'left');

    // Combo: bar inside the tier, stars for the tier reached
    const tier = q.tier, inTier = tier < 4 ? (q.combo % 3) / 3 : 1;
    rrect(ctx, 760, 260, 250, 12, 6, '#E3E8F0');
    if (inTier > 0) rrect(ctx, 760, 260, 250 * inTier, 12, 6, '#2B4FA8');
    for (let i = 0; i < 5; i++) {
      const on = i <= tier;
      icon(ctx, ICONS.star, 1034 + i * 26, 266, 22, on ? COLORS.gold : '#B3BCCB', 1.6, on ? COLORS.coin : '#E3E8F0');
    }
    const sc = 1 + this.pop * 1.2;
    ctx.save();
    ctx.translate(760, 300);
    ctx.scale(sc, sc);
    text(ctx, `Seria ${q.combo}`, 0, 0, 26, this.pop > 0 ? COLORS.green : '#2B4FA8', 'left');
    ctx.restore();

    // Coins won in this round
    rrect(ctx, 760, 340, 380, 90, 18, '#FFF8E1');
    text(ctx, 'Zarobione w tej rundzie', 780, 360, 16, COLORS.gold, 'left', 600);
    coin(ctx, 776 + 8, 400, 14);
    const pot = String(Math.round(this.shownPot));
    text(ctx, pot, 808, 402, 44, COLORS.gold, 'left');
    if (this.potGain.t > 0) {
      ctx.font = `700 44px ${FONT}`;
      ctx.globalAlpha = Math.min(1, this.potGain.t * 2);
      text(ctx, `+${this.potGain.v}`, 822 + ctx.measureText(pot).width, 402 - (1.2 - this.potGain.t) * 20, 26, COLORS.green, 'left');
      ctx.globalAlpha = 1;
    }

    // Progress in the round, or what comes after a wrong answer
    const done = this.round - this.left;
    if (this.wrong) text(ctx, this.left > 0 ? 'Następne zadanie' : 'Koniec rundy', 1282, 324, 20, COLORS.red);
    else text(ctx, `Zadanie ${done + 1} z ${this.round}`, 1282, 324, 20, COLORS.ink);

    // Back to the battle: the tasks not answered wait for the next round
    const lb = btn(1172 + MODAL.dx, 352 + MODAL.dy, 220, 66);
    if (lb.clicked) this.leave();
    const ldy = lb.pressed ? 4 : 0;
    if (!lb.pressed) rrect(ctx, 1172, 356, 220, 66, 16, '#5A6478');
    rrect(ctx, 1172, 352 + ldy, 220, 66, 16, lb.hover ? '#8D97AB' : '#7D879B');
    text(ctx, 'Wróć do gry', 1282, 378 + ldy, 24, '#FFFFFF');
    text(ctx, 'Esc', 1282, 403 + ldy, 14, '#E3E8F0', 'center', 600);

    // Keypad
    rrect(ctx, 1172, 44, 220, 262, 18, COLORS.bg);
    const kw = (220 - 24 - 20) / 3;
    KEYS.forEach((k, i) => {
      const kx = 1184 + (i % 3) * (kw + 10), ky = 56 + Math.floor(i / 3) * 62;
      const b = btn(kx + MODAL.dx, ky + MODAL.dy, kw, 52);
      const green = k === 'ok';
      if (b.clicked) { this.press(k); burst(inp.x, inp.y, green ? COLORS.green : '#2B4FA8', 8); }
      const dy = b.pressed ? 3 : 0;
      if (!b.pressed) rrect(ctx, kx, ky + 3, kw, 52, 14, green ? '#1F5E3B' : '#C9D0DC');
      rrect(ctx, kx, ky + dy, kw, 52, 14, green ? (b.hover ? '#34A065' : COLORS.green) : b.hover ? '#F2F5FA' : '#FFFFFF');
      if (k === 'del') icon(ctx, ICONS.back, kx + kw / 2, ky + 26 + dy, 26, '#5A6478');
      else if (green) icon(ctx, ICONS.check, kx + kw / 2, ky + 26 + dy, 28, '#FFFFFF', 3);
      else text(ctx, k, kx + kw / 2, ky + 27 + dy, 26, COLORS.ink, 'center', 600);
    });
  }

  private drawShop(ctx: CanvasRenderingContext2D) {
    const s = this.sim.sides[0];
    // Coins
    ctx.save();
    ctx.translate(744, 350);
    for (const [cx, cy, f] of [[24, 30, '#F2B705'], [28, 16, '#FFD84D']] as const) {
      ctx.beginPath(); ctx.ellipse(cx, cy, 20, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = f; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COLORS.gold; ctx.stroke();
    }
    ctx.restore();
    const money = String(Math.round(this.shownMoney));
    text(ctx, money, 808, 386, 64, COLORS.gold, 'left');
    if (this.gain.t > 0) {
      ctx.font = `700 64px ${FONT}`;
      ctx.globalAlpha = Math.min(1, this.gain.t);
      text(ctx, `+${this.gain.v}`, 822 + ctx.measureText(money).width, 394, 28, COLORS.green, 'left');
      ctx.globalAlpha = 1;
    }

    // Section headers
    const header = (y: number, d: string) => {
      icon(ctx, d, 756, y, 24, '#5A6478', 2.4);
      rrect(ctx, 780, y - 1.5, 636, 3, 2, COLORS.shadow);
    };
    header(447, 'M3 21V10l9-6 9 6v11M12 13v6M9 16h6');
    header(643, 'M12 20V5M5 12l7-7 7 7');

    const tw = (680 - 42) / 4;
    let tip: string | null = null, tipX = 0, tipY = 0;
    const tile = (x: number, y: number, enabled: boolean, name: string) => {
      const b = btn(x, y, tw, 140);
      const lift = b.pressed ? 2 : b.hover && enabled ? -2 : 0;
      rrect(ctx, x, y + 4 + Math.max(0, lift), tw, 140, 18, COLORS.shadow);
      rrect(ctx, x, y + lift, tw, 140, 18, '#FFFFFF');
      if (b.hover) { tip = name; tipX = x + tw / 2; tipY = y - 10; }
      ctx.globalAlpha = enabled ? 1 : 0.45;
      return { clicked: b.clicked && enabled, lift };
    };
    const price = (x: number, y: number, p: number) => {
      const label = Number.isFinite(p) ? String(p) : 'MAX';
      ctx.font = `700 22px ${FONT}`;
      const w = ctx.measureText(label).width + 26;
      if (Number.isFinite(p)) coin(ctx, x + tw / 2 - w / 2 + 9, y, 9);
      text(ctx, label, x + tw / 2 + (Number.isFinite(p) ? 13 : 0), y + 1, 22, COLORS.gold);
    };

    KINDS.forEach((k, i) => {
      const x = 736 + i * (tw + 14), y = 470, p = buildingPrice(s, k);
      const full = s.buildings.length >= CFG.maxBuildings;
      const t = tile(x, y, s.money >= p && !full, full ? 'Pas jest pełny' : `${UNITS[k].name}: ${UNIT_INFO[k]}`);
      if (t.clicked && this.sim.buyBuilding(0, k)) burst(inp.x, inp.y, COLORS.player, 14);
      const cx = x + tw / 2, ly = y + t.lift;
      rrect(ctx, cx - 32, ly + 12, 64, 56, 14, COLORS.player);
      icon(ctx, ICONS[k], cx, ly + 40, 34, '#FFFFFF', 2.2);
      unitBall(ctx, k, 0, cx, ly + 88, k === 'siege' ? 11 : 9);
      price(x, ly + 116, p);
      ctx.globalAlpha = 1;
      const n = s.buildings.filter((b) => b.kind === k).length;
      if (n > 0) {
        rrect(ctx, x + tw - 34, ly + 8, 26, 26, 13, COLORS.ink);
        text(ctx, String(n), x + tw - 21, ly + 22, 16, '#FFFFFF');
      }
    });

    // Worker and wall repair. Building levels: click a building on the belt.
    {
      const x = 736, y = 666, p = workerPrice(s);
      const t = tile(x, y, s.money >= p, `Robotnik: zbiera zadania (${s.workers}/${WORKER.max})`);
      if (t.clicked && this.sim.buyWorker(0)) burst(inp.x, inp.y, COLORS.purple, 14);
      const cx = x + tw / 2, ly = y + t.lift;
      ctx.beginPath(); ctx.ellipse(cx, ly + 40, 32, 28, 0, 0, Math.PI * 2); ctx.fillStyle = '#F1E6FA'; ctx.fill();
      icon(ctx, ICONS.worker, cx, ly + 40, 34, COLORS.purple, 2.2);
      for (let j = 0; j < WORKER.max; j++)
        rrect(ctx, cx - 41 + j * 17, ly + 82, 12, 12, 4, j < s.workers ? COLORS.purple : '#E3E8F0');
      price(x, ly + 116, p);
      ctx.globalAlpha = 1;
    }
    {
      const x = 736 + tw + 14, y = 666, p = repairPrice(s), hurt = s.walls.some((w) => w < WALL.hp);
      const t = tile(x, y, s.money >= p && hurt, hurt ? 'Naprawa muru: wszystkie części jak nowe' : 'Mur jest cały');
      if (t.clicked && this.sim.repairWalls(0)) burst(inp.x, inp.y, COLORS.purple, 14);
      const cx = x + tw / 2, ly = y + t.lift;
      ctx.beginPath(); ctx.ellipse(cx, ly + 40, 32, 28, 0, 0, Math.PI * 2); ctx.fillStyle = '#F1E6FA'; ctx.fill();
      icon(ctx, ICONS.wall, cx, ly + 40, 34, COLORS.purple, 2.2);
      s.walls.forEach((w, j) => {
        rrect(ctx, cx - 41 + j * 17, ly + 82, 12, 12, 4, '#E3E8F0');
        if (w > 0) rrect(ctx, cx - 41 + j * 17, ly + 82 + 12 * (1 - w / WALL.hp), 12, 12 * (w / WALL.hp), 4, COLORS.purple);
      });
      price(x, ly + 116, p);
      ctx.globalAlpha = 1;
    }
    text(ctx, 'Kliknij budynek na taśmie,', 736 + 2 * (tw + 14) + 8, 720, 18, '#5A6478', 'left', 600);
    text(ctx, 'żeby go ulepszyć.', 736 + 2 * (tw + 14) + 8, 746, 18, '#5A6478', 'left', 600);

    // Buildings on the player belt: a click buys the next level.
    for (const [i, bd] of s.buildings.entries()) {
      const cx = BOARD.x + CFG.beltX + bd.s, cy = BOARD.y + 124, p = levelPrice(bd);
      if (cx < BOARD.x + CFG.beltX || cx > BOARD.x + CFG.beltX + CFG.beltLen) continue;
      const b = btn(cx - 26, cy - 24, 52, 48);
      if (!b.hover) continue;
      tip = Number.isFinite(p) ? `${UNITS[bd.kind].name}, poziom ${bd.lvl}: ulepsz za ${p}` : `${UNITS[bd.kind].name}: najwyższy poziom`;
      tipX = cx; tipY = cy + 70;
      rrect(ctx, cx - 30, cy - 28, 60, 56, 14, undefined, s.money >= p ? COLORS.green : COLORS.line, 4);
      if (b.clicked && this.sim.levelUp(0, i)) burst(inp.x, inp.y, COLORS.coin, 14);
    }

    text(ctx, `Poziom ${this.level}`, 748, 852, 20, '#5A6478', 'left', 600);
    if (tip) {
      const t: string = tip;
      ctx.font = `600 16px ${FONT}`;
      const w = ctx.measureText(t).width + 24;
      const x = Math.min(1416 - w, Math.max(tipX < 736 ? 24 : 736, tipX - w / 2));
      rrect(ctx, x, tipY - 30, w, 32, 10, COLORS.ink);
      text(ctx, t, x + w / 2, tipY - 13, 16, '#FFFFFF', 'center', 600);
    }
  }
}

const UNIT_INFO: Record<string, string> = {
  soldier: 'żołnierz, mocno uderza',
  archer: 'łucznik, strzela do wrogów',
  general: 'generał, przyspiesza i wzmacnia sojuszników',
  siege: 'machina, niszczy zamek',
};
