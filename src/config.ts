// All balance values live here. The simulation uses world units (board = 600 x 860),
// so the browser size never changes the physics.

export const W = 600;
export const H = 860;
export const DT = 1 / 120;

export type Kind = 'soldier' | 'archer' | 'monk' | 'siege';
export const KINDS: Kind[] = ['soldier', 'archer', 'monk', 'siege'];
export type Side = 0 | 1; // 0 = player (top, falls down), 1 = enemy (bottom, falls up)

export const LEVELS = 10;

export const CFG = {
  gravity: 520,
  maxSpeed: 700,
  bounceSpeed: 380, // speed of both units after a hit between enemies
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
  enemyIncome: (lvl: number) => [2, 3, 4, 5.5, 7, 8.5, 10, 12, 14, 16][lvl - 1],
  // Enemy can buy these kinds from this level.
  enemyUnlock: { soldier: 1, archer: 2, monk: 4, siege: 6 } as Record<Kind, number>,
  enemyUpgradesFrom: 3,
  zoneMult: [1, 2, 4, 2, 1],
  baseReward: 10,
  buildingPriceGrowth: 1.5,
  upgradePriceGrowth: 2,
  upgradeMax: 5,
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
  soldier: { name: 'Koszary', r: 12, hp: 30, hit: 10, castle: 10, interval: 3, price: 50 },
  archer: { name: 'Strzelnica', r: 12, hp: 18, hit: 3, castle: 5, interval: 4, price: 150 },
  monk: { name: 'Klasztor', r: 12, hp: 24, hit: 0, castle: 2, interval: 6, price: 400 },
  siege: { name: 'Warsztat', r: 16, hp: 60, hit: 0, castle: 40, interval: 9, price: 900 },
};

export const ARCHER = { range: 110, rangePerLvl: 25, cooldown: 1, damage: 5 };
export const MONK = { radius: 70, heal: 5, healPerLvl: 0.4 };
export const HP_PER_LVL = 0.25; // soldier and archer
export const SIEGE_DMG_PER_LVL = 0.35;

export const UPGRADES = [
  { name: 'Życie żołnierzy i łuczników', price: 80 },
  { name: 'Zasięg łuczników', price: 100 },
  { name: 'Leczenie mnichów', price: 120 },
  { name: 'Siła machin', price: 150 },
];

// The combo decides the question tier. Each tier lasts 3 correct answers.
export const TIER_LEN = 3;
export const TIER_MULT = [1, 3, 5, 7]; // tier 5: 10 + correct answers in tier 5
// Simulation speed per tier: a high combo slows the battle, so the child can focus on the math.
export const TIER_SPEED = [1, 0.85, 0.7, 0.55, 0.4];
export const SPEED_EASE = 2; // per second: how fast the speed moves to the new value

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
