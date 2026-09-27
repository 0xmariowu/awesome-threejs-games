import { Simulation, vec, type Species } from '../original/simulation';

// Only initial conditions differ from the full game. All behavior stays in Simulation.
export function createFixture() {
  const sim = new Simulation();
  sim.creatures = [];
  const residents: [Species, number, number, number][] = [
    ['ray', -5, 22, 16], ['ray', 5, 22, 14],
    ['koi', 15, 19, 5], ['koi', 23, 20, 9],
    ['moth', -18, 27, 0], ['moth', -27, 28, 5],
    ['whale', 0, 30, -12],
    ['jelly', -25, 16, 27], ['jelly', 27, 25, -14],
  ];
  for (const [species, x, y, z] of residents) sim.addCreature(species, vec(x, y, z));
  return sim;
}
