import { CFG, TIER_LEN, TIER_MULT } from './config';

export interface Question {
  text: string;
  answer: number;
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const digits = (n: number, len: number) => Array.from({ length: len }, (_, i) => Math.floor(n / 10 ** i) % 10);

// True if a column addition (or subtraction) needs a carry (or a borrow).
export function carries(a: number, b: number, op: '+' | '-', len: number): boolean {
  const da = digits(a, len), db = digits(b, len);
  return da.some((d, i) => (op === '+' ? d + db[i] >= 10 : d < db[i]));
}

function addSub(min: number, max: number, wantCarry: boolean | null, maxSum: number): Question {
  const len = String(max).length;
  for (;;) {
    const op = Math.random() < 0.5 ? '+' : '-';
    let a = rnd(min, max), b = rnd(min, max);
    if (op === '-' && b > a) [a, b] = [b, a];
    if (op === '+' && a + b > maxSum) continue;
    if (op === '-' && a === b) continue;
    if (wantCarry !== null && carries(a, b, op, len) !== wantCarry) continue;
    return { text: `${a} ${op === '+' ? '+' : '−'} ${b}`, answer: op === '+' ? a + b : a - b };
  }
}

function mulDiv(): Question {
  const a = rnd(1, 10), b = rnd(1, 10);
  return Math.random() < 0.5
    ? { text: `${a} × ${b}`, answer: a * b }
    : { text: `${a * b} : ${a}`, answer: b };
}

export function makeQuestion(tier: number): Question {
  switch (tier) {
    case 0: return addSub(1, 15, null, 15);
    case 1: return addSub(10, 99, false, 99);
    case 2: return addSub(100, 999, false, 999);
    case 3: return addSub(10, 99, true, 100);
    default: return mulDiv();
  }
}

export const tierOf = (combo: number) => Math.min(4, Math.floor(combo / TIER_LEN));
export const multOf = (combo: number) => (tierOf(combo) < 4 ? TIER_MULT[tierOf(combo)] : 10 + combo - 4 * TIER_LEN);

export class Quiz {
  combo = 0;
  q: Question = makeQuestion(0);
  input = '';

  get tier() { return tierOf(this.combo); }
  get reward() { return CFG.baseReward * multOf(this.combo); }

  next() {
    let q: Question;
    do q = makeQuestion(this.tier); while (q.text === this.q.text);
    this.q = q;
    this.input = '';
  }

  // Returns the coins won (0 for a wrong answer).
  submit(): number {
    if (this.input === '') return -1;
    const ok = Number(this.input) === this.q.answer;
    const won = ok ? this.reward : 0;
    this.combo = ok ? this.combo + 1 : 0;
    return won;
  }
}
