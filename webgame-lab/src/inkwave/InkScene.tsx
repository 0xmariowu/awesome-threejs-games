import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { frameReadoutRows, parseEmbedParams } from "../embed";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { InkwaveDemo, type DemoKind } from "./runtime/demo.js";
import { chapters } from "./content";
import { setError, setInfo } from "../lab";
import UIGallery from "./UIGallery";
import "./inkwave.css";

/** Keep the existing fullscreen HUD only outside the library frame. */
function PanelHost({ children, embed }: { children: ReactNode; embed: boolean }) {
  const [portal] = useState(() => ({ current: embed ? document.getElementById("lab-controls")! : document.body }));
  // Html owns a DOM React root; a DOM portal directly from R3F uses the wrong renderer.
  return <Html portal={portal} fullscreen={!embed} wrapperClass={embed ? "lab-inline-html" : undefined}
    calculatePosition={(_, __, size) => embed ? [0, 0] : [size.width / 2, size.height / 2]}
    zIndexRange={[3, 3]} style={embed ? { display: "contents" } : { pointerEvents: "none" }}>{children}</Html>;
}

function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (b: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="ink-toggle">
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/** Presentation only: the original runtime snapshots and default HUD stay unchanged. */
function EmbedInkPerformance({ state, kind }: { state: Record<string, any>; kind: DemoKind }) {
  const rows: Record<string, unknown> = {
    'Frame P95': `${state.frameTimes?.p95Ms ?? '—'} ms`,
    Speed: state.speed, Ink: state.ink,
    Coverage: `${state.coverage?.map((n: number) => (n * 100).toFixed(1)).join(' / ') ?? '—'} %`,
    Draws: state.drawCalls, Actors: state.actors, Ticks: state.ticks,
  };
  if (kind === '3c') Object.assign(rows, {
    'Feet Y': state.motor?.y?.toFixed(3), 'Visual Y': state.motor?.visualY?.toFixed(3),
    'Jump buffer': `${((state.motor?.jumpBuffer || 0) * 1000).toFixed(0)} ms`,
    Coyote: `${((state.motor?.coyote || 0) * 1000).toFixed(0)} ms`,
    Feet: state.body?.feet?.map((f: any) => f.planted ? 'PLANT' : 'SWING').join(' / '),
    Cadence: state.body?.cad?.toFixed(2), Hip: state.body?.hipDrop,
    Boom: `${state.cameraRig?.arm?.toFixed(2) ?? '—'} / ${state.cameraRig?.wantedArm?.toFixed(2) ?? '—'} m`,
    'Landing dip': state.cameraRig?.landingDip?.toFixed(3),
  });
  if (kind === 'materials') Object.assign(rows, { Bake: `${state.ao?.bakeMs?.toFixed(0) ?? '—'} ms`, Atlas: `${state.ao?.atlas ?? '—'} px` });
  if (kind === 'paint' && state.probe) rows.Probe = {
    Owner: state.probe.owner, Speed: state.probe.speed.toFixed(2),
    HP: state.probe.hp.toFixed(1), Energy: state.probe.energy.toFixed(1),
  };
  if (kind === 'combat') rows.Events = state.events;
  if (kind === 'ai') rows.Goals = state.goalScores
    ? Object.fromEntries(state.goalScores.map((g: any) => [g.id, g.score.toFixed(2)]))
    : Object.fromEntries((state.botStates || []).map((b: any) => [b.name, `${b.mode} → ${b.goal} (${b.pathLength} nodes)`]));
  if (kind === 'world') rows.Props = state.propStats;
  if (kind === 'audio') rows.Audio = state.audio;
  if (kind === 'diagnostics') Object.assign(rows, {
    'Frame intervals': state.frameTimes, Triangles: state.triangles,
    Geometries: state.geometries, Textures: state.textures, Listeners: state.listeners,
    Dropped: `${state.droppedSeconds?.toFixed(3) ?? '—'} s`,
  });
  return createPortal(<dl className="lab-readouts">{frameReadoutRows(rows).map(([key, value]) =>
    <div key={key}><dt title={key}>{key}</dt><dd title={value}>{value}</dd></div>
  )}</dl>, document.getElementById('lab-performance')!);
}

export default function InkScene({ kind }: { kind: DemoKind }) {
  const { gl, scene, camera } = useThree(),
    demo = useRef<InkwaveDemo | null>(null);
  const [embed] = useState(() => parseEmbedParams(location.search).embed);
  const [ready, setReady] = useState(false),
    [state, setState] = useState<Record<string, any>>({}),
    [options, setOptions] = useState<Record<string, any>>({
      post: true,
      nav: kind === "ai",
      wire: false,
      auto: false,
      animation: true,
      footPlanting: true,
      stepSmoothing: true,
      feedback: true,
      paused: false,
    });
  const [error, setLocalError] = useState(""),
    [generation, setGeneration] = useState(0);
  const chapter = chapters[kind];
  useEffect(() => {
    setReady(false);
    setInfo("inkwave", { ready: false, frames: 0 });
    const d = new InkwaveDemo(gl, scene, camera as PerspectiveCamera, kind);
    demo.current = d;
    let alive = true;
    d.init()
      .then(() => {
        if (alive) {
          setReady(true);
          setInfo("inkwave", d.snapshot());
        }
      })
      .catch((e) => {
        if (alive) {
          setLocalError(String(e));
          setError(String(e));
        }
      });
    const poll = setInterval(() => {
      if (alive && d.ready) {
        const s = d.snapshot();
        setState(s);
        setInfo("inkwave", s);
      }
    }, 250);
    const paint = (e: PointerEvent) => {
      if (kind === "paint" && d.ready) d.paintAt(e.clientX, e.clientY);
    };
    gl.domElement.addEventListener("pointerdown", paint);
    return () => {
      alive = false;
      clearInterval(poll);
      gl.domElement.removeEventListener("pointerdown", paint);
      d.dispose();
      demo.current = null;
    };
  }, [gl, scene, camera, kind, generation]);
  useFrame((_, dt) => {
    try {
      demo.current?.frame(dt);
    } catch (e) {
      setError(String(e));
      setLocalError(String(e));
      if (demo.current) demo.current.clock.paused = true;
    }
  }, 1);
  const action = (f: (d: InkwaveDemo) => void) => {
    if (demo.current?.ready) {
      f(demo.current);
      const snapshot = demo.current.snapshot();
      setState(snapshot);
      setInfo("inkwave", snapshot);
    }
  };
  const toggle = (key: string, value: boolean) => {
    setOptions((o) => ({ ...o, [key]: value }));
    action((d) => {
      if (key === "nav") d.navDots.visible = value;
      else if (key === "wire") d.wire.visible = value;
      else if (key === "paused") d.clock.paused = value;
      else if (key === "feedback") {
        d.feedback = value;
        d.settings.cameraShake = value ? 1 : 0;
        d.fx.root.visible = value;
      } else d[key] = value;
    });
  };
  return (
    <PanelHost embed={embed}>
      <div className="ink-overlay">
        {!embed && <div className="ink-heading">
          <span>INKWAVE / TECH BREAKDOWN</span>
          <h1>{chapter.title}</h1>
          <p>{chapter.subtitle}</p>
        </div>
        }
        {kind === "ui" && ready && <UIGallery embed={embed} />}
        {!embed && ["3c", "combat", "diagnostics"].includes(kind) && (
          <div
            className={`ink-crosshair ${state.lastHit != null && state.time - state.lastHit < 0.3 ? "hit" : ""}`}
          >
            +
          </div>
        )}
        <aside className="ink-panel">
          {(!embed || !ready || error) && <div className="ink-status">
            {error ? "ERROR" : ready ? "LIVE LAB" : "BUILDING WORLD…"}{" "}
            <i className={ready ? "live" : ""} />
          </div>
          }
          {!embed && <p>{chapter.principle}</p>}
          <div key={generation} className="ink-controls" aria-label="Experiment controls">
            {["3c", "combat", "diagnostics"].includes(kind) && (
              <>
                <Toggle
                  label="Auto movement"
                  value={options.auto}
                  onChange={(v) => toggle("auto", v)}
                />
                <label>{embed ? <span className="lab-control-label" title="Camera">Camera</span> : "Camera"}<select
                    aria-label="Camera"
                    value={state.cameraMode || "tuned"}
                    onChange={(e) =>
                      action((d) => (d.cameraMode = e.target.value))
                    }
                  >
                    <option value="tuned">INKWAVE springs</option>
                    <option value="direct">Direct follow baseline</option>
                  </select>
                </label>
              </>
            )}
            {kind === "3c" && (
              <>
                <label>{embed ? <span className="lab-control-label" title="Character presentation">Character presentation</span> : "Character presentation"}<select aria-label="Character presentation" value={state.presentation || "source"} onChange={(e) => {
                    const value = e.target.value;
                    action(d => { void d.setPresentation(value).catch((e: unknown) => setLocalError(String(e))); });
                  }}>
                    <option value="source">INKWAVE procedural rig</option>
                    <option value="fox">Fox GLB · blended clips</option>
                  </select>
                </label>
                {state.presentation === "fox" && <small>Same motor and camera; Survey / Walk / Run clips. Foot IK and squid poses belong to the source rig.</small>}
                <div className="ink-actions">
                  {['tuned', 'baseline'].map(mode => <button key={mode} onClick={() => {
                    action(d => d.replayRoute(mode));
                    setOptions(o => ({...o, auto:false, footPlanting:mode === 'tuned', stepSmoothing:mode === 'tuned'}));
                  }}>{embed ? `Replay ${mode}` : `Replay ${mode} route`}</button>)}
                </div>
                {state.route && <small>{state.route.mode} · {state.route.complete ? 'Complete' : `${state.route.elapsed.toFixed(1)} / 5 s`} · max visual step {state.route.maxStepOffset.toFixed(3)} m</small>}
                {state.presentation === 'fox' && <small>Clip weights · idle {state.clipWeights?.idle.toFixed(2)} / walk {state.clipWeights?.walk.toFixed(2)} / run {state.clipWeights?.run.toFixed(2)}</small>}
                <div className="ink-actions">
                  {["start", "steps", "ramp", "wall", "edge"].map((x) => (
                    <button
                      key={x}
                      onClick={() => action((d) => d.checkpoint(x))}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                <Toggle
                  label="Foot planting / ground IK"
                  disabled={state.presentation === 'fox'}
                  value={options.footPlanting}
                  onChange={(v) => toggle("footPlanting", v)}
                />
                <Toggle
                  label="Visual step smoothing"
                  value={options.stepSmoothing}
                  onChange={(v) => toggle("stepSmoothing", v)}
                />
                <Toggle
                  label="Procedural animation"
                  disabled={state.presentation === 'fox'}
                  value={options.animation}
                  onChange={(v) => toggle("animation", v)}
                />
                <label>{embed ? <span className="lab-control-label" title="Movement speed">Movement speed</span> : "Movement speed"}<input
                    aria-label="Movement speed"
                    type="range"
                    min="2"
                    max="12"
                    defaultValue="6"
                    onChange={(e) =>
                      action(
                        (d) => (d.preset.PLAYER.runSpeed = +e.target.value),
                      )
                    }
                  />
                </label>
                {!embed && <details open>
                  <summary>3C · live pipeline</summary>
                  <div className="ink-chain">
                    <b>1 · actor.js</b>
                    <span>
                      Feet Y {state.motor?.y.toFixed(3)} → visual Y{" "}
                      {state.motor?.visualY.toFixed(3)}
                    </span>
                    <span>
                      Buffer{" "}
                      {((state.motor?.jumpBuffer || 0) * 1000).toFixed(0)} ms ·
                      Coyote {((state.motor?.coyote || 0) * 1000).toFixed(0)} ms
                    </span>
                    <b>2 · character.js</b>
                    <span>
                      Feet{" "}
                      {state.body?.feet
                        ?.map((f: any) => (f.planted ? "PLANT" : "SWING"))
                        .join(" / ")}
                    </span>
                    <span>
                      Cadence {state.body?.cad?.toFixed(2)} · Hip{" "}
                      {state.body?.hipDrop}
                    </span>
                    <b>3 · cameraRig.js</b>
                    <span>
                      Boom {state.cameraRig?.arm.toFixed(2)} /{" "}
                      {state.cameraRig?.wantedArm.toFixed(2)} m
                    </span>
                    <span>
                      Landing dip {state.cameraRig?.landingDip.toFixed(3)}
                    </span>
                  </div>
                </details>}
                <button onClick={() => action((d) => d.input.requestLock())}>
                  {embed ? "Capture mouse" : "Capture mouse · Esc exits"}
                </button>
              </>
            )}
            {kind === "materials" && (
              <>
                <label>{embed ? <span className="lab-control-label" title="Contact shading">Contact shading</span> : "Contact shading"}<select aria-label="Contact shading" value={state.ao?.mode || 'baked'} onChange={e => action(d => d.setAO(e.target.value))}>
                    <option value="none">No AO</option>
                    <option value="baked">Baked static AO</option>
                    <option value="realtime">Realtime GTAO</option>
                  </select>
                </label>
                <small>Same geometry, camera and light. Bake: {state.ao?.bakeMs?.toFixed(0)} ms once · {state.ao?.atlas}px atlas. Realtime AO adds render passes.</small>
                <label>{embed ? <span className="lab-control-label" title="Light">Light</span> : "Light"}<select
                    aria-label="Light"
                    onChange={(e) =>
                      action((d) => {
                        d.environment.setTheme(e.target.value);
                        d.fx.setLighting(d.environment.getSkyColors());
                      })
                    }
                  >
                    <option value="day">Day</option>
                    <option value="sunset">Sunset</option>
                  </select>
                </label>
                <Toggle
                  label="HDR bloom + color grade"
                  value={options.post}
                  onChange={(v) => toggle("post", v)}
                />
                <label>{embed ? <span className="lab-control-label" title="Dry surface roughness">Roughness</span> : "Dry surface roughness"}<input
                    aria-label="Dry surface roughness"
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    defaultValue=".82"
                    onChange={(e) =>
                      action((d) => (d.material.roughness = +e.target.value))
                    }
                  />
                </label>
              </>
            )}
            {["materials", "paint"].includes(kind) && (
              <>
                <button onClick={() => action((d) => d.stamp())}>
                  Add coating
                </button>
                <button onClick={() => action((d) => d.paint.clear())}>
                  Clear coating
                </button>
              </>
            )}
            {kind === "paint" && (
              <>
                <label>{embed ? <span className="lab-control-label" title="Coating">Coating</span> : "Coating"}<select
                    aria-label="Coating"
                    onChange={(e) =>
                      action((d) => (d.stampTeam = +e.target.value))
                    }
                  >
                    <option value="0">Orange / owner A</option>
                    <option value="1">Blue / owner B</option>
                  </select>
                </label>
                <label>{embed ? <span className="lab-control-label" title="Rule policy">Rule policy</span> : "Rule policy"}<select
                    aria-label="Rule policy"
                    onChange={(e) => action((d) => (d.policy = e.target.value))}
                  >
                    <option value="turf">Territory / swim + refill</option>
                    <option value="hazard">Hazard / slow + damage</option>
                    <option value="boost">Race track / boost + brake</option>
                    <option value="recovery">Recovery / heal + recharge</option>
                  </select>
                </label>
                <div className="ink-actions">
                  <button onClick={() => action(d => { d.probe.hp = 35; d.probe.energy = 10; })}>{embed ? "Drain reserves" : "Drain probe reserves"}</button>
                  <button onClick={() => action(d => {
                    for (let x = -9; x < 10; x += 2) d.paint.splat({x,y:0,z:-8}, 1.5, d.stampTeam || 0, {instant:true});
                  })}>Paint probe lane</button>
                </div>
                {!embed && <pre>
                  {JSON.stringify(
                    state.probe
                      ? {
                          owner: state.probe.owner,
                          speed: state.probe.speed.toFixed(2),
                          hp: state.probe.hp.toFixed(1),
                          energy: state.probe.energy.toFixed(1),
                        }
                      : {},
                    null,
                    2,
                  )}
                </pre>}
                <small>
                  The moving sphere queries real painted cells. Drips are
                  cosmetic; scoring uses CPU cells.
                </small>
              </>
            )}
            {kind === "combat" && (
              <>
                <div className="ink-actions">
                  {['impact', 'charged', 'nova'].map(name => <button key={name} onClick={() => action(d => d.playSkill(name))}>Play {name}</button>)}
                  <button onClick={() => action(d => d.skill.cancel())}>Cancel skill</button>
                </div>
                {['particles', 'camera', 'sound'].map(layer => <Toggle key={layer} label={`Skill ${layer}`} value={state.feedbackLayers?.[layer] ?? true} onChange={v => action(d => { d.feedbackLayers[layer] = v; })} />)}
                <small>{state.skill?.name || 'No recipe'} · {state.skill?.active ? 'Playing' : 'Ready'} · {state.skill?.next || 0} cues. Skill recipes are presentation only; weapons below drive gameplay.</small>
                <label>{embed ? <span className="lab-control-label" title="Weapon">Weapon</span> : "Weapon"}<select
                    aria-label="Weapon"
                    onChange={(e) =>
                      action((d) => d.local.setWeapon(e.target.value))
                    }
                  >
                    {["shooter", "roller", "charger", "blaster"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <Toggle
                  label="Impact feedback"
                  value={options.feedback}
                  onChange={(v) => toggle("feedback", v)}
                />
                <button onClick={() => action((d) => d.burst())}>
                  Impact pulse
                </button>
                <button onClick={() => action((d) => d.enableAudio())}>
                  Enable sound
                </button>
                {!embed && <pre>
                  {Object.entries(state.events || {})
                    .map(([key, n]) => `${key}: ${n}`)
                    .slice(-8)
                    .join("\n")}
                </pre>}
              </>
            )}
            {kind === "ai" && (
              <>
                <label>{embed ? <span className="lab-control-label" title="Goal policy">Goal policy</span> : "Goal policy"}<select
                    aria-label="Goal policy"
                    onChange={(e) =>
                      action((d) => (d.goalPolicy = e.target.value))
                    }
                  >
                    <option value="turf">Original turf combat</option>
                    <option value="rescue">Rescue / no weapons</option>
                  </select>
                </label>
                {!embed && <pre>
                  {state.goalScores
                    ? JSON.stringify(
                        state.goalScores.map((g: any) => ({
                          id: g.id,
                          score: g.score.toFixed(2),
                        })),
                        null,
                        2,
                      )
                    : state.botStates
                        ?.map(
                          (b: any) =>
                            `${b.name}: ${b.mode} → ${b.goal} (${b.pathLength} nodes)`,
                        )
                        .join("\n")}
                </pre>}
              </>
            )}
            {["ai", "world"].includes(kind) && (
              <Toggle
                label="Navigation samples"
                value={options.nav}
                onChange={(v) => toggle("nav", v)}
              />
            )}
            {kind === "world" && (
              <>
                <Toggle
                  label="Structural wireframe"
                  value={options.wire}
                  onChange={(v) => toggle("wire", v)}
                />
                <button
                  onClick={() =>
                    action((d) => {
                      d.seed++;
                      d.buildProps();
                      setInfo("inkwaveSeed", d.seed);
                    })
                  }
                >
                  Next prop seed
                </button>
                {!embed && <pre>{JSON.stringify(state.propStats, null, 2)}</pre>}
                <small>
                  Seed {state.seed}. Decorative props are shown without
                  colliders in this gallery.
                </small>
              </>
            )}
            {kind === "audio" && (
              <>
                <button onClick={() => action((d) => d.enableAudio())}>
                  Enable audio
                </button>
                <div className="ink-actions">
                  {["shoot_shooter", "bomb_explode", "swim", "ui_confirm"].map(
                    (x) => (
                      <button key={x} onClick={() => action((d) => d.sound(x))}>
                        {x}
                      </button>
                    ),
                  )}
                </div>
                <label>{embed ? <span className="lab-control-label" title="Score">Score</span> : "Score"}<select
                    aria-label="Score"
                    defaultValue=""
                    onChange={(e) =>
                      action((d) => d.music(e.target.value || null))
                    }
                  >
                    <option value="">Silent</option>
                    {[
                      "title",
                      "menu",
                      "battle",
                      "battle_final",
                      "results_win",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>{embed ? <span className="lab-control-label" title="Intensity">Intensity</span> : "Intensity"}<input
                    aria-label="Music intensity"
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    defaultValue=".5"
                    onChange={(e) =>
                      action((d) => {
                        d.enableAudio();
                        d.audio.music.setIntensity(+e.target.value);
                      })
                    }
                  />
                </label>
                <button
                  onClick={() =>
                    action((d) => {
                      d.enableAudio();
                      d.audio.duck(0.75, 1.2);
                      d.audio.play("ui_confirm");
                    })
                  }
                >
                  {embed ? "Duck music" : "Duck music for cue"}
                </button>
                <button
                  onClick={() =>
                    action((d) => {
                      d.audio?.stopAll();
                      d.audio?.music.stop(0.2);
                    })
                  }
                >
                  Stop sound
                </button>
                {!embed && <pre>{JSON.stringify(state.audio, null, 2)}</pre>}
              </>
            )}
            {kind === "diagnostics" && (
              <>
                {!embed && <pre>{`Frame intervals · last ${state.frameTimes?.samples || 0} frames\nMedian ${state.frameTimes?.medianMs || 0} ms\nP95 ${state.frameTimes?.p95Ms || 0} ms\nMax ${state.frameTimes?.maxMs || 0} ms\nPresentation timing, not GPU execution time.`}</pre>}
                <Toggle
                  label="Pause simulation"
                  value={options.paused}
                  onChange={(v) => toggle("paused", v)}
                />
                <button
                  onClick={() =>
                    action((d) => {
                      d.clock.paused = true;
                      setOptions((o) => ({ ...o, paused: true }));
                      d.clock.step((h: number) => d.tick(h));
                    })
                  }
                >
                  {embed ? "Step · 8.33 ms" : "Single step · 8.33 ms"}
                </button>
                <label>{embed ? <span className="lab-control-label" title="Time scale">Time scale</span> : "Time scale"}<input
                    aria-label="Time scale"
                    type="range"
                    min=".1"
                    max="2"
                    step=".1"
                    defaultValue="1"
                    onChange={(e) =>
                      action((d) => (d.timeScale = +e.target.value))
                    }
                  />
                </label>
                <label>{embed ? <span className="lab-control-label" title="Actor count">Actor count</span> : "Actor count"}<select
                    aria-label="Actor count"
                    defaultValue="3"
                    onChange={(e) =>
                      action((d) => d.setActorCount(+e.target.value))
                    }
                  >
                    {[1, 3, 6, 12, 24].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => {
                    setOptions({
                      post: true,
                      nav: false,
                      wire: false,
                      auto: false,
                      animation: true,
                      footPlanting: true,
                      stepSmoothing: true,
                      feedback: true,
                      paused: false,
                    });
                    setInfo("inkwave", { ready: false, frames: 0 });
                    setGeneration((g) => g + 1);
                  }}
                >
                  {embed ? "Rebuild world" : "Dispose & rebuild world"}
                </button>
              </>
            )}
            <button onClick={() => action((d) => d.reset())}>
              Reset simulation
            </button>
          </div>
          {!embed && <details>
            <summary>Reuse boundary</summary>
            <p>{chapter.reuse}</p>
            <p>
              Source: INKWAVE 11ce485 · MIT. Classic WebGL shaders. General
              policies in systems.ts; reference assets in runtime/.
            </p>
          </details>
          }
          {error && <pre role="alert">{error}</pre>}
        </aside>
        {embed ? <EmbedInkPerformance state={state} kind={kind} /> : <footer className="ink-footer">
          {!embed && <p>{chapter.controls}</p>}
          <div className="ink-metrics">
            <span>Frame P95 <b>{state.frameTimes?.p95Ms ?? '—'} ms</b></span>
            <span>
              Speed <b>{state.speed ?? "—"}</b>
            </span>
            <span>
              Ink <b>{state.ink ?? "—"}</b>
            </span>
            <span>
              Coverage{" "}
              <b>
                {state.coverage
                  ?.map((v: number) => (v * 100).toFixed(1))
                  .join(" / ") ?? "—"}
                %
              </b>
            </span>
            <span>
              Draws <b>{state.drawCalls ?? "—"}</b>
            </span>
            <span>
              Actors <b>{state.actors ?? "—"}</b>
            </span>
            <span>
              Ticks <b>{state.ticks ?? "—"}</b>
            </span>
          </div>
          {kind === "diagnostics" && (
            <small>
              Triangles {state.triangles} · Geometries {state.geometries} ·
              Textures {state.textures} · Listeners {state.listeners} · Dropped{" "}
              {state.droppedSeconds?.toFixed(3)} s
            </small>
          )}
        </footer>}
      </div>
    </PanelHost>
  );
}
