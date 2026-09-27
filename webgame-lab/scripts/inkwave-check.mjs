// Requires the local Vite server. Evidence is written outside the repository.
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const evidence = process.env.INKWAVE_EVIDENCE_DIR || "/tmp/webgame-lab-inkwave";
const baseUrl = process.env.INKWAVE_LAB_URL || "http://127.0.0.1:5199";
const headed = process.env.INKWAVE_HEADED === "1";
await fs.mkdir(evidence, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: !headed,
  args: ["--enable-gpu", "--use-angle=metal", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1535, height: 909 },
  deviceScaleFactor: 2,
});
const results = [];
let errors = [],
  warnings = [],
  failures = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text());
  if (m.type() === "warning") warnings.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() });
});
const state = () => page.evaluate(() => window.__LAB__?.info?.inkwave);
async function boot(kind) {
  errors = [];
  warnings = [];
  await page.goto(
    `${baseUrl}/?scene=inkwave-${kind}&backend=webgl&panel=0&menu=1`,
  );
  await page.waitForFunction(
    () => window.__LAB__?.info?.inkwave?.frames > 30 || window.__LAB__?.error,
    null,
    { timeout: 60000 },
  );
  assert.equal(await page.evaluate(() => window.__LAB__.error), null);
}
async function check(kind, test) {
  if (process.argv.length > 2 && !process.argv.slice(2).includes(kind)) return;
  console.log("START", kind);
  page.setDefaultTimeout(10000);
  try {
    await boot(kind);
    const detail = await test();
    const end = await state();
    assert.equal(await page.evaluate(() => window.__LAB__.error), null);
    assert.equal(errors.length, 0, errors.join("\n"));
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${evidence}/${kind}.png` });
    results.push({
      kind,
      pass: true,
      detail,
      end,
      warnings: [...new Set(warnings)],
    });
    console.log("PASS", kind, JSON.stringify(detail));
  } catch (e) {
    await page.screenshot({ path: `${evidence}/${kind}-failure.png` });
    results.push({
      kind,
      pass: false,
      error: e.message,
      state: await state(),
      errors,
      uiScreen: await page.evaluate(() => document.querySelector('.iw-ui')?.dataset.screen ?? null),
    });
    console.log("FAIL", kind, e.stack);
  }
}
try {
  await check("3c", async () => {
    const before = await state();
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(700);
    const moving = await state();
    await page.keyboard.up("KeyW");
    assert(moving.position[2] > before.position[2] + 2);
    assert(moving.speed > 5);
    await page.keyboard.down("Space");
    await page.waitForTimeout(230);
    const jumping = await state();
    await page.keyboard.up("Space");
    assert(jumping.events["actor:jump"] > 0);
    await page.getByRole("button", { name: "steps", exact: true }).click();
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1000);
    await page.keyboard.up("KeyW");
    await page.waitForTimeout(300);
    const steps = await state();
    assert(steps.position[1] >= 0.49);
    await page.getByLabel("Foot planting / ground IK").uncheck();
    await page.getByLabel("Camera", { exact: true }).selectOption("direct");
    await page.waitForTimeout(300);
    assert.equal((await state()).cameraMode, "direct");
    await page.getByRole("button", { name: "wall", exact: true }).click();
    await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1700);
    const climbing = await state();
    await page.keyboard.up("KeyW");
    await page.keyboard.up("ShiftLeft");
    assert(
      climbing.position[1] > 0.4 || climbing.events["actor:climb:start"] > 0,
    );
    await page.getByRole('button',{name:'start',exact:true}).click();
    await page.getByLabel('Character presentation').selectOption('fox');
    await page.waitForFunction(()=>window.__LAB__.info.inkwave.presentation === 'fox');
    await page.getByRole('button',{name:'Replay tuned route',exact:true}).click();
    await page.waitForTimeout(1000);
    const fox = await state();
    assert(fox.clipWeights.run > .5, 'GLB locomotion must respond to actual motor speed');
    await page.screenshot({path:`${evidence}/3c-fox.png`});
    await page.waitForFunction(()=>window.__LAB__.info.inkwave.route?.mode === 'tuned' && window.__LAB__.info.inkwave.route.complete);
    const tunedRoute = (await state()).route;
    await page.getByRole('button',{name:'Replay baseline route',exact:true}).click();
    await page.waitForFunction(()=>window.__LAB__.info.inkwave.route?.mode === 'baseline' && window.__LAB__.info.inkwave.route.complete);
    const baselineRoute = (await state()).route;
    assert(tunedRoute.maxStepOffset > .05);
    assert.equal(baselineRoute.maxStepOffset, 0);
    assert.equal(await page.getByLabel('Camera',{exact:true}).inputValue(),'direct');
    await page.getByLabel('Character presentation').selectOption('source');
    return {
      glbWeights:fox.clipWeights, tunedRoute, baselineRoute,
      move: moving.position,
      jumpEvents: jumping.events["actor:jump"],
      steps: steps.position,
      climb: climbing.position,
      form: climbing.form,
    };
  });
  await check("materials", async () => {
    for (const mode of ['none','baked','realtime']) {
      await page.getByLabel('Contact shading').selectOption(mode);
      await page.waitForFunction(mode=>window.__LAB__.info.inkwave.ao.mode === mode,mode);
      await page.waitForTimeout(500);
      assert((await state()).ao.rays > 1000);
      await page.screenshot({path:`${evidence}/materials-ao-${mode}.png`});
    }
    await page.setViewportSize({width:1280,height:800});
    await page.waitForTimeout(300);
    assert.equal((await state()).ao.mode,'realtime');
    await page.setViewportSize({width:1535,height:909});
    await page.getByLabel('Contact shading').selectOption('baked');
    await page.getByLabel("Light", { exact: true }).selectOption("sunset");
    await page.getByLabel("HDR bloom + color grade").uncheck();
    await page.getByRole("button", { name: "Add coating" }).click();
    await page.waitForTimeout(400);
    const s = await state();
    assert.equal(s.post, false);
    assert.equal(s.theme, "sunset");
    assert(s.paintVersion > 11);
    return { theme: s.theme, layers: s.textureLayers, post: s.post, ao:s.ao };
  });
  await check("paint", async () => {
    await page.getByLabel("Rule policy").selectOption("hazard");
    await page.getByRole("button", { name: "Reset simulation" }).click();
    const samples = [];
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(250);
      samples.push((await state()).probe);
    }
    assert(
      samples.some((p) => p.owner === 1 && Math.abs(p.speed - 1.05) < 1e-6),
    );
    assert(samples.some((p) => p.hp < 99));
    await page.getByRole('button',{name:'Paint probe lane',exact:true}).click();
    await page.getByLabel('Rule policy').selectOption('boost');
    await page.waitForFunction(()=>window.__LAB__.info.inkwave.probe.speed === 7.5);
    const boost = (await state()).probe;
    await page.getByRole('button',{name:'Reset simulation',exact:true}).click();
    await page.getByRole('button',{name:'Paint probe lane',exact:true}).click();
    await page.getByLabel('Rule policy').selectOption('recovery');
    await page.getByRole('button',{name:'Drain probe reserves',exact:true}).click();
    await page.waitForTimeout(600);
    const recovery = (await state()).probe;
    assert(recovery.hp > 35 && recovery.hp < 60 && recovery.energy > 10 && recovery.energy < 45);
    return { first: samples[0], hazard: samples.find((p) => p.hp < 99), boost, recovery };
  });
  await check("combat", async () => {
    await page.getByRole('button',{name:'Play charged',exact:true}).click();
    await page.getByRole('button',{name:'Cancel skill',exact:true}).click();
    await page.waitForTimeout(950);
    assert.equal((await state()).events['skill:impact'] || 0,0);
    for (const name of ['charged','nova','impact']) {
      await page.getByRole('button',{name:`Play ${name}`,exact:true}).click();
      await page.waitForTimeout(1100);
    }
    assert.equal((await state()).events['skill:impact'],3);
    await page.getByLabel('Skill camera').uncheck();
    await page.waitForFunction(()=>window.__LAB__.info.inkwave.feedbackLayers.camera === false);
    await page.getByRole('button',{name:'Play nova',exact:true}).click();
    await page.waitForTimeout(750);
    await page.screenshot({path:`${evidence}/combat-nova.png`});
    // Bots can splat the idle player during the recipe checks. Start a fresh
    // round and observe resource consumption while firing, before refill.
    await page.getByRole('button',{name:'Reset simulation',exact:true}).click();
    await page.getByLabel("Weapon", { exact: true }).selectOption("blaster");
    await page.mouse.move(720, 450);
    await page.mouse.down();
    await page.waitForFunction(()=>window.__LAB__.info.inkwave.ink < 100);
    const firingInk = (await state()).ink;
    await page.mouse.up();
    await page.getByRole("button", { name: "Impact pulse" }).click();
    await page.waitForTimeout(500);
    const s = await state();
    assert(s.events["lab:impact"] === 1);
    assert(firingInk < 100);
    return { events: s.events, firingInk, ink: s.ink };
  });
  await check("ai", async () => {
    const before = await state();
    await page.getByLabel("Goal policy").selectOption("rescue");
    await page.waitForTimeout(2300);
    const s = await state();
    assert(s.botStates.every((b) => b.mode === "rescue"));
    assert(s.botStates.some((b) => b.pathLength > 1));
    assert(
      s.botStates.some(
        (b, i) =>
          Math.hypot(
            b.position[0] - before.botStates[i].position[0],
            b.position[2] - before.botStates[i].position[2],
          ) > 1,
      ),
    );
    return { scores: s.goalScores, bots: s.botStates };
  });
  await check("world", async () => {
    const before = await state();
    await page.getByRole("button", { name: "Next prop seed" }).click();
    await page.getByLabel("Structural wireframe").check();
    await page.getByLabel("Navigation samples").check();
    await page.waitForTimeout(600);
    const s = await state();
    assert.equal(s.seed, before.seed + 1);
    assert.equal(s.propStats.props, 6);
    return { seed: s.seed, props: s.propStats, nodes: s.navNodes };
  });
  await check("audio", async () => {
    await page
      .getByRole("button", { name: "Enable audio", exact: true })
      .click();
    await page.getByRole("button", { name: "ui_confirm", exact: true }).click();
    await page
      .getByRole("button", { name: "bomb_explode", exact: true })
      .click();
    await page.getByLabel("Score", { exact: true }).selectOption("battle");
    await page.getByLabel("Music intensity").fill("0.9");
    await page.waitForTimeout(700);
    const s = await state();
    assert.equal(s.audio.state, "running");
    assert(s.audio.played >= 2);
    await page.getByRole("button", { name: "Stop sound", exact: true }).click();
    return s.audio;
  });
  await check("ui", async () => {
    const scrollbars = await page.addStyleTag({ content: "::-webkit-scrollbar { width: 15px; height: 15px; }" });
    async function checkViewportStability() {
      await page.waitForTimeout(800);
      const sizes = await page.evaluate(() => new Promise((resolve) => {
        const samples = new Set(), start = performance.now();
        function sample(now) {
          const rect = (selector) => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          };
          samples.add(JSON.stringify({ canvas: rect("#root canvas"), overlay: rect(".ink-overlay"), stage: rect(".ink-ui-stage"), viewport: [document.documentElement.clientWidth, document.documentElement.clientHeight] }));
          if (now - start < 2500) requestAnimationFrame(sample);
          else resolve([...samples].map((s) => JSON.parse(s)));
        }
        requestAnimationFrame(sample);
      }));
      assert.equal(sizes.length, 1, `Idle viewport must not oscillate: ${JSON.stringify(sizes)}`);
      const wipe = await page.locator(".ink-ui-stage .iw-wipe").evaluate((el) => ({ height: el.clientHeight, scrollHeight: el.scrollHeight }));
      assert.equal(wipe.height, wipe.scrollHeight, "Wipe must not add a baseline overflow gap");
      return sizes[0];
    }
    const stage = page.locator(".ink-ui-stage");
    const screen = async (name) => {
      await page.getByLabel("Preview screen").selectOption(name);
      await page.waitForFunction(() => !document.querySelector('.iw-screen.is-leaving'));
    };
    const stableViewport = await checkViewportStability();
    assert.equal(await page.locator(".iw-main__menu .iw-btn").count(), 5);
    assert.equal(await page.locator(".iw-logo__l").count(), 7);
    assert((await page.locator('.iw-btn[data-id="loadout"]').evaluate(el => getComputedStyle(el).fontFamily)).includes("Titan One"));
    const loadout = page.locator('.iw-btn[data-id="loadout"]');
    await stage.hover({ position: { x: 500, y: 40 } });
    await loadout.hover();
    await page.waitForFunction(() => document.querySelector('[data-id="loadout"]').classList.contains('is-focus'));
    await page.waitForTimeout(600);
    const focus = await page.evaluate(() => {
      const button = document.querySelector('[data-id="loadout"]');
      const b = button.getBoundingClientRect(), c = document.querySelector('.iw-cursor').getBoundingClientRect();
      return { dx: Math.abs((b.x + b.width / 2) - (c.x + c.width / 2)), dy: Math.abs((b.y + b.height / 2) - (c.y + c.height / 2)), blob: getComputedStyle(button.querySelector('.iw-btn__blob')).transform };
    });
    assert(focus.dx < 3 && focus.dy < 3, 'Spring cursor must align inside the offset stage');
    assert.notEqual(focus.blob, 'matrix(0, 0, 0, 0, 0, 0)');
    await stage.focus();
    await page.keyboard.press('ArrowDown');
    assert(await page.locator('[data-id="settings"].is-focus').count());
    await page.keyboard.press('Enter');
    await page.locator('.iw-settings').waitFor();
    const toggle = page.locator('[data-id="set-invertY"]');
    await toggle.click();
    await screen('main');
    await screen('settings');
    assert(await page.locator('[data-id="set-invertY"] .iw-toggle.is-on').count());
    await screen('loadout');
    await page.locator('[data-id="w-roller"]').click();
    assert(await page.locator('[data-id="w-roller"].is-equipped').count());
    await screen('main');
    assert((await page.locator('.iw-kitcard__kind').textContent()).toLowerCase().includes('roller'));
    await page.getByLabel('UI palette').selectOption('alternate');
    assert.equal(await page.locator('.iw-ui').evaluate(el=>el.style.getPropertyValue('--a')), '#ff8a14');
    await page.getByLabel('UI palette').selectOption('original');
    for (const name of ['Ink wipe', 'Light sweep', 'Fade']) {
      await page.getByRole('button', {name, exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('.iw-wipe.is-run'));
      assert.equal(await page.locator('.iw-ui').getAttribute('data-screen'),'main');
    }
    await page.getByRole('button',{name:'Play results',exact:true}).click();
    await page.locator('.iw-results.is-done').waitFor({timeout:15000});
    assert(await page.getByText('Completed sequences: 1',{exact:true}).isVisible());
    await page.screenshot({path:`${evidence}/ui-results.png`});
    await page.getByRole('button',{name:'Play results',exact:true}).click();
    await page.getByRole('button',{name:'Skip',exact:true}).click();
    await page.getByRole('button',{name:'Skip',exact:true}).click();
    assert(await page.getByText('Completed sequences: 2',{exact:true}).isVisible());
    await page.getByRole('button',{name:'Play results',exact:true}).click();
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.waitForTimeout(2100);
    assert(await page.getByText('Completed sequences: 2',{exact:true}).isVisible());
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('button',{name:'Ink wipe',exact:true}).click();
    assert.equal(await page.locator('.iw-wipe.is-run').count(),0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:1280,height:800});
    const resizedViewport=await checkViewportStability();
    await scrollbars.evaluate(el=>el.remove());
    await page.setViewportSize({width:390,height:844});
    const mobile = {};
    for (const name of ['settings', 'loadout', 'setup', 'howto', 'pause', 'results']) {
      await screen(name);
      if (name === 'results') await page.getByRole('button',{name:'Skip',exact:true}).click();
      await page.waitForTimeout(900);
      const current = page.locator('.iw-screen:not(.is-leaving)');
      const dimensions = await current.evaluate(el => ({width:el.clientWidth, scrollWidth:el.scrollWidth, height:el.clientHeight, scrollHeight:el.scrollHeight}));
      assert.equal(dimensions.width, dimensions.scrollWidth, `${name}: no horizontal cropping`);
      await stage.hover();
      await page.mouse.wheel(0,700);
      await page.waitForTimeout(250);
      const scrollTop = await current.evaluate(el=>el.scrollTop);
      if (dimensions.scrollHeight > dimensions.height) assert(scrollTop > 0, `${name}: details must scroll`);
      await page.screenshot({path:`${evidence}/ui-mobile-${name}.png`});
      mobile[name] = {...dimensions, scrollTop};
    }
    await screen('main');
    await page.setViewportSize({width:1535,height:909});
    await page.getByRole('button',{name:'Replay entrance',exact:true}).click();
    assert.equal(await page.locator('.ink-ui-stage .iw-ui').count(),1);
    return {sourceScreens:true,originalTypography:true,focus,settingsPersist:true,loadoutPersist:true,commits:3,stableViewport,resizedViewport,mobile};
  });
  await check("diagnostics", async () => {
    await page.getByLabel('Camera', {exact:true}).selectOption('direct');
    await page.getByLabel('Actor count').selectOption('12');
    await page.getByRole('button', {name:'Dispose & rebuild world',exact:true}).click();
    await page.waitForFunction(()=>window.__LAB__?.info?.inkwave?.frames>30);
    assert.equal(await page.getByLabel('Camera', {exact:true}).inputValue(), (await state()).cameraMode);
    assert.equal(+(await page.getByLabel('Actor count').inputValue()), (await state()).actors);
    assert((await state()).frameTimes.samples > 0);
    await page.getByLabel("Pause simulation").check();
    await page.waitForTimeout(350);
    const stopped = await state();
    await page.waitForTimeout(350);
    assert.equal((await state()).ticks, stopped.ticks);
    await page.getByRole("button", { name: "Single step · 8.33 ms" }).click();
    await page.waitForTimeout(350);
    assert.equal((await state()).ticks, stopped.ticks + 1);
    await page.getByLabel("Actor count").selectOption("12");
    await page.getByLabel("Pause simulation").uncheck();
    await page.waitForTimeout(1400);
    assert.equal((await state()).actors, 12);
    const memory = [];
    for (let i = 0; i < 3; i++) {
      await page
        .getByRole("button", { name: "Dispose & rebuild world" })
        .click();
      await page.waitForFunction(
        () =>
          window.__LAB__?.info?.inkwave?.actors === 3 &&
          window.__LAB__?.info?.inkwave?.frames > 30,
        null,
        { timeout: 60000 },
      );
      await page.waitForTimeout(350);
      const s = await state();
      memory.push({
        geometries: s.geometries,
        textures: s.textures,
        listeners: s.listeners,
      });
    }
    console.log("MEMORY", JSON.stringify(memory));
    assert.equal(new Set(memory.map((m) => m.listeners)).size, 1);
    assert(memory[2].textures <= memory[0].textures + 1);
    assert(memory[2].geometries <= memory[0].geometries + 1);
    return { pauseTicks: stopped.ticks, memory };
  });
} finally {
  await fs.writeFile(
    `${evidence}/interactions.json`,
    JSON.stringify({ results, failures }, null, 2),
  );
  await browser.close();
}
if (
  results.some((r) => !r.pass) ||
  failures.some((f) => !f.url.endsWith("/favicon.ico"))
)
  process.exitCode = 1;
