import {
  ARCHER, CFG, GENERAL, H, KINDS, Kind, POINTS, QUIZ, Side, UNITS, W, WALL, WORKER,
} from './config';

export interface Unit {
  id: number; side: Side; kind: Kind;
  x: number; y: number; vx: number; vy: number; r: number; m: number;
  hp: number; maxHp: number; cd: number; age: number; flash: number; boost: number;
}
export interface Building { kind: Kind; s: number; t: number; lvl: number }
export interface SideState {
  hp: number; maxHp: number; money: number; buildings: Building[];
  walls: number[]; // HP of the five wall segments
  workers: number; workerT: number; // owned workers, production progress 0..1
  tasks: number; // collected tasks, not yet solved
  repairs: number; // wall repairs bought, it sets the repair price
}
export type Fx =
  | { type: 'text'; x: number; y: number; text: string; color: string; t: number }
  | { type: 'arrow'; x: number; y: number; x2: number; y2: number; side: Side; t: number }
  | { type: 'spark'; x: number; y: number; t: number }
  | { type: 'castle'; x: number; y: number; text: string; side: Side; t: number };

// ---- Static board geometry (from the mock) ----
export const PEG_R = 5;
export const SEG_R = 3;
export const PEGS: { x: number; y: number }[] = [];
for (let i = 0; i < 11; i++) {
  const y = 230 + i * 40;
  for (let x = 30 + (i % 2) * 30; x <= 570; x += 60) {
    if (Math.abs(x - 300) + Math.abs(y - 430) < 108) continue;
    if ((x < 90 || x > 510) && Math.abs(y - 430) < 120) continue;
    if (x < 45 || x > W - 45) continue; // the gap to the wall is too small, units get stuck
    PEGS.push({ x, y });
  }
}
export const POLYS: number[][] = [
  [0, 300, 64, 430, 0, 560], [600, 300, 536, 430, 600, 560],
  // Deflectors stop 40 units from the wall. Without this gap units get stuck in the corner.
  [40, 198.5, 64, 176], [560, 198.5, 536, 176], [40, 661.5, 64, 684], [560, 661.5, 536, 684],
  [300, 366, 364, 430, 300, 494, 236, 430, 300, 366],
];
export const ZONE_TOP = [60, 96]; // player castle zones (enemy units score here)
export const ZONE_BOT = [764, 800]; // enemy castle zones
// Walls: one segment in front of each castle zone. WALL_Y[side] is the wall of that side's castle.
export const WALL_Y: Record<Side, number> = { 0: ZONE_TOP[1] + 4, 1: ZONE_BOT[0] - 4 };
export const wallX = (i: number) => [i * 120 + 6, i * 120 + 114];
for (const x of [120, 240, 360, 480]) POLYS.push([x, ZONE_TOP[0], x, ZONE_TOP[1]], [x, ZONE_BOT[0], x, ZONE_BOT[1]]);
const SEGS: number[][] = POLYS.flatMap((p) => {
  const out = [];
  for (let i = 0; i + 3 < p.length; i += 2) out.push([p[i], p[i + 1], p[i + 2], p[i + 3]]);
  return out;
});
const FX_LIFE = { text: 0.8, arrow: 0.5, spark: 0.35, castle: 1.1 };
export const SPAWN_Y: Record<Side, number> = { 0: 172, 1: H - 172 };

export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const buildingPrice = (s: SideState, k: Kind) =>
  Math.round(UNITS[k].price * CFG.buildingPriceGrowth ** s.buildings.filter((b) => b.kind === k).length);
// Level n -> n + 1 costs n / 2 times the base price of the building.
export const levelPrice = (b: Building) => (b.lvl >= CFG.buildingMaxLvl ? Infinity : (UNITS[b.kind].price * b.lvl) / 2);
export const workerPrice = (s: SideState) =>
  s.workers >= WORKER.max ? Infinity : Math.round(UNITS.worker.price * CFG.buildingPriceGrowth ** (s.workers - WORKER.start));
export const repairPrice = (s: SideState) => Math.round(WALL.repairPrice * CFG.buildingPriceGrowth ** s.repairs);

// Counters for balancing. They stay in memory only (see getStats() in main.ts).
const perKind = (): Record<Kind, number> => ({ soldier: 0, archer: 0, general: 0, siege: 0, worker: 0 });
const sideStats = () => ({
  spawned: perKind(),
  killed: perKind(), // units of this side that died in a fight
  expired: 0, // units of this side removed after CFG.unitMaxAge
  unitDmg: perKind(), // damage that units of this side did to enemy units, by attacker kind
  castleDmg: perKind(), // damage that units of this side did to the enemy castle
  zoneHits: [0, 0, 0, 0, 0],
  wallDmg: 0, // damage that units of this side did to enemy walls
  wallsBroken: 0,
  tasks: 0, // tasks collected by the workers of this side
  spent: 0,
  buys: [] as { t: number; item: string; price: number }[],
});
export type SideStats = ReturnType<typeof sideStats>;

type Plan = Kind | 'level' | 'worker' | 'repair' | null;

export class Sim {
  units: Unit[] = [];
  fx: Fx[] = [];
  sides: [SideState, SideState];
  time = 0;
  stats: [SideStats, SideStats] = [sideStats(), sideStats()];
  timeline: { t: number; hp: number[]; units: number[]; money: number[] }[] = [];
  winner: Side | null = null;
  ai = true; // false: nobody buys for side 1 (balance script)
  income: number; // coins/s for each side
  points: number[] = []; // x of the task points on the board, y is POINTS.y
  private pointAt: number[] = []; // times when new points appear
  private nextId = 1;
  private hits = new Map<number, number>(); // pair key -> time when the pair can hit again
  private plan: Plan = null;
  rng: () => number;

  constructor(public level: number, public seed = Date.now()) {
    this.rng = mulberry32(seed);
    const mk = (hp: number): SideState => ({
      hp, maxHp: hp, money: 0, buildings: [], walls: [0, 1, 2, 3, 4].map(() => WALL.hp),
      workers: WORKER.start, workerT: 0, tasks: 0, repairs: 0,
    });
    this.sides = [mk(CFG.playerCastleHp), mk(CFG.enemyCastleHp(level))];
    this.income = CFG.income(level);
    for (let i = 0; i < POINTS.active; i++) this.addPoint();
  }

  private addPoint() {
    const free = POINTS.slots.filter((x) => !this.points.includes(x));
    this.points.push(free[Math.floor(this.rng() * free.length)]);
  }

  buyBuilding(side: Side, kind: Kind): boolean {
    const s = this.sides[side];
    const price = buildingPrice(s, kind);
    if (s.money < price || s.buildings.length >= CFG.maxBuildings) return false;
    s.money -= price;
    this.logBuy(side, kind, price);
    // Put the new building in the middle of the largest gap on the belt.
    const L = CFG.beltLen;
    const pos = s.buildings.map((b) => b.s).sort((a, b) => a - b);
    let at = L / 2;
    if (pos.length) {
      let best = -1;
      pos.forEach((p, i) => {
        const gap = (i + 1 < pos.length ? pos[i + 1] : pos[0] + L) - p;
        if (gap > best) { best = gap; at = (p + gap / 2) % L; }
      });
    }
    s.buildings.push({ kind, s: at, t: 0, lvl: 1 });
    return true;
  }

  levelUp(side: Side, i: number): boolean {
    const s = this.sides[side], b = s.buildings[i], price = levelPrice(b);
    if (s.money < price) return false;
    s.money -= price;
    b.lvl++;
    this.logBuy(side, `${b.kind}:lvl${b.lvl}`, price);
    return true;
  }

  buyWorker(side: Side): boolean {
    const s = this.sides[side], price = workerPrice(s);
    if (s.money < price) return false;
    s.money -= price;
    s.workers++;
    this.logBuy(side, 'worker', price);
    return true;
  }

  // Rebuild every segment to full HP, broken ones too.
  repairWalls(side: Side): boolean {
    const s = this.sides[side], price = repairPrice(s);
    if (s.money < price || s.walls.every((w) => w >= WALL.hp)) return false;
    s.money -= price;
    s.repairs++;
    s.walls = s.walls.map(() => WALL.hp);
    this.logBuy(side, 'repair', price);
    return true;
  }

  private logBuy(side: Side, item: string, price: number) {
    const st = this.stats[side];
    st.spent += price;
    st.buys.push({ t: Math.round(this.time * 10) / 10, item, price });
  }

  private spawn(side: Side, kind: Kind, x: number) {
    const d = UNITS[kind], hp = d.hp, dir = side === 0 ? 1 : -1;
    this.stats[side].spawned[kind]++;
    this.units.push({
      id: this.nextId++, side, kind, x, y: SPAWN_Y[side], vx: (this.rng() - 0.5) * 60, vy: 60 * dir,
      r: d.r, m: d.r * d.r, hp, maxHp: hp, cd: ARCHER.cooldown, age: 0, flash: 0, boost: 1,
    });
  }

  private enemyAi() {
    const s = this.sides[1];
    s.money += s.tasks * QUIZ.enemyTask;
    s.tasks = 0;
    if (!this.plan) {
      const opts: [Plan, number][] = [];
      if (s.buildings.length < CFG.maxBuildings)
        for (const k of KINDS) if (this.level >= CFG.enemyUnlock[k]) opts.push([k, k === 'soldier' ? 4 : 2]);
      if (this.level >= CFG.enemyUpgradesFrom) {
        if (s.buildings.some((b) => b.lvl < CFG.buildingMaxLvl)) opts.push(['level', 2]);
        if (s.workers < WORKER.max) opts.push(['worker', 1]);
        if (s.walls.some((w) => w < WALL.hp / 2)) opts.push(['repair', 3]);
      }
      let r = this.rng() * opts.reduce((a, o) => a + o[1], 0);
      for (const [p, w] of opts) if ((r -= w) < 0) { this.plan = p; break; }
    }
    const p = this.plan;
    if (!p) return;
    let done = false;
    if (p === 'level') {
      // The cheapest building to level up
      let best = -1;
      s.buildings.forEach((b, i) => { if (best < 0 || levelPrice(b) < levelPrice(s.buildings[best])) best = i; });
      done = best < 0 || !Number.isFinite(levelPrice(s.buildings[best])) || this.levelUp(1, best);
    } else if (p === 'worker') done = s.workers >= WORKER.max || this.buyWorker(1);
    else if (p === 'repair') done = this.repairWalls(1) || s.walls.every((w) => w >= WALL.hp);
    else done = s.buildings.length >= CFG.maxBuildings || this.buyBuilding(1, p);
    if (done) this.plan = null;
  }

  // An enemy unit hits a wall segment: the wall hits back and loses the unit's castle damage.
  private hitWall(u: Unit, side: Side, i: number) {
    const key = -(u.id * 10 + i);
    if ((this.hits.get(key) ?? 0) > this.time) return;
    this.hits.set(key, this.time + CFG.hitCooldown);
    const walls = this.sides[side].walls, dmg = Math.min(walls[i], UNITS[u.kind].castle);
    walls[i] -= dmg;
    this.stats[u.side].wallDmg += dmg;
    if (walls[i] <= 0) this.stats[u.side].wallsBroken++;
    u.hp -= WALL.hit;
    u.flash = 0.12;
    this.fx.push({ type: 'text', x: u.x, y: u.y - u.r, text: `−${WALL.hit}`, color: '#B3261E', t: 0 });
    this.fx.push({ type: 'spark', x: u.x, y: WALL_Y[side], t: 0 });
    const away = side === 0 ? 1 : -1, sx = this.rng() < 0.5 ? -1 : 1;
    u.vx = sx * CFG.minSideways * CFG.bounceSpeed * u.boost;
    u.vy = away * Math.sqrt(1 - CFG.minSideways ** 2) * CFG.bounceSpeed * u.boost;
  }

  private hitCastle(u: Unit) {
    const target: Side = u.side === 0 ? 1 : 0;
    const zone = Math.min(4, Math.max(0, Math.floor(u.x / (W / 5))));
    // A hurt unit does less damage to the castle: 30 % HP left = 30 % damage.
    const hpLeft = Math.max(0, u.hp) / u.maxHp;
    const dmg = Math.max(1, Math.round(UNITS[u.kind].castle * CFG.zoneMult[zone] * hpLeft));
    const s = this.sides[target];
    this.stats[u.side].castleDmg[u.kind] += Math.min(dmg, s.hp);
    this.stats[u.side].zoneHits[zone]++;
    s.hp = Math.max(0, s.hp - dmg);
    this.fx.push({ type: 'castle', x: u.x, y: u.y, text: `−${dmg}`, side: target, t: 0 });
    if (s.hp <= 0 && this.winner === null) this.winner = u.side;
  }

  private damage(u: Unit, dmg: number, by: Unit) {
    if (dmg <= 0) return;
    this.stats[by.side].unitDmg[by.kind] += Math.min(dmg, Math.max(0, u.hp));
    u.hp -= dmg;
    u.flash = 0.12;
    this.fx.push({ type: 'text', x: u.x + (this.rng() - 0.5) * 16, y: u.y - u.r, text: `−${dmg}`, color: '#B3261E', t: 0 });
  }

  // Push a unit out of a static circle and reflect its velocity.
  private bounceStatic(u: Unit, cx: number, cy: number, cr: number, jitter: number) {
    const dx = u.x - cx, dy = u.y - cy, d2 = dx * dx + dy * dy, rr = u.r + cr;
    if (d2 >= rr * rr || d2 === 0) return;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
    u.x = cx + nx * rr;
    u.y = cy + ny * rr;
    const vn = u.vx * nx + u.vy * ny;
    if (vn >= 0) return;
    u.vx -= (1 + CFG.restitution) * vn * nx;
    u.vy -= (1 + CFG.restitution) * vn * ny;
    const j = (this.rng() - 0.5) * jitter;
    u.vx -= ny * j;
    u.vy += nx * j;
  }

  private collideUnits(a: Unit, b: Unit) {
    let dx = b.x - a.x, dy = b.y - a.y;
    const rr = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 0.001;
    const nx = dx / d, ny = dy / d, over = rr - d, mt = a.m + b.m;
    a.x -= nx * over * (b.m / mt); a.y -= ny * over * (b.m / mt);
    b.x += nx * over * (a.m / mt); b.y += ny * over * (a.m / mt);
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;

    const key = a.id < b.id ? a.id * 1e6 + b.id : b.id * 1e6 + a.id;
    if (a.side !== b.side && (this.hits.get(key) ?? 0) <= this.time) {
      this.hits.set(key, this.time + CFG.hitCooldown);
      this.damage(a, UNITS[b.kind].hit * (b.boost > 1 ? GENERAL.hitMult : 1), b);
      this.damage(b, UNITS[a.kind].hit * (a.boost > 1 ? GENERAL.hitMult : 1), a);
      this.fx.push({ type: 'spark', x: a.x + nx * a.r, y: a.y + ny * a.r, t: 0 });
      // Strong bounce: replace both velocities. The direction always has a sideways
      // part, so gravity does not pull the same two units back together at once.
      dx = nx; dy = ny;
      if (Math.abs(dx) < CFG.minSideways) {
        dx = (dx === 0 ? (this.rng() < 0.5 ? -1 : 1) : Math.sign(dx)) * CFG.minSideways;
        dy = Math.sign(dy || 1) * Math.sqrt(1 - dx * dx);
      }
      const va = (CFG.bounceSpeed * 2 * b.m) / mt, vb = (CFG.bounceSpeed * 2 * a.m) / mt;
      a.vx = -dx * va * a.boost; a.vy = -dy * va * a.boost;
      b.vx = dx * vb * b.boost; b.vy = dy * vb * b.boost;
    } else if (vn < 0) {
      const j = (-(1 + 0.6) * vn) / mt;
      a.vx -= j * b.m * nx; a.vy -= j * b.m * ny;
      b.vx += j * a.m * nx; b.vy += j * a.m * ny;
    }
  }

  step(dt: number) {
    if (this.winner !== null) return;
    this.time += dt;
    for (const f of this.fx) f.t += dt / FX_LIFE[f.type];
    this.fx = this.fx.filter((f) => f.t < 1);
    const L = CFG.beltLen;

    // Belts and production
    this.sides.forEach((s, side) => {
      const dir = side === 0 ? 1 : -1;
      for (const b of s.buildings) {
        b.s = (((b.s + dir * CFG.beltSpeed * dt) % L) + L) % L;
        b.t += (dt * (1 + CFG.levelBonus * (b.lvl - 1))) / UNITS[b.kind].interval;
        if (b.t >= 1) { b.t = 0; this.spawn(side as Side, b.kind, CFG.beltX + b.s); }
      }
      s.money += this.income * dt;
      s.workerT += (dt * s.workers) / UNITS.worker.interval;
      if (s.workerT >= 1) { s.workerT = 0; this.spawn(side as Side, 'worker', CFG.beltX + this.rng() * L); }
    });
    if (this.ai) this.enemyAi();
    while (this.pointAt.length && this.pointAt[0] <= this.time) { this.pointAt.shift(); this.addPoint(); }

    // General auras
    const gens = this.units.filter((u) => u.kind === 'general');
    for (const u of this.units)
      u.boost = gens.some((g) => g.side === u.side && (g.x - u.x) ** 2 + (g.y - u.y) ** 2 < GENERAL.radius ** 2) ? GENERAL.boost : 1;

    // Motion and static collisions
    for (const u of this.units) {
      u.age += dt;
      u.flash = Math.max(0, u.flash - dt);
      u.vy += (u.side === 0 ? 1 : -1) * CFG.gravity * u.boost * dt;
      const sp = Math.hypot(u.vx, u.vy);
      if (sp > CFG.maxSpeed) { u.vx *= CFG.maxSpeed / sp; u.vy *= CFG.maxSpeed / sp; }
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      for (const p of PEGS) this.bounceStatic(u, p.x, p.y, PEG_R, CFG.pegJitter);
      for (const [ax, ay, bx, by] of SEGS) {
        const ex = bx - ax, ey = by - ay;
        const t = Math.max(0, Math.min(1, ((u.x - ax) * ex + (u.y - ay) * ey) / (ex * ex + ey * ey)));
        this.bounceStatic(u, ax + ex * t, ay + ey * t, SEG_R, 0);
      }
      for (const side of [0, 1] as Side[])
        this.sides[side].walls.forEach((hp, i) => {
          if (hp <= 0) return;
          const [a, b] = wallX(i), cx = Math.max(a, Math.min(b, u.x)), wy = WALL_Y[side];
          if ((u.x - cx) ** 2 + (u.y - wy) ** 2 >= (u.r + SEG_R) ** 2) return;
          this.bounceStatic(u, cx, wy, SEG_R, 0);
          if (u.side !== side) this.hitWall(u, side, i);
        });
      if (u.kind === 'worker')
        for (const x of this.points)
          if ((u.x - x) ** 2 + (u.y - POINTS.y) ** 2 < (u.r + POINTS.r) ** 2) {
            this.points.splice(this.points.indexOf(x), 1);
            this.pointAt.push(this.time + POINTS.respawn);
            this.sides[u.side].tasks++;
            this.stats[u.side].tasks++;
            this.fx.push({ type: 'text', x, y: POINTS.y - 16, text: '+1', color: '#7A5600', t: 0 });
            break;
          }
      if (u.x < u.r) { u.x = u.r; u.vx = Math.abs(u.vx) * CFG.restitution; }
      if (u.x > W - u.r) { u.x = W - u.r; u.vx = -Math.abs(u.vx) * CFG.restitution; }
      if (u.y < ZONE_TOP[0] + u.r) { u.y = ZONE_TOP[0] + u.r; u.vy = Math.abs(u.vy) * CFG.restitution; }
      if (u.y > ZONE_BOT[1] - u.r) { u.y = ZONE_BOT[1] - u.r; u.vy = -Math.abs(u.vy) * CFG.restitution; }
    }
    for (let i = 0; i < this.units.length; i++)
      for (let j = i + 1; j < this.units.length; j++) this.collideUnits(this.units[i], this.units[j]);

    // Archers
    for (const u of this.units) {
      if (u.kind === 'archer') {
        u.cd -= dt;
        if (u.cd <= 0) this.shoot(u);
      }
    }

    // Scoring, deaths, timeouts
    this.units = this.units.filter((u) => {
      const scored = u.side === 0 ? u.y > (ZONE_BOT[0] + ZONE_BOT[1]) / 2 : u.y < (ZONE_TOP[0] + ZONE_TOP[1]) / 2;
      if (scored && u.kind !== 'worker') this.hitCastle(u);
      if (!scored && u.hp <= 0) this.stats[u.side].killed[u.kind]++;
      else if (!scored && u.age >= CFG.unitMaxAge) this.stats[u.side].expired++;
      return !scored && u.hp > 0 && u.age < CFG.unitMaxAge;
    });
    if (Math.floor(this.time / 5) > this.timeline.length - 1) this.sample();
    if (this.hits.size > 2000) for (const [k, t] of this.hits) if (t <= this.time) this.hits.delete(k);
  }

  sample() {
    this.timeline.push({
      t: Math.round(this.time),
      hp: this.sides.map((s) => Math.round(s.hp)),
      units: [0, 1].map((side) => this.units.filter((u) => u.side === side).length),
      money: this.sides.map((s) => Math.round(s.money)),
    });
  }

  // The arrow is not simulated. It flies toward the nearest enemy in range and hits
  // the first enemy on that line.
  private shoot(a: Unit) {
    const range = ARCHER.range;
    let target: Unit | null = null, best = range * range;
    for (const e of this.units) {
      if (e.side === a.side) continue;
      const d2 = (e.x - a.x) ** 2 + (e.y - a.y) ** 2;
      if (d2 < best) { best = d2; target = e; }
    }
    if (!target) return;
    const d = Math.sqrt(best) || 1, dx = (target.x - a.x) / d, dy = (target.y - a.y) / d;
    let hit = target, hitT = Infinity;
    for (const e of this.units) {
      if (e.side === a.side) continue;
      const ox = e.x - a.x, oy = e.y - a.y, t = ox * dx + oy * dy;
      const perp2 = ox * ox + oy * oy - t * t;
      if (t < 0 || t > range || perp2 > e.r * e.r) continue;
      const tIn = t - Math.sqrt(e.r * e.r - perp2);
      if (tIn < hitT) { hitT = tIn; hit = e; }
    }
    a.cd = ARCHER.cooldown;
    this.damage(hit, ARCHER.damage, a);
    this.fx.push({ type: 'arrow', x: a.x, y: a.y, x2: a.x + dx * hitT, y2: a.y + dy * hitT, side: a.side, t: 0 });
  }
}
