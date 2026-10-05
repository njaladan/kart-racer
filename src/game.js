import * as THREE from "three";
import { createAudioController } from "./audio/audio.js";
import { createKartBuilder } from "./rendering/kart-builder.js";
import { createGameScene } from "./rendering/game-scene.js";
import { createRacerState } from "./simulation/racer-state.js";
import { bindGameInput } from "./input/game-input.js";
import { createGameRenderer } from "./rendering/game-renderer.js";
import { formatOrdinal, formatRaceTime, renderItemHud, renderRaceHud } from "./ui/race-hud.js";
import { bakeVertexShade, ParticlePool } from "./rendering/graphics.js";
import { bevelBox, contactShadow, batchStaticMeshes } from "./rendering/visuals.js";
import { buildCourseWorld } from "./rendering/course-runtime.js";
import { COURSES, DEFAULT_COURSE, findCourseById } from "./courses/registry.js";
import { selectCourse, activeTrack } from "./track/track.js";
import { advanceRacer, botInput } from "./simulation/simulation.js";
import {
  createShell,
  advanceShell,
  sweptDistanceSquared,
  consumeItem,
  chooseItem,
} from "./simulation/items.js";
import { FIXED_DT, resetMotion } from "./simulation/physics.js";
import { ranking, lapNumber, resetRaceProgress } from "./simulation/race.js";
import {
  TRACK,
  routePoint,
  frameAt,
  trackT,
  laneWidth,
  poseAt,
  yawFor,
  projectTrack,
  sectionAt,
  BOOST_PADS,
  ITEM_ROWS,
  RAMPS,
  WORLD_PER_UNIT,
  metresToProgress,
} from "./track/track.js";

(async () => {
  const requestedCourse = new URLSearchParams(location.search).get("course");
  const chosenCourse = findCourseById(requestedCourse) ?? DEFAULT_COURSE;
  selectCourse(chosenCourse);
  const selector = document.getElementById("course-select");
  for (const course of COURSES) {
    const option = document.createElement("option");
    option.value = course.id;
    option.textContent = course.name;
    selector.append(option);
  }
  selector.value = chosenCourse.id;
  selector.addEventListener("change", () => {
    const url = new URL(location.href);
    url.searchParams.set("course", selector.value);
    location.assign(url);
  });
  document.getElementById("track-name").textContent = chosenCourse.name.toUpperCase();
  document.getElementById("course-description").textContent = chosenCourse.description;

  const canvas = document.querySelector("#game"),
    radar = document.querySelector("#radar"),
    radarContext = radar.getContext("2d");
  const $ = (id) => document.getElementById(id),
    ui = {
      title: $("title-screen"),
      finish: $("finish-screen"),
      pause: $("pause-screen"),
      hud: $("race-hud"),
      count: $("countdown"),
      place: $("place"),
      lap: $("lap"),
      lapFill: $("lap-fill"),
      driftFill: $("drift-fill"),
      speed: $("speed"),
      timer: $("timer"),
      item: $("item-box"),
      itemIcon: document.querySelector(".item-icon"),
      itemLabel: document.querySelector(".item-label"),
      toast: $("toast"),
    };
  const TOTAL_LAPS = 3,
    TAU = Math.PI * 2;
  let w = innerWidth,
    h = innerHeight,
    pixelRatio = 1,
    last = performance.now(),
    elapsed = 0,
    raceTime = 0,
    running = false,
    paused = false,
    started = false,
    finished = false,
    countdown = 0,
    toastLeft = 0,
    shake = 0;
  let testAutodrive = false,
    testFreeze = false,
    testTricks = { started: 0, landed: 0 },
    testFrameStats = { frames: 0, total: 0, max: 0 };
  const testMode = new URLSearchParams(location.search).has("test");
  const benchmarkMode = testMode && new URLSearchParams(location.search).has("benchmark");
  const keys = Object.create(null),
    _temporaryObject = new THREE.Object3D();
  const {
    scene,
    camera,
    renderer,
    pixelRatio: initialPixelRatio,
    followShadow,
    ambientLight,
    sky,
    weather,
    displayFinish,
    sharedAssets: assets,
    courseAssets,
    textures,
    materials: mats,
    createMaterial: mat,
  } = await createGameScene({ canvas, course: chosenCourse });
  pixelRatio = initialPixelRatio;
  function addMesh(geometry, material, parent = scene, position = null) {
    if (material.vertexColors) bakeVertexShade(geometry);
    const m = new THREE.Mesh(geometry, material);
    if (position) m.position.copy(position);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function makeWorld() {
    landscape = buildCourseWorld({
      scene,
      renderer,
      materials: mats,
      textures,
      track: activeTrack,
      assets: courseAssets,
      sharedAssets: assets,
    });
    addFinishArch();
    addPads();
    addItemBoxes();
  }
  const pads = [],
    boxes = [];
  let landscape = null;
  const shadowTexture = contactShadow();
  function alignGroup(group, f) {
    group.position.copy(f.p);
    const z = f.tangent.clone().negate();
    const basis = new THREE.Matrix4().makeBasis(f.right, f.up, z);
    group.quaternion.setFromRotationMatrix(basis);
  }
  function addFinishArch() {
    const edge = activeTrack.surfaceAt(0);
    const postX = Math.max(-edge.leftEdge, edge.rightEdge) + 1.2;
    const span = postX * 2 + 1;
    const g = new THREE.Group(),
      post = mat("#f7f0d5", 0.36),
      accent = mat("#f76150", 0.5),
      beam = mat("#fa7654", 0.4);
    for (const x of [-postX, postX]) {
      const p = addMesh(new THREE.BoxGeometry(0.72, 13.4, 0.8), post, g);
      p.position.set(x, 6.7, 0);
      const a = addMesh(new THREE.BoxGeometry(0.9, 0.75, 1), accent, g);
      a.position.set(x, 13, 0);
    }
    const top = addMesh(bevelBox(span, 0.85, 0.9, 0.15), beam, g);
    top.position.set(0, 13.5, 0);
    const banner = document.createElement("canvas");
    banner.width = 1024;
    banner.height = 80;
    const bx = banner.getContext("2d");
    bx.fillStyle = "#f97652";
    bx.fillRect(0, 0, 1024, 80);
    bx.fillStyle = "#fff9e8";
    bx.font = "900 59px sans-serif";
    bx.textAlign = "center";
    bx.textBaseline = "middle";
    bx.fillText(`★  ${chosenCourse.name.toUpperCase()}  ★`, 512, 43, 1000);
    const bt = new THREE.CanvasTexture(banner);
    bt.colorSpace = THREE.SRGBColorSpace;
    for (const z of [-0.46, 0.46]) {
      const sign = addMesh(
        new THREE.PlaneGeometry(13, 0.72),
        new THREE.MeshBasicMaterial({ map: bt }),
        g,
      );
      sign.position.set(0, 13.5, z);
      if (z > 0) sign.rotation.y = Math.PI;
      sign.castShadow = false;
    }
    for (let i = 0; i < 12; i++) {
      const tile = addMesh(
        new THREE.BoxGeometry(1.5, 0.16, 0.95),
        i % 2 ? mats.white : mats.black,
        g,
      );
      tile.position.set(-8.25 + i * 1.5, 13.04, 0);
    }
    alignGroup(g, frameAt(0));
    scene.add(g);
    batchStaticMeshes(g);
    const f = frameAt(0),
      center = f.p.clone().addScaledVector(f.up, 0.13);
    for (let row = 0; row < 2; row++)
      for (let j = 0; j < 20; j++) {
        const x = -7.7 + j * 0.81,
          z = -0.18 + row * 0.36,
          p = center.clone().addScaledVector(f.right, x).addScaledVector(f.tangent, z),
          tile = addMesh(
            new THREE.BoxGeometry(0.82, 0.045, 0.38),
            (row + j) % 2 ? mats.white : mats.black,
          );
        tile.position.copy(p);
        tile.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(f.right, f.up, f.tangent.clone().negate()),
        );
        tile.castShadow = false;
      }
  }
  function addPads() {
    for (const pad of BOOST_PADS) {
      const { t, offset } = pad;
      const g = new THREE.Group(),
        base = addMesh(new THREE.BoxGeometry(4.5, 0.18, 6.8), mats.pad, g);
      base.position.y = 0.11;
      for (let i = -1; i <= 1; i++) {
        const strip = addMesh(new THREE.BoxGeometry(0.18, 0.07, 5.8), mats.neon, g);
        strip.position.set(i * 1.32, 0.23, 0);
      }
      alignGroup(g, poseAt(t * TRACK, offset, 0));
      scene.add(g);
      pads.push({ g, ...pad, phase: Math.random() * TAU });
    }
  }
  function itemCubeMaterial() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#4debd2";
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = "#eaffff";
    x.lineWidth = 9;
    x.strokeRect(7, 7, 114, 114);
    x.fillStyle = "#052c3b";
    x.font = "900 94px sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("?", 64, 67);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.22,
      metalness: 0.22,
      emissive: "#0e9e8b",
      emissiveMap: texture,
      emissiveIntensity: 0.65,
    });
  }
  const boxMaterial = itemCubeMaterial();
  function addItemBoxes() {
    // Authored rows respect the narrow timber crossing and provide three lanes.
    for (let i = 0; i < ITEM_ROWS.length * 3; i++) {
      let s = ITEM_ROWS[Math.floor(i / 3)] * TRACK,
        group = new THREE.Group(),
        cube = addMesh(new THREE.BoxGeometry(1.65, 1.65, 1.65), boxMaterial, group);
      cube.castShadow = true;
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.72, 1.72, 1.72)),
        new THREE.LineBasicMaterial({ color: "#eaffff" }),
      );
      group.add(wire);
      const b = {
        s,
        x: [-0.58, 0, 0.58][i % 3],
        group,
        cube,
        active: true,
        respawn: 0,
        phase: Math.random() * TAU,
      };
      scene.add(group);
      boxes.push(b);
    }
  }

  const particles = new ParticlePool(scene);
  const karts = [];
  const buildKartMesh = createKartBuilder({
    scene,
    models: courseAssets.models,
    textures: { ...textures, environment: assets.environment },
    shadowTexture,
    paintColors: ["#38d9ca", "#fa6551", "#edc748", "#9e83ff", "#42d7b4", "#ff8bbc"],
    theme: chosenCourse.theme,
  });
  const projectiles = [],
    bananas = [];
  function buildKart(color, name, isPlayer = false) {
    const kart = buildKartMesh(color, name, isPlayer);
    karts.push(kart);
    return kart;
  }

  const player = createRacerState({
    name: "YOU",
    color: "#38d9ca",
    isPlayer: true,
  });
  const bots = [
    {
      name: "MISO",
      color: "#fa6551",
      s: -18,
      x: -0.35,
      speed: 163,
      skill: 0.91,
    },
    { name: "PIP", color: "#edc748", s: -30, x: 0.32, speed: 158, skill: 0.86 },
    {
      name: "BOLT",
      color: "#9e83ff",
      s: -43,
      x: -0.12,
      speed: 153,
      skill: 0.81,
    },
    {
      name: "NOVA",
      color: "#42d7b4",
      s: -55,
      x: 0.43,
      speed: 148,
      skill: 0.77,
    },
    {
      name: "BEANS",
      color: "#ff8bbc",
      s: -70,
      x: -0.42,
      speed: 144,
      skill: 0.72,
    },
  ].map(createRacerState);
  bots.forEach((b) => {
    b.worldPos = poseAt(b.s, laneWidth(b.x), 0.065).p;
    b.renderFrom = b.worldPos.clone();
    b.yaw = yawFor(frameAt(trackT(b.s)).tangent);
  });
  const playerKart = buildKart("#38d9ca", "YOU", true);
  bots.forEach((b) => {
    b.kart = buildKart(b.color, b.name);
    b.item = null;
    b.itemCount = 0;
    b.cooldown = 5 + Math.random() * 5;
    b.spin = 0;
    b.boost = 0;
    b.finished = false;
    b.prevS = b.s;
  });

  function nearestDelta(a, b) {
    let d = modTrack(a - b);
    if (d > TRACK / 2) d -= TRACK;
    return d;
  }
  function modTrack(s) {
    return ((s % TRACK) + TRACK) % TRACK;
  }
  function place() {
    return ranking([player, ...bots]).indexOf(player) + 1;
  }
  function notify(text) {
    ui.toast.textContent = text;
    toastLeft = 1.65;
  }
  const audio = createAudioController(window);
  function syncItem() {
    renderItemHud(ui, player.item, player.itemCount);
  }
  function setItem(who, type) {
    who.item = type;
    who.itemCount = type === "mushroom" ? 3 : 1;
    if (who === player) syncItem();
  }
  function collect(box, who) {
    if (who.item || who.finished) return;
    box.active = false;
    box.group.visible = false;
    box.respawn = 10 + Math.random() * 4;
    setItem(who, chooseItem(who, [player, ...bots]));
    if (who === player) {
      notify(
        `${{ mushroom: "TRIPLE MUSHROOMS", green: "GREEN SHELL", red: "HOMING RED SHELL", banana: "BANANA PEELS", star: "RAINBOW STAR" }[who.item]}!`,
      );
      audio.play("pickup");
    }
  }

  function spawnParticle(pos, color, life = 0.6, size = 0.2, velocity = null) {
    particles.spawn(pos, color, life, size, velocity);
  }
  function getItemModel(kind) {
    let g = new THREE.Group();
    if (kind === "banana") {
      const body = addMesh(
        new THREE.TorusGeometry(0.43, 0.17, 6, 8, Math.PI * 1.45),
        mat("#f6d33f", 0.42, { emissive: "#80631a", emissiveIntensity: 0.25 }),
        g,
      );
      body.rotation.z = -0.15;
      for (const side of [-1, 1]) {
        const tip = addMesh(new THREE.ConeGeometry(0.17, 0.3, 6), mat("#66b36c"), g);
        tip.position.set(side * 0.39, 0.27, 0);
        tip.rotation.z = side * 0.75;
      }
    } else {
      const red = kind === "red",
        shellMat = mat(red ? "#eb4e4b" : "#6acb4a", 0.29, {
          metalness: 0.12,
          emissive: red ? "#76201d" : "#244d1c",
          emissiveIntensity: 0.32,
        });
      const shell = addMesh(new THREE.SphereGeometry(0.58, 9, 7), shellMat, g);
      shell.scale.set(1, 1.05, 1);
      const cap = addMesh(
        new THREE.ConeGeometry(0.52, 0.45, 8),
        mat(red ? "#ff8172" : "#b8ed69"),
        g,
      );
      cap.position.y = 0.35;
      const stripe = addMesh(new THREE.TorusGeometry(0.54, 0.075, 5, 12), mats.white, g);
      stripe.rotation.x = Math.PI / 2;
    }
    return g;
  }
  function fireItem(who) {
    const type = consumeItem(who);
    if (!type) return;
    const isPlayer = who === player,
      from = who.s,
      lane = who.x;
    if (type === "mushroom") {
      if (isPlayer) {
        notify(who.itemCount ? `TURBO! ${who.itemCount} LEFT` : "MUSHROOM BOOST!");
        audio.play("boost");
      }
      for (let n = 0; n < 17; n++) {
        const p = poseAt(from, laneWidth(lane), 1);
        spawnParticle(p.p, "#ff9c4d", 0.5, 0.15);
      }
    } else if (type === "star") {
      who.star = 6.2;
      who.boost = 3.3;
      who.item = null;
      if (isPlayer) {
        notify("RAINBOW STAR!");
        audio.play("star");
      }
    } else if (type === "banana") {
      for (let n = 0; n < 3; n++) {
        const s = from - 14 - n * 8,
          b = {
            s,
            x: lane + (n - 1) * 0.08,
            mesh: getItemModel("banana"),
            life: 18,
            owner: who,
            grace: 0.6,
          };
        scene.add(b.mesh);
        bananas.push(b);
      }
      who.item = null;
      if (isPlayer) {
        notify("BANANAS AWAY!");
        audio.play("shell");
      }
    } else if (type === "green" || type === "red") {
      let target = null;
      if (type === "red") {
        const rivals = [player, ...bots].filter((b) => b !== who && !b.finished && b.s > who.s);
        target = rivals.sort((a, b) => a.s - b.s)[0] || null;
      }
      const q = { ...createShell(who, type, target), mesh: getItemModel(type) };
      scene.add(q.mesh);
      projectiles.push(q);
      if (isPlayer) {
        notify(type === "red" ? "HOMING RED SHELL!" : "GREEN SHELL!");
        audio.play("shell");
      }
    }
    if (isPlayer) syncItem();
  }
  function reset() {
    player.s = 0;
    player.x = 0;
    player.speed = 0;
    player.yaw = yawFor(frameAt(0).tangent);
    player.worldPos.copy(poseAt(0, 0, 0.065).p);
    player.lap = 0;
    player.boost = 0;
    player.star = 0;
    player.spin = 0;
    player.drift = 0;
    player.driftTier = 0;
    player.item = null;
    player.itemCount = 0;
    player.air = 0;
    player.padCooldown = 0;
    player.finished = false;
    player.prevS = 0;
    player.renderFrom = player.worldPos.clone();
    player.finishTime = Infinity;
    player.finishDelay = 0;
    resetMotion(player);
    resetRaceProgress(player, TRACK);
    clearInput();
    bots.forEach((b, i) => {
      b.s = -46 - Math.floor(i / 2) * 60 - (i % 2) * 5;
      b.prevS = b.s;
      b.x = [-0.4, 0.4, -0.4, 0.4, -0.4][i];
      b.speed = 0;
      resetMotion(b);
      resetRaceProgress(b, TRACK);
      b.worldPos = poseAt(b.s, laneWidth(b.x), 0.065).p;
      b.renderFrom = b.worldPos.clone();
      b.yaw = yawFor(frameAt(trackT(b.s)).tangent);
      b.lap = 0;
      b.padCooldown = 0;
      b.finishTime = Infinity;
      b.spin = 0;
      b.boost = 0;
      b.star = 0;
      b.item = null;
      b.itemCount = 0;
      b.cooldown = 4 + i * 1.5;
      b.finished = false;
    });
    boxes.forEach((b) => {
      b.active = true;
      b.group.visible = true;
      b.respawn = 0;
    });
    projectiles.splice(0).forEach((p) => disposeEffect(p.mesh));
    bananas.splice(0).forEach((b) => disposeEffect(b.mesh));
    particles.clear();
    elapsed = 0;
    raceTime = 0;
    running = false;
    paused = false;
    finished = false;
    toastLeft = 0;
    shake = 0;
    gameRenderer.reset();
    testTricks = { started: 0, landed: 0 };
    ui.toast.textContent = "";
    syncItem();
    updateVehicle(player, playerKart, 0, true);
  }
  function begin() {
    reset();
    audio.start();
    audio.resume();
    started = true;
    document.querySelector("#game-shell").classList.add("racing");
    document.querySelector("#game-shell").classList.remove("paused");
    karts.forEach((k) => {
      k.root.visible = true;
      k.shadow.visible = true;
    });
    boxes.forEach((b) => (b.group.visible = true));
    ui.title.classList.add("hidden");
    ui.finish.classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.hud.classList.remove("hidden");
    radar.classList.add("active");
    countdown = benchmarkMode ? 0.01 : 3.45;
    ui.count.classList.remove("hidden");
    canvas.focus({ preventScroll: true });
    audio.tone(420, 0.18, "square", 0.08);
  }
  function finish() {
    finished = true;
    running = false;
    raceTime = player.finishTime;
    let p = place();
    $("final-place").textContent = formatOrdinal(p);
    $("final-time").textContent = formatRaceTime(player.finishTime);
    $("finish-title").textContent =
      p === 1 ? "WHAT A RACE!" : p <= 3 ? "PODIUM FINISH!" : "RACE COMPLETE!";
    $("finish-copy").textContent =
      p === 1
        ? "You left the whole pack in your dust."
        : "Every turn counts. There’s always the next race.";
    ui.finish.classList.remove("hidden");
    $("again-button").focus({ preventScroll: true });
    document.querySelector("#game-shell").classList.remove("racing");
    audio.stopEngine();
  }
  function clearInput() {
    inputController.clear();
  }
  function setPaused(value) {
    if (!started || finished) return;
    paused = value;
    clearInput();
    ui.pause.classList.toggle("hidden", !paused);
    document.querySelector("#game-shell").classList.toggle("paused", paused);
    if (paused) audio?.suspend();
    else {
      audio?.resume();
      canvas.focus({ preventScroll: true });
    }
    last = performance.now();
    accumulator = 0;
  }
  $("start-button").addEventListener("click", begin);
  $("again-button").addEventListener("click", begin);
  $("change-course-button").addEventListener("click", () => {
    reset();
    started = false;
    ui.finish.classList.add("hidden");
    ui.hud.classList.add("hidden");
    ui.title.classList.remove("hidden");
    document.querySelector("#game-shell").classList.remove("racing", "paused");
    radar.classList.remove("active");
    karts.forEach((k) => {
      k.root.visible = false;
      k.shadow.visible = false;
    });
    boxes.forEach((b) => (b.group.visible = false));
    selector.focus({ preventScroll: true });
  });
  $("resume-button").addEventListener("click", () => setPaused(false));
  const pointer = { down: false, x: 0, steer: 0 };
  const inputController = bindGameInput({
    canvas,
    keys,
    pointer,
    testMode,
    isRunning: () => running && !paused,
    canPause: () => started && !finished,
    onPause: () => setPaused(!paused),
    onUseItem: () => fireItem(player),
    canRecover: () => running && !paused && player.speed < 12,
    onRecover: recoverPlayer,
  });
  function recoverPlayer() {
    const f = poseAt(player.s, 0, 0.065);
    player.worldPos.copy(f.p);
    player.renderFrom?.copy(f.p);
    player.yaw = yawFor(f.tangent);
    player.x = 0;
    resetMotion(player);
    player.spin = 0;
    player.drift = 0;
    player.invulnerable = 1.5;
    canvas.focus({ preventScroll: true });
    notify("BACK ON TRACK");
  }
  window.addEventListener("resize", () => {
    w = innerWidth;
    h = innerHeight;
    // Existing resize reference retained for this behavior-preserving reorganization.
    // eslint-disable-next-line no-undef
    pixelRatio = Math.min(devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  function disposeEffect(mesh) {
    scene.remove(mesh);
    mesh.traverse((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const materials = Array.isArray(m.material) ? m.material : [m.material];
        for (const material of materials)
          if (!Object.values(mats).includes(material)) material.dispose();
      }
    });
  }
  function hitRacer(state, seconds = 1.1) {
    if (state.invulnerable > 0 || state.star > 0 || state.finished) return false;
    state.spin = seconds;
    state.invulnerable = seconds + 1;
    state.vx *= 0.55;
    state.vz *= 0.55;
    state.drift = 0;
    if (state === player) {
      shake = 0.22;
      audio.play("hit");
    }
    return true;
  }
  function moveRacer(state, input, dt) {
    const events = advanceRacer(state, input, dt, raceTime);
    const sliding = events.sliding;
    if (testMode && state === player) {
      testTricks.started += !!events.trickStarted;
      testTricks.landed += !!events.trickLanded;
    }
    if (events.wallImpact && state.contactCooldown === 0) {
      state.contactCooldown = 0.45;
      if (state === player) {
        shake = 0.1;
        audio.play("hit");
      }
    }
    if (events.launched && state === player) {
      notify("TAP DRIFT TO TRICK!");
      audio.play("jump");
    }
    if (events.trickStarted && state === player) {
      notify("TRICK!");
      audio.play("pickup");
      for (let n = 0; n < 12; n++)
        spawnParticle(
          state.worldPos.clone().add(new THREE.Vector3(0, 0.7, 0)),
          "#ffe680",
          0.5,
          0.15,
        );
    }
    if (events.landed && state === player) {
      shake = 0.09;
      notify(events.trickLanded ? "TRICK LANDING BOOST!" : "SMOOTH LANDING");
      if (events.trickLanded) audio.play("boost");
    }
    if (events.turboTier && state === player) {
      notify(events.turboTier === 2 ? "ORANGE MINI-TURBO!" : "BLUE MINI-TURBO!");
      audio.play("boost");
    }
    if (sliding && state === player && Math.random() < dt * 35) {
      const side = state.steering >= 0 ? 1 : -1;
      const wheelPos = state.worldPos
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(state.yaw) * side * 0.85 + Math.sin(state.yaw) * 0.76,
            0.18,
            -Math.sin(state.yaw) * side * 0.85 + Math.cos(state.yaw) * 0.76,
          ),
        );
      spawnParticle(
        wheelPos,
        state.driftTier === 2 ? "#ff984c" : state.driftTier === 1 ? "#43e6ff" : "#bbc8cc",
        0.35,
        0.1,
        new THREE.Vector3(
          Math.sin(state.yaw) * 2.2 + side * Math.cos(state.yaw),
          0.5 + Math.random(),
          Math.cos(state.yaw) * 2.2 - side * Math.sin(state.yaw),
        ),
      );
    }
    if (events.padBoost && state === player) {
      notify("TURBO PANEL!");
      audio.play("boost");
    }
    if (events.cartImpact && state === player) {
      notify("DELIVERY CART!");
      shake = 0.15;
      audio.play("hit");
    }
    state.speed = Math.hypot(state.vx, state.vz) * 3.6;
    if (!Number.isFinite(state.worldPos.y) || state.worldPos.y < -12) {
      if (state === player) recoverPlayer();
      else {
        state.worldPos.copy(poseAt(state.s, 0, 0.065).p);
        resetMotion(state);
      }
    }
    if (events.newLap && state === player) {
      notify(`LAP ${state.lap + 1} — KEEP IT UP!`);
      audio.tone(520, 0.22, "square", 0.1, 300);
    }
    if (events.finished && state === player) state.finishDelay = 0.35;
    return sliding;
  }
  function step(dt) {
    if (paused) return;
    elapsed += dt;
    if (countdown > 0) {
      const previous = Math.ceil(countdown - 0.45);
      countdown -= dt;
      ui.count.textContent =
        countdown > 2.45 ? "3" : countdown > 1.45 ? "2" : countdown > 0.45 ? "1" : "GO!";
      if (Math.ceil(countdown - 0.45) < previous)
        audio.tone(countdown > 0.45 ? 420 : 840, 0.15, "square", 0.08);
      if (countdown <= 0) {
        ui.count.classList.add("hidden");
        running = true;
      }
      return;
    }
    if (!running || finished) return;
    raceTime += dt;
    if (!player.finished) {
      moveRacer(
        player,
        testAutodrive
          ? {
              ...botInput(player, 0, raceTime, [player, ...bots]),
              drift: keys[" "] || keys.shift,
            }
          : {
              throttle: keys.arrowup || keys.w,
              brake: keys.arrowdown || keys.s,
              steer:
                (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0) ||
                pointer.steer,
              drift: keys[" "] || keys.shift,
            },
        dt,
      );
    } else {
      player.finishDelay -= dt;
      if (player.finishDelay <= 0) {
        finish();
        return;
      }
    }
    bots.forEach((b, i) => {
      if (b.finished) return;
      moveRacer(b, botInput(b, i, raceTime, [player, ...bots]), dt);
      b.cooldown -= dt;
      if (b.item && b.cooldown <= 0) {
        fireItem(b);
        b.cooldown = 5 + Math.random() * 6;
      }
    });
    // Separate overlapping bodies once and apply an impulse, with a cooldown.
    for (let i = 0; i < karts.length; i++)
      for (let j = i + 1; j < karts.length; j++) {
        const a = i === 0 ? player : bots[i - 1],
          b = j === 0 ? player : bots[j - 1];
        if (a.finished || b.finished || Math.abs(a.worldPos.y - b.worldPos.y) > 1.5) continue;
        let dx = a.worldPos.x - b.worldPos.x,
          dz = a.worldPos.z - b.worldPos.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= 1.95) continue;
        if (distance < 0.001) {
          dx = 1;
          dz = 0;
        } else {
          dx /= distance;
          dz /= distance;
        }
        const push = (1.95 - distance) * 0.5;
        a.worldPos.x += dx * push;
        a.worldPos.z += dz * push;
        b.worldPos.x -= dx * push;
        b.worldPos.z -= dz * push;
        const closing = (a.vx - b.vx) * dx + (a.vz - b.vz) * dz;
        if (closing < 0) {
          const impulse = -closing * 0.56;
          a.vx += dx * impulse;
          a.vz += dz * impulse;
          b.vx -= dx * impulse;
          b.vz -= dz * impulse;
        }
        if (a.star > 0) hitRacer(b);
        else if (b.star > 0) hitRacer(a);
        if ((a === player || b === player) && player.contactCooldown === 0) {
          player.contactCooldown = 0.4;
          shake = 0.08;
          if (closing < -2) audio.play("hit");
        }
      }
    for (const box of boxes) {
      if (!box.active) {
        box.respawn -= dt;
        if (box.respawn <= 0) {
          box.active = true;
          box.group.visible = true;
        }
      } else
        for (const racer of [player, ...bots]) {
          if (
            !racer.finished &&
            !racer.item &&
            Math.abs(racer.worldPos.y - poseAt(box.s, laneWidth(box.x), 0.065).p.y) < 2 &&
            Math.abs(nearestDelta(racer.s, box.s)) * WORLD_PER_UNIT < 3 &&
            Math.abs(racer.x - box.x) < 0.26
          ) {
            collect(box, racer);
            break;
          }
        }
    }
    for (const banana of bananas) {
      banana.life -= dt;
      banana.grace -= dt;
      for (const racer of [player, ...bots]) {
        if (
          banana.life <= 0 ||
          racer.finished ||
          !racer.grounded ||
          (racer === banana.owner && banana.grace > 0)
        )
          continue;
        if (
          Math.abs(nearestDelta(racer.s, banana.s)) * WORLD_PER_UNIT < 2 &&
          Math.abs(racer.x - banana.x) < 0.22 &&
          hitRacer(racer)
        ) {
          banana.life = 0;
          if (racer === player) notify("BANANA PEEL!");
          break;
        }
      }
    }
    for (const p of projectiles) {
      advanceShell(p, dt, raceTime);
      for (const target of [player, ...bots]) {
        if (target.finished || p.life <= 0 || (target === p.owner && p.grace > 0)) continue;
        const center = target.worldPos.clone();
        center.y += 0.6;
        if (
          sweptDistanceSquared(center, p.previous, p.worldPos) < 1.5 ** 2 &&
          hitRacer(target, 1.4)
        ) {
          p.life = 0;
          if (target === player) notify("SHELL HIT!");
          break;
        }
      }
    }
    for (const list of [projectiles, bananas])
      for (let i = list.length - 1; i >= 0; i--)
        if (list[i].life <= 0) {
          disposeEffect(list[i].mesh);
          list.splice(i, 1);
        }
    toastLeft = Math.max(0, toastLeft - dt);
    if (!toastLeft) ui.toast.textContent = "";
    shake = Math.max(0, shake - dt);
    particles.step(dt);
  }
  const radarPoints = Array.from({ length: 161 }, (_, i) => {
    const p = routePoint(i / 160);
    return [p.x, p.z];
  });
  const radarBounds = {
    minX: Math.min(...radarPoints.map((p) => p[0])),
    maxX: Math.max(...radarPoints.map((p) => p[0])),
    minZ: Math.min(...radarPoints.map((p) => p[1])),
    maxZ: Math.max(...radarPoints.map((p) => p[1])),
  };
  function updateRadar() {
    const cw = radar.width,
      ch = radar.height,
      pad = 18;
    radarContext.clearRect(0, 0, cw, ch);
    radarContext.fillStyle = "rgba(5,16,28,.78)";
    radarContext.beginPath();
    radarContext.roundRect(0, 0, cw, ch, 8);
    radarContext.fill();
    radarContext.strokeStyle = "rgba(206,247,244,.14)";
    radarContext.lineWidth = 9;
    radarContext.lineJoin = "round";
    radarContext.lineCap = "round";
    const points = radarPoints,
      { minX, maxX, minZ, maxZ } = radarBounds,
      scale = Math.min((cw - pad * 2) / (maxX - minX), (ch - pad * 2) / (maxZ - minZ));
    const map = (p) => [pad + (p[0] - minX) * scale, pad + (p[1] - minZ) * scale];
    radarContext.beginPath();
    points.forEach((p, i) => {
      const q = map(p);
      i ? radarContext.lineTo(q[0], q[1]) : radarContext.moveTo(q[0], q[1]);
    });
    radarContext.closePath();
    radarContext.stroke();
    radarContext.strokeStyle = "rgba(211,255,239,.45)";
    radarContext.lineWidth = 2;
    radarContext.stroke();
    const dot = (s, lane, color, size) => {
      const f = poseAt(s, laneWidth(lane), 0.2),
        q = map([f.p.x, f.p.z]);
      radarContext.fillStyle = color;
      radarContext.beginPath();
      radarContext.arc(q[0], q[1], size, 0, TAU);
      radarContext.fill();
    };
    for (const box of boxes) if (box.active) dot(box.s, box.x, "#5af2dd", 1.6);
    for (const b of bots) if (!b.finished) dot(b.s, b.x, b.color, 3.2);
    dot(player.s, player.x, "#d5fa51", 4.2);
    radarContext.fillStyle = "#d5fa51";
    radarContext.font = 'bold 9px "DM Mono",monospace';
    radarContext.fillText("TRACK RADAR", 10, ch - 7);
  }
  let accumulator = 0,
    performanceTime = 0,
    performanceFrames = 0;
  const gameRenderer = createGameRenderer({
    scene,
    camera,
    renderer,
    followShadow,
    ambientLight,
    sky,
    weather,
    displayFinish,
    theme: chosenCourse.theme,
    player,
    bots,
    playerKart,
    pads,
    boxes,
    bananas,
    projectiles,
    particles,
    ui,
    audio,
    updateRadar,
    place,
    getLandscape: () => landscape,
    getFrameState: () => ({
      elapsed,
      raceTime,
      paused,
      running,
      finished,
      shake,
      accumulator,
    }),
    totalLaps: TOTAL_LAPS,
  });
  const cameraLook = gameRenderer.cameraLook;
  function updateVehicle(state, kart, dt) {
    gameRenderer.updateVehicle(state, kart, dt);
  }
  function render(dt) {
    gameRenderer.render(dt);
  }
  function reportTestState() {
    parent.postMessage(
      {
        type: "racer-state",
        running,
        paused,
        finished,
        countdown,
        raceTime,
        rank: place(),
        player: {
          section: sectionAt(trackT(player.s)).id,
          s: player.s,
          x: player.x,
          speed: player.speed,
          item: player.item,
          itemCount: player.itemCount,
          grounded: player.grounded,
          altitude: player.worldPos.y - projectTrack(player.worldPos, player.s).height,
          airTime: player.airTime,
          drift: player.drift,
          boost: player.boost,
          driftBoost: player.driftBoost,
          trickActive: player.trickActive,
          spin: player.spin,
        },
        course: chosenCourse.id,
        section: sectionAt(trackT(player.s)).id,
        tricks: testTricks,
        pickups: {
          total: boxes.length,
          active: boxes.filter((b) => b.active).length,
        },
        projectiles: projectiles.length,
        camera: { driftEffect: gameRenderer.getDriftCamera(), fov: camera.fov },
        bots: bots.map((b) => ({ s: b.s, finished: b.finished })),
        effects: particles.count + bananas.length + projectiles.length,
        render: {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          pixelRatio: pixelRatio,
          particles: particles.count,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          fps: testFrameStats.frames / Math.max(0.01, testFrameStats.total),
          maxFrame: testFrameStats.max,
        },
      },
      location.origin,
    );
  }
  function frame(now) {
    const frameSeconds = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.1, frameSeconds);
    last = now;
    if (!paused && (!testFreeze || !running)) {
      accumulator += dt;
      while (accumulator >= FIXED_DT) {
        step(FIXED_DT);
        accumulator -= FIXED_DT;
      }
    }
    render(paused ? 0 : dt);
    if (!paused && dt > 0) {
      performanceTime += dt;
      performanceFrames++;
      if (performanceTime > 3) {
        const average = performanceTime / performanceFrames;
        if (!benchmarkMode && average > 0.025 && pixelRatio > 0.85) {
          pixelRatio = Math.max(0.85, pixelRatio - 0.15);
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(w, h, false);
        }
        performanceTime = 0;
        performanceFrames = 0;
      }
    }
    if (testMode) {
      testFrameStats.frames++;
      testFrameStats.total += frameSeconds;
      testFrameStats.max = Math.max(testFrameStats.max, frameSeconds);
      if (testFrameStats.frames % 6 === 0) reportTestState();
    }
    requestAnimationFrame(frame);
  }
  if (testMode)
    window.addEventListener("message", (event) => {
      if (
        event.origin !== location.origin ||
        event.source !== parent ||
        typeof event.data?.type !== "string" ||
        !event.data.type.startsWith("test-")
      )
        return;
      const message = event.data;
      if (message.type === "test-start") begin();
      if (message.type === "test-ramp" && running) {
        player.s = RAMPS[0].t * TRACK - metresToProgress(14);
        player.x = 0;
        player.worldPos.copy(poseAt(player.s, 0, 0.065).p);
        player.renderFrom.copy(player.worldPos);
        resetMotion(player);
        resetRaceProgress(player, TRACK);
        player.yaw = yawFor(frameAt(trackT(player.s)).tangent);
        player.vx = -Math.sin(player.yaw) * 35;
        player.vz = -Math.cos(player.yaw) * 35;
        player.boost = 1.5;
        player.star = 0;
        testAutodrive = true;
      }
      if (message.type === "test-seek" && running && Number.isFinite(message.t)) {
        player.s = Math.max(0, Math.min(0.999, message.t)) * TRACK;
        player.x = 0;
        player.worldPos.copy(poseAt(player.s, 0, 0.065).p);
        player.renderFrom.copy(player.worldPos);
        resetMotion(player);
        resetRaceProgress(player, TRACK);
        player.yaw = yawFor(frameAt(trackT(player.s)).tangent);
        player.speed = 0;
      }
      if (message.type === "test-step" && started && !finished && !paused) {
        const seconds = Math.max(0, Math.min(5, Number(message.seconds) || 0));
        for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) step(FIXED_DT);
        reportTestState();
      }
      if (message.type === "test-report") reportTestState();
      if (message.type === "test-auto") testAutodrive = !!message.value;
      if (message.type === "test-freeze" && benchmarkMode) testFreeze = !!message.value;
      if (message.type === "test-input") {
        clearInput();
        for (const key of message.keys || []) keys[key] = true;
      }
      if (message.type === "test-pause") setPaused(!!message.value);
      if (
        message.type === "test-item" &&
        ["mushroom", "star", "red", "green", "banana"].includes(message.item)
      )
        setItem(player, message.item);
      if (message.type === "test-fire" && running && !paused) fireItem(player);
      if (message.type === "test-hit") hitRacer(player);
    });
  makeWorld();
  $("start-button").disabled = false;
  $("start-button").innerHTML = "START YOUR ENGINES <span>↗</span>";
  player.yaw = yawFor(frameAt(0).tangent);
  player.worldPos.copy(poseAt(0, 0, 0.065).p);
  bots.forEach((b) => updateVehicle(b, b.kart, 0));
  updateVehicle(player, playerKart, 0, true);
  karts.forEach((k) => {
    k.root.visible = false;
    k.shadow.visible = false;
  });
  boxes.forEach((b) => (b.group.visible = false));
  camera.position.copy(player.worldPos).addScaledVector(frameAt(0).tangent, -12);
  camera.position.y += 7;
  cameraLook.copy(player.worldPos);
  camera.lookAt(cameraLook);
  syncItem();
  requestAnimationFrame(frame);
})().catch((error) => {
  console.error(error);
  document.getElementById("course-description").textContent =
    "The course could not load. Try again.";
  const button = document.getElementById("start-button");
  const retry = button.cloneNode(false);
  retry.disabled = false;
  retry.textContent = "RETRY COURSE";
  retry.addEventListener("click", () => location.reload());
  button.replaceWith(retry);
});
