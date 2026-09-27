import { InkWipe } from "./menu-art.js";
export class Menus {
  constructor(root: HTMLElement, api?: Record<string, unknown>);
  current: string | null;
  wipe: InkWipe;
  show(name: string | null, opts?: { force?: boolean; wipe?: boolean; light?: boolean; instantLeave?: boolean }): void;
  showResults(data: Record<string, unknown> | null): void;
  setAccent(a: string, b: string): void;
  handleKey(event: KeyboardEvent): boolean;
  skipResults(): void;
  replay(): void;
  dispose(): void;
}
