// Balance matrix: `pnpm balance [income] [seeds] [flatPrice]`.
// Two scripted sides with the same income fight. Each side buys buildings in a fixed
// order (a strategy). Each pair plays from both sides, so the board has no favourite.
// flatPrice > 0 gives all buildings the same base price. When the belt is full, a building
// letter levels up the lowest building of that kind. Each side has WORKER.start workers.
// Player model: every QUIZ.every seconds each collected task pays TASK coins.
import { DT, KINDS, Kind, QUIZ, UNITS } from './config';
import { Sim } from './sim';

declare const process: { argv: string[] }; // no @types/node in this repo
const [income = 8, seeds = 4, flat = 0] = process.argv.slice(2).map(Number);
if (flat) for (const k of KINDS) UNITS[k].price = flat;

const K: Record<string, Kind> = { S: 'soldier', A: 'archer', G: 'general', W: 'siege' };
const STRATS = ['S', 'A', 'G', 'W', 'SA', 'SG', 'SW', 'AW', 'SAW', 'SAGW', 'SAWG'];
const MAX_T = 300, HP = 1000, TASK = 30;
const spent: Record<Kind, number> = { soldier: 0, archer: 0, general: 0, siege: 0, worker: 0 };
const castle = { ...spent }, units = { ...spent };
let steps = 0, unitSum = 0, unitPeak = 0; // units on the board, both sides
let games = 0, tasks = 0, broken = 0, simTime = 0;

// 1 = side 0 wins, 0 = side 1 wins, 0.5 = draw. At MAX_T the side with more castle HP wins.
function play(a: string, b: string, seed: number) {
  const sim = new Sim(1, seed);
  sim.ai = false;
  sim.income = income;
  for (const s of sim.sides) s.hp = s.maxHp = HP;
  const strat = [a, b], n = [0, 0];
  let quizAt = QUIZ.every;
  while (sim.winner === null && sim.time < MAX_T) {
    for (const side of [0, 1] as const) {
      const s = sim.sides[side], k = K[strat[side][n[side] % strat[side].length]];
      if (sim.time >= quizAt) { s.money += s.tasks * TASK; s.tasks = 0; }
      let ok = sim.buyBuilding(side, k);
      if (!ok && s.buildings.length >= 8) {
        const i = s.buildings.reduce((best, b, j) => (b.kind === k && (best < 0 || b.lvl < s.buildings[best].lvl) ? j : best), -1);
        ok = i < 0 || sim.levelUp(side, i) || s.buildings[i].lvl >= 3;
      }
      if (ok) n[side]++;
    }
    if (sim.time >= quizAt) quizAt += QUIZ.every;
    sim.step(DT);
    steps++;
    unitSum += sim.units.length;
    unitPeak = Math.max(unitPeak, sim.units.length);
  }
  games++;
  simTime += sim.time;
  for (const st of sim.stats) {
    tasks += st.tasks;
    broken += st.wallsBroken;
    for (const b of st.buys) spent[b.item.split(':')[0] as Kind] += b.price;
    for (const k of KINDS) { castle[k] += st.castleDmg[k]; units[k] += st.unitDmg[k]; }
  }
  const [h0, h1] = sim.sides.map((s) => s.hp);
  return sim.winner !== null ? 1 - sim.winner : h0 > h1 ? 1 : h0 < h1 ? 0 : 0.5;
}

const score = (a: string, b: string) => {
  let w = 0;
  for (let seed = 1; seed <= seeds; seed++) w += play(a, b, seed) + 1 - play(b, a, seed);
  return w / (2 * seeds);
};

console.log(`income ${income}/s, ${seeds} seeds x 2 sides, prices:`, KINDS.map((k) => `${k} ${UNITS[k].price}`).join(', '));
const M: number[][] = STRATS.map(() => STRATS.map(() => 0.5));
STRATS.forEach((a, i) => STRATS.forEach((b, j) => {
  if (j > i) { M[i][j] = score(a, b); M[j][i] = 1 - M[i][j]; }
}));
const pad = (s: string | number, n = 5) => String(s).padStart(n);
console.log('\nWin % of row vs column (S soldier, A archer, G general, W siege):');
console.log(pad('', 6) + STRATS.map((s) => pad(s)).join('') + pad('avg', 6));
M.forEach((row, i) => {
  const avg = row.reduce((x, y) => x + y, 0) / (row.length - 1) - 0.5 / (row.length - 1);
  const flag = row.every((v, j) => i === j || v > 0.5) ? '  <- beats all' : '';
  console.log(pad(STRATS[i], 6) + row.map((v) => pad(Math.round(v * 100))).join('') + pad(Math.round(avg * 100), 6) + flag);
});
console.log('\nPer 100 coins spent on the building, all games:');
console.log(pad('', 8) + pad('castle', 8) + pad('units', 8));
for (const k of KINDS)
  console.log(pad(k, 8) + pad(spent[k] ? (castle[k] / spent[k] * 100).toFixed(1) : '-', 8) + pad(spent[k] ? (units[k] / spent[k] * 100).toFixed(1) : '-', 8));
console.log(`\nUnits on the board: average ${Math.round(unitSum / steps)}, peak ${unitPeak}`);
console.log(`Tasks per side per minute: ${(tasks / 2 / (simTime / 60)).toFixed(1)}, wall segments broken per game: ${(broken / games).toFixed(1)} of 10`);
