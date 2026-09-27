import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menus } from "./runtime/ui/menus.js";
import "./reference-ui.css";

const screens = ["main", "title", "loadout", "setup", "settings", "howto", "credits", "pause", "results"];
const palettes = {
  original: ["#08cadd", "#ff3d5e"],
  alternate: ["#ff8a14", "#2f5bff"],
} as const;

/** The source menus consume injected sample data, independently of the 3D world. */
export default function UIGallery({ embed = false }: { embed?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const menus = useRef<Menus | null>(null);
  const [screen, setScreen] = useState("main");
  const [palette, setPalette] = useState<keyof typeof palettes>("original");
  const [commits, setCommits] = useState(0);
  const [result, setResult] = useState("Ready");

  useEffect(() => {
    const element = host.current!;
    let settings: Record<string, unknown> = {};
    let loadout = { weapon: "shooter" };
    let name = "Player";
    const showResults = () => {
      setResult("Counting…");
      controller.showResults(null);
      controller.show("results", { light: false });
    };
    const controller = new Menus(element, {
      getSettings: () => settings,
      setSettings: (patch: Record<string, unknown>) => { settings = { ...settings, ...patch }; },
      getLoadout: () => loadout,
      setLoadout: (patch: { weapon: string }) => { loadout = { ...loadout, ...patch }; },
      getProfile: () => ({ name }),
      setProfileName: (value: string) => { name = value; },
      onScreenChange: (value: string | null) => setScreen(value || "main"),
      onResultsComplete: () => { setResult("Complete"); setCommits((n) => n + 1); },
      startMatch: showResults,
      rematch: showResults,
      resumeMatch: () => controller.show("main", { light: false }),
      quitMatch: () => controller.show("main", { wipe: true }),
      toMainMenu: () => controller.show("main", { wipe: true }),
    });
    menus.current = controller;
    controller.setAccent(...palettes.original);
    controller.show("main");
    const keydown = (event: KeyboardEvent) => {
      // Native Tab reaches the source buttons and the lab toolbar.
      if (event.key !== "Tab" && controller.handleKey(event)) event.stopPropagation();
    };
    element.addEventListener("keydown", keydown);
    return () => {
      element.removeEventListener("keydown", keydown);
      controller.dispose();
      menus.current = null;
    };
  }, []);

  const show = (next: string) => {
    if (next === "results") { menus.current?.showResults(null); setResult("Counting…"); }
    menus.current?.show(next);
  };
  const transition = (mode: string) => {
    const controller = menus.current;
    if (!controller) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { controller.replay(); return; }
    controller.wipe.run({
      mode, a: palettes[palette][0], b: palettes[palette][1],
      onMid: () => controller.replay(),
    });
  };

  const stage = (
    <div
        className="ink-ui-stage"
        data-original-hud=""
        ref={host}
        tabIndex={-1}
        role="region"
        aria-label="INKWAVE source menu preview"
        onPointerDown={(event) => {
          if (!(event.target instanceof HTMLInputElement)) host.current?.focus({ preventScroll: true });
        }}
      />
  );

  return (
    <div className="ink-ui-workbench">
      {embed ? createPortal(stage, document.getElementById("lab-picture")!) : stage}
      <div className="ink-ui-toolbar" aria-label="UI experiment controls">
        <div className="ink-ui-tools">
          {!embed && <span className="ink-ui-reference">ORIGINAL UI <small>Sample game data</small></span>}
          <label>Screen
            <select aria-label="Preview screen" value={screen} onChange={(e) => show(e.target.value)}>
              {screens.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Palette
            <select aria-label="UI palette" value={palette} onChange={(e) => {
              const value = e.target.value as keyof typeof palettes;
              setPalette(value);
              const [a, b] = palettes[value];
              menus.current?.setAccent(a, b);
            }}>
              <option value="original">Cyan / Coral</option>
              <option value="alternate">Amber / Blue</option>
            </select>
          </label>
          <button onClick={() => menus.current?.replay()}>Replay entrance</button>
          <button onClick={() => transition("light")}>Light sweep</button>
          <button onClick={() => transition("full")}>Ink wipe</button>
          <button onClick={() => transition("fade")}>Fade</button>
        </div>
        <div className="ink-ui-tools ink-ui-timeline">
          <span aria-live="polite">{result}</span>
          <span>Completed sequences: {commits}</span>
          <button onClick={() => show("results")}>Play results</button>
          <button onClick={() => menus.current?.skipResults()}>Skip</button>
          <button onClick={() => { menus.current?.show("main", { light: false }); setResult("Cancelled"); }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
