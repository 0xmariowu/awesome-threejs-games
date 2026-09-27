import type { WebGLRenderer, Scene, PerspectiveCamera } from "three";
export type DemoKind =
  | "3c"
  | "materials"
  | "ui"
  | "paint"
  | "combat"
  | "ai"
  | "world"
  | "audio"
  | "diagnostics";
export class InkwaveDemo {
  constructor(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    kind: DemoKind,
  );
  [key: string]: any;
  init(): Promise<void>;
  frame(dt: number): void;
  snapshot(): Record<string, any>;
  dispose(): void;
}
