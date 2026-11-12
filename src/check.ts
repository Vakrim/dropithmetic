// Self-check: `pnpm check`. Fails loudly if question rules or the simulation break.
import { DT, QUIZ } from './config';
import { carries, makeQuestion, multOf, Quiz } from './quiz';
import { Sim } from './sim';
import { Game, inp } from './ui';

const fail = (m: string) => { throw new Error(m); };
const assert = {
  ok: (c: unknown, m = 'assert failed') => c || fail(m),
  equal: (a: unknown, b: unknown, m = '') => a === b || fail(`${m} ${a} !== ${b}`),
  deepEqual: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b) || fail(`${JSON.stringify(a)} != ${JSON.stringify(b)}`),
};

// Questions
assert.equal(carries(34, 12, '+', 2), false);
assert.equal(carries(77, 13, '+', 2), true);
assert.equal(carries(52, 17, '-', 2), true);
const evalQ = (t: string) => {
  const [a, op, b] = t.split(' ');
  const x = Number(a), y = Number(b);
  return op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y;
};
for (let tier = 0; tier < 5; tier++)
  for (let i = 0; i < 2000; i++) {
    const q = makeQuestion(tier);
    const [a, op, b] = q.text.split(' ');
    const x = Number(a), y = Number(b), o = op === '−' ? '-' : '+';
    assert.equal(evalQ(q.text), q.answer, q.text);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0, q.text);
    if (tier === 0) assert.ok(x <= 15 && y <= 15 && q.answer <= 15, q.text);
    if (tier === 1) assert.ok(x >= 10 && x <= 99 && y >= 10 && y <= 99 && !carries(x, y, o, 2), q.text);
    if (tier === 2) assert.ok(x >= 100 && y >= 100 && q.answer <= 999 && !carries(x, y, o, 3), q.text);
    if (tier === 3) assert.ok(x <= 99 && y >= 10 && q.answer <= 100 && carries(x, y, o, 2), q.text);
    if (tier === 4) assert.ok(op === '×' ? x <= 10 && y <= 10 : y <= 10 && q.answer <= 10, q.text);
  }
assert.deepEqual([0, 2, 3, 6, 9, 12, 13, 15].map(multOf), [1, 1, 3, 5, 7, 10, 11, 13]);
const quiz = new Quiz();
quiz.input = String(quiz.q.answer);
assert.equal(quiz.submit(), 10);
assert.equal(quiz.combo, 1);
quiz.input = String(quiz.q.answer + 1);
assert.equal(quiz.submit(), 0);
assert.equal(quiz.combo, 0);

// Simulation: same seed gives the same result, units reach castles, no NaN.
const run = (seed: number) => {
  const sim = new Sim(5, seed);
  sim.ai = false;
  for (const s of sim.sides) s.money = 600;
  for (const side of [0, 1] as const)
    for (const k of ['soldier', 'archer', 'general', 'siege'] as const) sim.buyBuilding(side, k);
  for (let i = 0; i < 120 * 120; i++) {
    sim.step(DT);
    for (const u of sim.units) assert.ok(Number.isFinite(u.x + u.y + u.vx + u.vy), 'NaN in unit');
  }
  return sim;
};
const a = run(42), b = run(42);
assert.deepEqual(a.sides.map((s) => s.hp), b.sides.map((s) => s.hp));
assert.ok(a.sides[0].hp < a.sides[0].maxHp && a.sides[1].hp < a.sides[1].maxHp, 'no castle damage');
console.log('ok', a.sides.map((s) => `${Math.round(s.hp)}/${s.maxHp}`).join(' '), 'units', a.units.length);

// Stats: castle damage in the counters matches the castle HP that was lost.
const sum = (r: Record<string, number>) => Object.values(r).reduce((x, y) => x + y, 0);
a.sides.forEach((s, side) => assert.equal(sum(a.stats[1 - side].castleDmg), s.maxHp - s.hp, 'castleDmg'));
assert.ok(a.stats[0].spent === 150 * 4 && a.stats[0].buys.length === 4, 'buys');
assert.equal(a.timeline.length, Math.floor(a.time / 5) + 1, 'timeline');

// No unit gets stuck: long battles with castles that cannot fall.
for (let seed = 1; seed <= 5; seed++) {
  const sim = new Sim(10, seed);
  sim.sides[0].money = 1e6;
  for (const k of ['soldier', 'archer', 'general', 'siege', 'soldier', 'siege'] as const) sim.buyBuilding(0, k);
  sim.sides[0].hp = sim.sides[1].hp = 1e9;
  for (let i = 0; i < 120 * 60; i++) sim.step(DT);
  assert.ok(sim.stats.every((st) => st.expired === 0), `unit removed by CFG.unitMaxAge, seed ${seed}`);
}

// Math rounds: start by themselves when tasks wait, pause the battle, a wrong answer uses up
// its task, the payout comes at the end, passive income runs only in the battle.
{
  const g = new Game(1);
  const s = g.sim.sides[0];
  g.sim.points.length = 0; // no task points, so the workers collect nothing
  const key = (...k: string[]) => { inp.keys.push(...k); g.update(0.01); inp.keys.length = 0; };
  const answer = (d = 0) => key(...String(g.quiz.q.answer + d), 'Enter');
  for (let i = 0; i < 1100; i++) g.update(0.01);
  assert.ok(!g.open && g.quizIn > 8, 'round without tasks');
  s.tasks = 3;
  for (let i = 0; i < 1000 && !g.open; i++) g.update(0.01);
  assert.ok(g.open && g.round === 3 && s.tasks === 0, 'round with tasks');
  const t = g.sim.time, m = s.money;
  answer(); answer(1);
  for (let i = 0; i < 100; i++) g.update(0.01);
  assert.equal(g.sim.time, t, 'battle runs in the modal');
  assert.ok(g.open && g.wrong !== null, 'round ended at the wrong answer');
  for (let i = 0; i < 60; i++) g.update(0.01);
  assert.ok(g.open && !g.wrong && g.quiz.combo === 0 && g.left === 1, 'next question after the wrong answer');
  assert.equal(s.money, m, 'paid before the end');
  answer();
  assert.ok(!g.open && g.pot === 0 && g.solved === 2 && g.quizIn > QUIZ.every - 0.1, 'round end');
  for (let i = 0; i < 100; i++) g.update(0.01);
  assert.ok(Math.abs(s.money - m - 20 - (g.sim.income + QUIZ.passive * 2) * (g.sim.time - t)) < 1e-6, 'payout and passive');
  // Leave early: the coins won so far are paid, the other tasks wait for the next round.
  s.tasks = 3;
  g.quizIn = 0.001;
  g.update(0.01);
  assert.ok(g.open && g.round === 3, 'second round');
  answer();
  const before = s.money, pot = g.pot;
  g.leave();
  assert.ok(!g.open && s.tasks === 2 && g.quiz.combo === 2 && pot > 0 && s.money === before + pot, 'leave');
}
console.log('ok rounds');
