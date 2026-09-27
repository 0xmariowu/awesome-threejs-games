// astro.js
const SYN = 29.530589;
const DRAC = 27.212221;
const ANOM = 27.554550;
const TROP = 365.24219;
const ANOM_YEAR = 365.259636;
const SAROS = 223;

const mod = (a, n) => ((a % n) + n) % n;
const nodeDist = (F) => { const a = mod(F, 180); return Math.min(a, 180 - a); };

const F_PER_MONTH = 360 * (SYN / DRAC);
const F0 = 3.2;

const LUNAR_LIM = 15.4, SOLAR_N = 13.8, SOLAR_S = 8.4;

function eclipseTable(n = SAROS + 1, F0v = F0) {
  const out = [];
  for (let m = 0; m < n; m++) {
    const Fnew = F0v + m * F_PER_MONTH;
    const Ffull = Fnew + F_PER_MONTH / 2;
    const north = mod(Fnew, 360) < 180;
    out.push({ solar: nodeDist(Fnew) < (north ? SOLAR_N : SOLAR_S), lunar: nodeDist(Ffull) < LUNAR_LIM });
  }
  return out;
}

const PIN_RHO = 0.0096, PIN_DELTA = 0.0011;
function pinSlot(aRad, rho = PIN_RHO, delta = PIN_DELTA) {
  return Math.atan2(rho * Math.sin(aRad), rho * Math.cos(aRad) - delta);
}

const PLANETS = [
  { name: 'Mercury', a: 0.387, P: 87.969, L0: 252.25 },
  { name: 'Venus', a: 0.723, P: 224.701, L0: 181.98 },
  { name: 'Mars', a: 1.524, P: 686.98, L0: 355.45 },
  { name: 'Jupiter', a: 5.203, P: 4332.59, L0: 34.40 },
  { name: 'Saturn', a: 9.537, P: 10759.22, L0: 49.94 },
];
const EARTH = { a: 1.0, P: 365.256, L0: 100.46 };
const EPOCH_DAYS = -804700;

function helio(p, days) {
  const L = ((p.L0 + (360 * days) / p.P) * Math.PI) / 180;
  return [p.a * Math.cos(L), p.a * Math.sin(L)];
}

function skyState(months) {
  const days = EPOCH_DAYS + months * SYN;
  const e = helio(EARTH, days);
  const sunMean = mod((Math.atan2(-e[1], -e[0]) * 180) / Math.PI, 360);
  const Msun = mod(357.5 + (360 * days) / ANOM_YEAR, 360);
  const sun = mod(sunMean + 1.915 * Math.sin((Msun * Math.PI) / 180), 360);
  const elong = mod(360 * months, 360);
  const meanMoon = mod(sunMean + elong, 360);
  const anomalyRad = ((mod(40 + (360 * days) / ANOM, 360)) * Math.PI) / 180;
  const eqn = ((pinSlot(anomalyRad) - anomalyRad) * 180) / Math.PI;
  const moon = mod(meanMoon + eqn, 360);
  const planets = PLANETS.map((p) => {
    const h = helio(p, days);
    return mod((Math.atan2(h[1] - e[1], h[0] - e[0]) * 180) / Math.PI, 360);
  });
  const node = mod(125.04 - (360 * days) / 6798.38, 360);
  return {
    days, sun, sunMean, moon, meanMoon, elong, phase: elong / 360,
    anomaly: anomalyRad, lunarEquation: eqn, planets, node,
    years: (months * SYN) / TROP,
  };
}

PLANETS.map((p) => p.name);

