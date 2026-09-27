import { Simulation } from './simulation';
const KEY = 'cloudkeep.save.v1';
export function loadGame(): Simulation | null {
  try { const raw = localStorage.getItem(KEY); return raw ? Simulation.restore(JSON.parse(raw)) : null; }
  catch { return null; }
}
export function saveGame(game: Simulation): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(game.snapshot())); return true; }
  catch { return false; }
}
