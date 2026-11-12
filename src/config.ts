// All balance values live here. The simulation uses world units (board = 600 x 860),
// so the browser size never changes the physics.

export const W = 600;
export const H = 860;
export const DT = 1 / 120;

export type Kind = 'soldier' | 'archer' | 'general' | 'siege' | 'worker';
export const KINDS: Kind[] = ['soldier', 'archer', 'general', 'siege']; // the buildings in the shop
export type Side = 0 | 1; // 0 = player (top, falls down), 1 = enemy (bottom, falls up)

export const LEVELS = 10;

export const CFG = {
  gravity: 520 / 6, // a general's aura doubles it (GENERAL.boost)
  maxSpeed: 700,
  bounceSpeed: 190, // speed of both units after a hit between enemies, doubled in a general's aura
  minSideways: 0.55, // minimum |x| of the bounce direction, so units fly apart sideways
  hitCooldown: 0.4, // one pair of units deals damage once in this time
  restitution: 0.45, // pegs and walls
  pegJitter: 30, // random sideways kick on a peg hit
  beltX: 80,
  beltLen: 440,
  beltSpeed: 35,
  maxBuildings: 8,
  unitMaxAge: 40, // safety: a unit stuck for this long disappears
  playerCastleHp: 1000,
  enemyCastleHp: (lvl: number) => 500 + lvl * 150,
  income: (lvl: number) => [2, 3, 4, 5.5, 7, 8.5, 10, 12, 14, 16][lvl - 1], // coins/s for both sides
  // Enemy can buy these kinds from this level.
  enemyUnlock: { soldier: 1, archer: 2, general: 4, siege: 6 } as Record<string, number>,
  enemyUpgradesFrom: 3, // building levels, workers and wall repair
  zoneMult: [1, 2, 4, 2, 1],
  baseReward: 10,
  buildingPriceGrowth: 1.5,
  buildingMaxLvl: 3, // each level above 1 adds levelBonus to the production speed
  levelBonus: 0.5,
};

export interface UnitDef {
  name: string; // building name in the shop
  r: number;
  hp: number;
  hit: number; // damage to an enemy unit on contact
  castle: number; // damage to a castle (before the zone multiplier)
  interval: number; // production time of the building, seconds
  price: number; // base price of the building
}

export const UNITS: Record<Kind, UnitDef> = {
  soldier: { name: 'Koszary', r: 12, hp: 10, hit: 3, castle: 3, interval: 1, price: 150 },
  archer: { name: 'Strzelnica', r: 12, hp: 6, hit: 1, castle: 2, interval: 1.3, price: 150 },
  general: { name: 'Sztab', r: 12, hp: 8, hit: 0, castle: 1, interval: 2, price: 150 },
  siege: { name: 'Warsztat', r: 16, hp: 20, hit: 0, castle: 13, interval: 3, price: 150 },
  // The castle produces workers (WORKER), the shop has no building for them.
  worker: { name: 'Robotnik', r: 9, hp: 5, hit: 0, castle: 0, interval: 2, price: 100 },
};

export const ARCHER = { range: 110, cooldown: 1, damage: 2 };
// Allies in the aura (and the general) get gravity and bounce speed x boost and hit damage
// x hitMult. Auras do not stack.
export const GENERAL = { radius: 70, boost: 2, hitMult: 3 };
// Each worker the side owns sends one worker unit per UNITS.worker.interval seconds.
export const WORKER = { start: 1, max: 5 };
// Task points on the middle line. A worker that touches one gets a task for its side.
// The slots sit between the pegs. `active` points are on the board at a time.
export const POINTS = { y: H / 2, slots: [90, 150, 210, 390, 450, 510], active: 4, respawn: 2, r: 14 };
// Five wall segments in front of the castle zones. A wall bounces enemy units, hits them
// for `hit` and loses the unit's castle damage.
export const WALL = { hp: 60, hit: 3, repairPrice: 100 };

// The combo decides the question tier. Each tier lasts 3 correct answers.
export const TIER_LEN = 3;
export const TIER_MULT = [1, 3, 5, 7]; // tier 5: 10 + correct answers in tier 5
// Math rounds: the battle pauses while the child does the math.
export const QUIZ = {
  every: 10, // seconds of battle between rounds; a round has one question per collected task
  passive: 0.1, // coins per second for each correct answer in this level
  enemyTask: 20, // coins the enemy AI gets for each task
};

export const COLORS = {
  player: '#3B6FE0',
  enemy: '#E8743B',
  ink: '#1E2A44',
  bg: '#E9EEF6',
  line: '#7D879B',
  peg: '#3A4459',
  card: '#FFFFFF',
  shadow: '#D3D9E4',
  gold: '#7A5600',
  coin: '#F2B705',
  green: '#2E8B57',
  red: '#B3261E',
  purple: '#6A2FA0',
};
