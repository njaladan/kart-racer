import * as THREE from "three";
import { surfaceTexture } from "./textures.js";
import {
  bevelBox,
  contactShadow,
  addLandscape,
  batchStaticMeshes,
} from "./visuals.js";
import { advanceRacer, botInput } from "./simulation.js";
import { createShell, advanceShell, sweptDistanceSquared } from "./items.js";
import { FIXED_DT, MAX_SPEED, resetMotion } from "./physics.js";
import { ranking, lapNumber } from "./race.js";
import {
  TRACK,
  routePoint,
  frameAt,
  trackT,
  laneWidth,
  poseAt,
  yawFor,
  projectTrack,
} from "./track.js";

(() => {
  const canvas = document.querySelector("#game"),
    radar = document.querySelector("#radar"),
    rctx = radar.getContext("2d");
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
    dpr = 1,
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
    testFrameStats = { frames: 0, total: 0, max: 0 };
  const testMode = new URLSearchParams(location.search).has("test");
  const keys = Object.create(null),
    tempObj = new THREE.Object3D();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#8ed5e8");
  scene.fog = new THREE.Fog("#c3e4e5", 165, 480);
  const camera = new THREE.PerspectiveCamera(
    63,
    innerWidth / innerHeight,
    0.1,
    750,
  );
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  const maxDpr = Math.min(
    devicePixelRatio || 1,
    matchMedia("(pointer:coarse)").matches ? 1.25 : 1.6,
  );
  dpr = maxDpr;
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  scene.add(new THREE.HemisphereLight("#c6edff", "#8c9b60", 1.55));
  const sun = new THREE.DirectionalLight("#fff0d0", 2.5);
  sun.position.set(-75, 130, 75);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -48;
  sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48;
  sun.shadow.camera.bottom = -48;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00025;
  scene.add(sun);
  scene.add(sun.target);
  const mat = (color, roughness = 0.74, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const textures = Object.fromEntries(
    ['grass', 'asphalt', 'bark', 'leaves', 'fabric', 'tire', 'paint'].map(
      (kind) => [kind, surfaceTexture(kind, renderer)],
    ),
  );
  const grassTexture = textures.grass, asphaltTexture = textures.asphalt;
  const surface = (map, bumpScale = 0.025) => ({ map, bumpMap: map, bumpScale });
  const mats = {
    grass: mat("#ffffff", 0.96, surface(grassTexture, 0.06)),
    road: mat("#ffffff", 0.96, surface(asphaltTexture, 0.035)),
    roadside: mat("#b1afa0", 0.95, surface(asphaltTexture)),
    white: mat("#fff4d4", 0.65),
    red: mat("#fa634f"),
    rail: mat("#e7e5d9", 0.4, { metalness: 0.22 }),
    pine: mat("#b4d7ad", 0.85, surface(textures.leaves, 0.04)),
    pine2: mat("#d4e7b8", 0.85, surface(textures.leaves, 0.04)),
    trunk: mat("#ffffff", 0.9, surface(textures.bark, 0.07)),
    gold: mat("#f7d65b", 0.3, {
      metalness: 0.32,
      emissive: "#aa771b",
      emissiveIntensity: 0.35,
    }),
    neon: mat("#50f8dd", 0.27, { emissive: "#0af5cd", emissiveIntensity: 2.4 }),
    pad: mat("#193b49", 0.3, {
      metalness: 0.5,
      emissive: "#0a878b",
      emissiveIntensity: 0.7,
    }),
    black: mat("#17202a"),
    tire: mat("#11151a", 0.9),
    glass: mat("#9aeaff", 0.18, {
      metalness: 0.25,
      emissive: "#194955",
      emissiveIntensity: 0.22,
    }),
  };

  function addMesh(geometry, material, parent = scene, position = null) {
    const m = new THREE.Mesh(geometry, material);
    if (position) m.position.copy(position);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function ribbon(
    inner,
    outer,
    material,
    segments = 500,
    alternating = false,
    lift = 0.025,
  ) {
    const pos = [],
      uv = [],
      idx = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments,
        f = frameAt(t);
      for (const [j, side] of [inner, outer].entries()) {
        const p = f.p
          .clone()
          .addScaledVector(f.right, side)
          .addScaledVector(f.up, lift);
        pos.push(p.x, p.y, p.z);
        uv.push(j * 4, t * 180);
      }
    }
    for (let i = 0; i < segments; i++) {
      let a = i * 2,
        b = a + 1,
        c = a + 2,
        d = a + 3;
      idx.push(a, b, c, c, b, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    if (alternating) {
      const even = [],
        odd = [];
      for (let i = 0; i < segments; i++)
        (i % 2 ? odd : even).push(...idx.slice(i * 6, i * 6 + 6));
      g.setIndex([...even, ...odd]);
      g.addGroup(0, even.length, 0);
      g.addGroup(even.length, odd.length, 1);
    } else g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  function makeWorld() {
    const ground = addMesh(
      new THREE.PlaneGeometry(1500, 1500, 1, 1),
      mats.grass,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.7;
    ground.receiveShadow = true;
    ground.castShadow = false;
    grassTexture.repeat.set(1, 1);
    ground.geometry.attributes.uv.array.forEach((v, i, a) => {
      a[i] = v * 100;
    });
    ribbon(-9.15, 9.15, mats.roadside, 500, false, -0.045);
    ribbon(-8.1, 8.1, mats.road, 500, false, 0.045);
    ribbon(8.1, 9.05, [mats.red, mats.white], 520, true, 0.085);
    ribbon(-9.05, -8.1, [mats.white, mats.red], 520, true, 0.085);
    // Intermittent lane ticks make the racing line legible at speed.
    const dash = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.13, 0.025, 2.4),
      mats.white,
      54,
    );
    for (let i = 0; i < 54; i++) {
      let f = frameAt(i / 54),
        p = f.p.clone().addScaledVector(f.up, 0.08);
      tempObj.position.copy(p);
      tempObj.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          f.right,
          f.up,
          f.tangent.clone().negate(),
        ),
      );
      tempObj.updateMatrix();
      dash.setMatrixAt(i, tempObj.matrix);
    }
    dash.instanceMatrix.needsUpdate = true;
    scene.add(dash);
    // Low-poly pine forest in instanced batches keeps the scene light enough for a browser.
    const count = 320,
      trunk = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.16, 0.24, 1.5, 8),
        mats.trunk,
        count,
      ),
      lower = new THREE.InstancedMesh(
        new THREE.ConeGeometry(1, 1.7, 16, 3),
        mats.pine,
        count,
      ),
      upper = new THREE.InstancedMesh(
        new THREE.ConeGeometry(0.76, 1.55, 16, 3),
        mats.pine2,
        count,
      );
    for (let i = 0; i < count; i++) {
      let t = Math.random(),
        f = frameAt(t),
        side = Math.random() < 0.5 ? -1 : 1,
        dist = 14 + Math.random() * 48,
        p = f.p.clone().addScaledVector(f.right, side * dist);
      const surface = projectTrack(p, 0, true),
        clear = surface.distance > 12,
        base =
          -1.68 +
          (surface.height - 0.065 + 1.55) *
            (1 - THREE.MathUtils.smoothstep(surface.distance, 10, 25));
      let scale = clear ? 0.75 + Math.random() * 1.45 : 0,
        rot = Math.random() * TAU;
      tempObj.position.set(p.x, base + scale * 0.75, p.z);
      tempObj.rotation.set(0, rot, 0);
      tempObj.scale.set(scale, scale, scale);
      tempObj.updateMatrix();
      trunk.setMatrixAt(i, tempObj.matrix);
      tempObj.position.set(p.x, base + scale * 1.8, p.z);
      tempObj.scale.set(scale * 1.35, scale * 1.5, scale * 1.35);
      tempObj.updateMatrix();
      lower.setMatrixAt(i, tempObj.matrix);
      tempObj.position.set(p.x, base + scale * 2.7, p.z);
      tempObj.scale.set(scale, scale * 1.3, scale);
      tempObj.updateMatrix();
      upper.setMatrixAt(i, tempObj.matrix);
    }
    for (const m of [trunk, lower, upper]) {
      m.instanceMatrix.needsUpdate = true;
      m.castShadow = true;
      scene.add(m);
    }
    // A few distant rounded hills and drifting clouds establish depth beyond the circuit.
    for (let i = 0; i < 20; i++) {
      const a = (TAU * i) / 20,
        r = 235 + Math.random() * 45,
        geo = new THREE.SphereGeometry(1, 24, 16),
        hill = addMesh(geo, mat(i % 2 ? "#75a688" : "#8abb9d"));
      hill.position.set(
        Math.cos(a) * r,
        -15 + Math.random() * 5,
        Math.sin(a) * r,
      );
      hill.scale.set(
        28 + Math.random() * 36,
        17 + Math.random() * 18,
        30 + Math.random() * 36,
      );
      hill.castShadow = false;
    }
    const cloudMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 1,
    });
    for (let i = 0; i < 17; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const puff = addMesh(new THREE.SphereGeometry(1, 16, 12), cloudMat, g);
        puff.position.set(j * 2.4, Math.sin(j * 1.6) * 0.45, 0);
        puff.scale.set(2.4, 1.25, 1.2);
        puff.castShadow = false;
      }
      g.position.set(
        -140 + Math.random() * 280,
        34 + Math.random() * 25,
        -130 + Math.random() * 260,
      );
      g.userData.drift = 0.4 + Math.random() * 0.6;
      batchStaticMeshes(g);
      scene.add(g);
      clouds.push(g);
    }
    // Banked roadside guardrails, spaced enough to leave the landscape visible.
    // Pressed-metal guardrails have a corrugated profile and visible support posts.
    const railShape = new THREE.Shape();
    const profile = [[0, -0.425], [0.02, -0.34], [0.12, -0.26], [0.12, -0.16],
      [0.02, -0.07], [0.02, 0.07], [0.12, 0.16], [0.12, 0.26],
      [0.02, 0.34], [0, 0.425]];
    railShape.moveTo(...profile[0]);
    for (const p of profile.slice(1)) railShape.lineTo(...p);
    for (const [x, y] of [...profile].reverse()) railShape.lineTo(x - 0.04, y);
    railShape.closePath();
    const railGeom = new THREE.ExtrudeGeometry(railShape, { depth: 7.2, bevelEnabled: false, steps: 1 });
    railGeom.translate(0, 0, -3.6);
    const railCount = 290,
      railMesh = new THREE.InstancedMesh(railGeom, mats.rail, railCount),
      railPosts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 1.15, 0.18), mats.rail, railCount);
    for (let i = 0; i < railCount; i++) {
      const f = frameAt(i / railCount),
        side = i % 2 ? 1 : -1,
        p = f.p
          .clone()
          .addScaledVector(f.right, side * 9.6)
          .addScaledVector(f.up, 0.6);
      tempObj.position.copy(p);
      tempObj.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          f.right,
          f.up,
          f.tangent.clone().negate(),
        ),
      );
      tempObj.scale.set(1, 1, 1);
      tempObj.updateMatrix();
      railMesh.setMatrixAt(i, tempObj.matrix);
      tempObj.position.addScaledVector(f.up, -0.23);
      tempObj.updateMatrix(); railPosts.setMatrixAt(i, tempObj.matrix);
    }
    railMesh.instanceMatrix.needsUpdate = true;
    railMesh.receiveShadow = true;
    railPosts.castShadow = true;
    scene.add(railMesh, railPosts);
    landscape = addLandscape(scene, renderer, mats.grass, textures);
    addFinishArch();
    addPads();
    addItemBoxes();
  }
  const clouds = [],
    pads = [],
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
    const g = new THREE.Group(),
      post = mat("#f7f0d5", 0.36),
      accent = mat("#f76150", 0.5),
      beam = mat("#fa7654", 0.4);
    for (const x of [-9, 9]) {
      const p = addMesh(new THREE.BoxGeometry(0.72, 5.3, 0.8), post, g);
      p.position.set(x, 2.6, 0);
      const a = addMesh(new THREE.BoxGeometry(0.9, 0.75, 1), accent, g);
      a.position.set(x, 4.8, 0);
    }
    const top = addMesh(bevelBox(19, 0.85, 0.9, 0.15), beam, g);
    top.position.set(0, 5.1, 0);
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
    bx.fillText("★  TURBO TRAIL  ★", 512, 43);
    const bt = new THREE.CanvasTexture(banner);
    bt.colorSpace = THREE.SRGBColorSpace;
    for (const z of [-0.46, 0.46]) {
      const sign = addMesh(
        new THREE.PlaneGeometry(13, 0.72),
        new THREE.MeshBasicMaterial({ map: bt }),
        g,
      );
      sign.position.set(0, 5.1, z);
      if (z > 0) sign.rotation.y = Math.PI;
      sign.castShadow = false;
    }
    for (let i = 0; i < 12; i++) {
      const tile = addMesh(
        new THREE.BoxGeometry(1.5, 0.16, 0.95),
        i % 2 ? mats.white : mats.black,
        g,
      );
      tile.position.set(-8.25 + i * 1.5, 4.64, 0);
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
          p = center
            .clone()
            .addScaledVector(f.right, x)
            .addScaledVector(f.tangent, z),
          tile = addMesh(
            new THREE.BoxGeometry(0.82, 0.045, 0.38),
            (row + j) % 2 ? mats.white : mats.black,
          );
        tile.position.copy(p);
        tile.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(
            f.right,
            f.up,
            f.tangent.clone().negate(),
          ),
        );
        tile.castShadow = false;
      }
  }
  function addPads() {
    for (const t of [0.115, 0.385, 0.665, 0.89]) {
      const f = frameAt(t),
        g = new THREE.Group(),
        base = addMesh(new THREE.BoxGeometry(4.5, 0.18, 6.8), mats.pad, g);
      base.position.y = 0.11;
      for (let i = -1; i <= 1; i++) {
        const strip = addMesh(
          new THREE.BoxGeometry(0.18, 0.07, 5.8),
          mats.neon,
          g,
        );
        strip.position.set(i * 1.32, 0.23, 0);
      }
      alignGroup(g, f);
      scene.add(g);
      pads.push({ g, t, phase: Math.random() * TAU });
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
    for (let i = 0; i < 18; i++) {
      let s = 90 + i * 130,
        group = new THREE.Group(),
        cube = addMesh(
          new THREE.BoxGeometry(1.65, 1.65, 1.65),
          boxMaterial,
          group,
        );
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

  const karts = [],
    projectiles = [],
    bananas = [],
    particles = [];
  function buildKart(color, name, isPlayer = false) {
    const root = new THREE.Group();
    root.name = name;
    const paint = mat(color, 0.34, { metalness: 0.2, map: textures.paint }),
      highlight = mat(
        new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.42),
        0.32,
        { metalness: 0.25 },
      ),
      dark = mat("#18242e", 0.68, surface(textures.fabric, 0.012)),
      rubber = mat("#ffffff", 0.92, surface(textures.tire, 0.035)),
      skin = mat("#e4ad7c", 0.8),
      helmet = mat(color, 0.25, { metalness: 0.25, map: textures.paint });
    const body = addMesh(bevelBox(1.6, 0.48, 2.22), paint, root);
    body.position.y = 0.73;
    const nose = addMesh(bevelBox(1.08, 0.23, 0.75), highlight, root);
    nose.position.set(0, 0.82, -1.12);
    const sideL = addMesh(bevelBox(0.18, 0.27, 1.5), paint, root);
    sideL.position.set(-0.84, 0.53, -0.05);
    const sideR = sideL.clone();
    sideR.position.x = 0.84;
    root.add(sideR);
    const bumper = addMesh(bevelBox(1.83, 0.18, 0.28), dark, root);
    bumper.position.set(0, 0.5, -1.28);
    const spoilerPost = addMesh(bevelBox(0.12, 0.65, 0.14), dark, root);
    spoilerPost.position.set(0, 1.05, 0.88);
    const spoiler = addMesh(bevelBox(1.45, 0.16, 0.42), highlight, root);
    spoiler.position.set(0, 1.37, 0.9);
    const driver = addMesh(new THREE.SphereGeometry(0.49, 24, 16), dark, root);
    driver.position.set(0, 1.22, 0.18);
    driver.scale.set(0.83, 1.05, 0.76);
    const head = addMesh(new THREE.SphereGeometry(0.35, 24, 16), skin, root);
    head.position.set(0, 1.78, -0.08);
    const helmetTop = addMesh(
      new THREE.SphereGeometry(0.39, 24, 16, 0, TAU, 0, Math.PI * 0.62),
      helmet,
      root,
    );
    helmetTop.position.set(0, 1.88, -0.08);
    const visor = addMesh(
      bevelBox(0.52, 0.13, 0.12),
      mat("#10252f", 0.2, { metalness: 0.55 }),
      root,
    );
    visor.position.set(0, 1.81, -0.43);
    const eyeL = addMesh(
      new THREE.SphereGeometry(0.035, 6, 5),
      mats.white,
      root,
    );
    eyeL.position.set(-0.12, 1.83, -0.49);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    root.add(eyeR);
    const limb = (start, end, r, material) => {
      const a = new THREE.Vector3(...start),
        b = new THREE.Vector3(...end),
        delta = b.clone().sub(a),
        mesh = addMesh(
          new THREE.CylinderGeometry(r * 0.8, r, delta.length(), 12),
          material,
          root,
        );
      mesh.position.copy(a.add(b).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      );
      return mesh;
    };
    for (const side of [-1, 1]) {
      limb(
        [side * 0.31, 1.47, 0.02],
        [side * 0.34, 1.17, -0.48],
        0.14,
        highlight,
      );
      const glove = addMesh(new THREE.SphereGeometry(0.14, 12, 8), dark, root);
      glove.position.set(side * 0.34, 1.16, -0.5);
    }
    const steering = addMesh(
      new THREE.TorusGeometry(0.34, 0.055, 7, 18),
      dark,
      root,
    );
    steering.position.set(0, 1.23, -0.57);
    steering.rotation.x = 1.18;
    const dashBoard = addMesh(bevelBox(0.82, 0.13, 0.31), dark, root);
    dashBoard.position.set(0, 1.06, -0.46);
    const badge = addMesh(bevelBox(0.31, 0.035, 0.035), mats.gold, root);
    badge.position.set(0, 0.94, -1.02);
    const chrome = mat("#b8c9d2", 0.3, { metalness: 0.65 });
    // Sculpted side pods, vents, suspension and a visible rear engine.
    for (const side of [-1, 1]) {
      const pod = addMesh(bevelBox(0.34, 0.34, 1.1, 0.14), paint, root);
      pod.position.set(side * 0.82, 0.77, 0.05);
      for (let i = 0; i < 4; i++) {
        const vent = addMesh(bevelBox(0.025, 0.09, 0.12, 0.01), dark, root);
        vent.position.set(side * 1.0, 0.8, 0.1 + i * 0.16);
        vent.rotation.x = -0.25;
      }
      limb([side * 0.45, 0.51, -0.65], [side * 0.87, 0.44, -0.65], 0.055, chrome);
      const endPlate = addMesh(bevelBox(0.08, 0.28, 0.48, 0.035), paint, root);
      endPlate.position.set(side * 0.73, 1.4, 0.9);
      const stripe = addMesh(bevelBox(0.14, 0.015, 0.64, 0.004), mats.white, root);
      stripe.position.set(side * 0.25, 0.944, -1.12);
    }
    const engine = addMesh(bevelBox(0.64, 0.38, 0.48, 0.07), chrome, root);
    engine.position.set(0, 0.92, 0.99);
    for (let i = 0; i < 5; i++) {
      const fin = addMesh(bevelBox(0.73, 0.035, 0.45, 0.008), dark, root);
      fin.position.set(0, 0.78 + i * 0.065, 1.01);
    }
    const decalCanvas = document.createElement('canvas');
    decalCanvas.width = decalCanvas.height = 128;
    const dc = decalCanvas.getContext('2d');
    dc.fillStyle = '#fff8dc'; dc.beginPath(); dc.arc(64, 64, 56, 0, TAU); dc.fill();
    dc.strokeStyle = color; dc.lineWidth = 7; dc.stroke();
    dc.fillStyle = '#243a4b'; dc.font = 'italic 900 76px sans-serif';
    dc.textAlign = 'center'; dc.textBaseline = 'middle'; dc.fillText(String(karts.length + 1), 60, 68);
    const decalTexture = new THREE.CanvasTexture(decalCanvas);
    decalTexture.colorSpace = THREE.SRGBColorSpace;
    const decalMaterial = mat('#ffffff', 0.6, { map: decalTexture, transparent: true, depthWrite: false });
    const number = addMesh(new THREE.PlaneGeometry(0.47, 0.47), decalMaterial, root);
    number.rotation.x = -Math.PI / 2;
    number.position.set(0, 0.977, -0.79);
    number.castShadow = false;
    for (const side of [-1, 1]) {
      const patch = addMesh(new THREE.PlaneGeometry(0.31, 0.31), decalMaterial, root);
      patch.rotation.y = side * Math.PI / 2;
      patch.position.set(side * 1.003, 0.78, -0.24);
      patch.castShadow = false;
    }
    const wheelGeo = new THREE.LatheGeometry(
      [[0.24, -0.18], [0.35, -0.18], [0.41, -0.13], [0.43, -0.07],
       [0.43, 0.07], [0.41, 0.13], [0.35, 0.18], [0.24, 0.18]]
        .map(([r, y]) => new THREE.Vector2(r, y)), 32),
      wheels = [];
    for (const z of [-0.68, 0.76])
      for (const x of [-0.82, 0.82]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.42, z);
        const spin = new THREE.Group();
        pivot.add(spin);
        const tire = addMesh(wheelGeo, rubber, spin);
        tire.rotation.z = Math.PI / 2;
        const hub = addMesh(
          new THREE.CylinderGeometry(0.23, 0.23, 0.34, 16),
          highlight,
          spin,
        );
        hub.rotation.z = Math.PI / 2;
        const cap = addMesh(
          new THREE.CylinderGeometry(0.09, 0.09, 0.36, 12),
          dark,
          spin,
        );
        cap.rotation.z = Math.PI / 2;
        for (const side of [-1, 1]) {
          const rim = addMesh(new THREE.TorusGeometry(0.255, 0.025, 6, 24), chrome, spin);
          rim.rotation.y = Math.PI / 2;
          rim.position.x = side * 0.185;
          for (let i = 0; i < 5; i++) {
            const a = i * TAU / 5;
            const spoke = addMesh(bevelBox(0.028, 0.19, 0.045, 0.008), chrome, spin);
            spoke.rotation.x = a;
            spoke.position.set(side * 0.19, Math.cos(a) * 0.14, Math.sin(a) * 0.14);
          }
        }
        batchStaticMeshes(spin);
        root.add(pivot);
        wheels.push({ pivot, spin, front: z < 0 });
      }
    const exhaustMat = mat("#ff9b49", 0.28, {
        emissive: "#ff5018",
        emissiveIntensity: 0,
      }),
      flame = addMesh(new THREE.ConeGeometry(0.15, 0.8, 7), exhaustMat, root);
    flame.position.set(0, 0.66, 1.48);
    flame.rotation.x = -Math.PI / 2;
    const aura = new THREE.Group();
    const ring = addMesh(
      new THREE.TorusGeometry(1.45, 0.07, 7, 36),
      new THREE.MeshBasicMaterial({ color: "#e9f562" }),
      aura,
    );
    ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const star = addMesh(
        new THREE.OctahedronGeometry(0.23),
        new THREE.MeshBasicMaterial({
          color: ["#fc6adf", "#56f2ec", "#fff263", "#ff9851", "#9f83ff"][i],
        }),
        aura,
      );
      star.userData.a = (i * TAU) / 5;
      star.userData.r = 1.7;
    }
    aura.position.y = 1.35;
    root.add(aura);
    aura.visible = false;
    const bodyGroup = new THREE.Group();
    for (const child of [...root.children])
      if (!wheels.some((w) => w.pivot === child)) bodyGroup.add(child);
    root.add(bodyGroup);
    const seat = addMesh(bevelBox(0.78, 0.85, 0.32), dark, bodyGroup);
    seat.position.set(0, 1.22, 0.57);
    seat.rotation.x = -0.12;
    for (const x of [-0.68, 0.68]) {
      const pipe = addMesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.65, 12),
        mat("#dde7e6", 0.28, { metalness: 0.75 }),
        bodyGroup,
      );
      pipe.position.set(x, 0.65, 1.15);
      pipe.rotation.x = Math.PI / 2;
    }
    batchStaticMeshes(bodyGroup, [flame]);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.8),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.27,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    scene.add(shadow);
    scene.add(root);
    const kart = {
      root,
      bodyGroup,
      shadow,
      wheels,
      flame,
      exhaustMat,
      aura,
      paint,
      helmet,
      name,
      isPlayer,
      color,
    };
    karts.push(kart);
    return kart;
  }

  const player = {
    s: 0,
    x: 0,
    speed: 0,
    yaw: 0,
    worldPos: new THREE.Vector3(),
    lap: 0,
    boost: 0,
    star: 0,
    spin: 0,
    drift: 0,
    driftTier: 0,
    item: null,
    itemCount: 0,
    air: 0,
    padCooldown: 0,
    finished: false,
    prevS: 0,
  };
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
  ];
  resetMotion(player);
  bots.forEach((b) => {
    resetMotion(b);
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
  function ordinal(n) {
    return `${n}${n === 1 ? "ST" : n === 2 ? "ND" : n === 3 ? "RD" : "TH"}`;
  }
  function formatTime(t) {
    let m = Math.floor(t / 60),
      s = Math.floor(t % 60),
      cs = Math.floor((t % 1) * 100);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  }
  function notify(text) {
    ui.toast.textContent = text;
    toastLeft = 1.65;
  }
  let audio = null,
    engineGain = null,
    engineOsc = null,
    engineFilter = null;
  function startAudio() {
    if (audio) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = new AC();
    const master = audio.createGain();
    master.gain.value = 0.23;
    master.connect(audio.destination);
    engineFilter = audio.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 460;
    engineGain = audio.createGain();
    engineGain.gain.value = 0.025;
    engineOsc = audio.createOscillator();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 62;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    const harmonic = audio.createOscillator(),
      hg = audio.createGain();
    harmonic.type = "triangle";
    harmonic.frequency.value = 124;
    hg.gain.value = 0.009;
    harmonic.connect(hg);
    hg.connect(master);
    harmonic.start();
    audio.master = master;
    audio.harmonic = harmonic;
    audio.harmonicGain = hg;
  }
  function tone(
    freq = 440,
    duration = 0.13,
    type = "triangle",
    volume = 0.13,
    slide = 0,
  ) {
    if (!audio) return;
    const osc = audio.createOscillator(),
      gain = audio.createGain(),
      now = audio.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide)
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, freq + slide),
        now + duration,
      );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
  function sfx(kind) {
    if (kind === "pickup") {
      tone(660, 0.1, "sine", 0.12, 280);
      setTimeout(() => tone(990, 0.12, "sine", 0.09, 180), 65);
    } else if (kind === "boost") {
      tone(180, 0.35, "sawtooth", 0.17, 650);
    } else if (kind === "shell") {
      tone(360, 0.25, "square", 0.12, -230);
    } else if (kind === "jump") {
      tone(240, 0.38, "triangle", 0.12, 570);
    } else if (kind === "hit") {
      tone(115, 0.24, "sawtooth", 0.18, -60);
    } else if (kind === "star") {
      tone(540, 0.35, "triangle", 0.08, 900);
    }
  }
  function syncItem() {
    const i = player.item,
      labels = {
        mushroom: `MUSHROOM ×${player.itemCount}`,
        green: "GREEN SHELL",
        red: "RED SHELL",
        banana: "BANANA PEEL",
        star: "RAINBOW STAR",
      };
    ui.itemIcon.textContent =
      { mushroom: "🍄", green: "●", red: "◉", banana: "⌁", star: "✦" }[i] ||
      "?";
    ui.itemLabel.textContent = labels[i] || "ITEM";
    ui.item.style.opacity = i ? "1" : ".65";
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
    const pool = ["mushroom", "green", "red", "banana", "star"];
    setItem(who, pool[Math.floor(Math.random() * pool.length)]);
    if (who === player) {
      notify(
        `${{ mushroom: "TRIPLE MUSHROOMS", green: "GREEN SHELL", red: "HOMING RED SHELL", banana: "BANANA PEELS", star: "RAINBOW STAR" }[who.item]}!`,
      );
      sfx("pickup");
    }
  }

  function spawnParticle(pos, color, life = 0.6, size = 0.2, velocity = null) {
    if (particles.length > 95) {
      disposeEffect(particles[0].mesh);
      particles.shift();
    }
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    mesh.position.copy(pos);
    scene.add(mesh);
    particles.push({
      mesh,
      life,
      max: life,
      velocity:
        velocity ||
        new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 2,
          (Math.random() - 0.5) * 2,
        ),
    });
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
        const tip = addMesh(
          new THREE.ConeGeometry(0.17, 0.3, 6),
          mat("#66b36c"),
          g,
        );
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
      const stripe = addMesh(
        new THREE.TorusGeometry(0.54, 0.075, 5, 12),
        mats.white,
        g,
      );
      stripe.rotation.x = Math.PI / 2;
    }
    return g;
  }
  function fireItem(who) {
    if (!who.item || who.finished || who.spin > 0) return;
    const type = who.item,
      isPlayer = who === player,
      from = who.s,
      lane = who.x;
    who.itemCount--;
    if (type === "mushroom") {
      who.boost = Math.max(who.boost, 0.95);
      if (!who.itemCount) who.item = null;
      if (isPlayer) {
        notify(
          who.itemCount ? `TURBO! ${who.itemCount} LEFT` : "MUSHROOM BOOST!",
        );
        sfx("boost");
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
        sfx("star");
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
        sfx("shell");
      }
    } else if (type === "green" || type === "red") {
      let target = null;
      if (type === "red") {
        const rivals = [player, ...bots].filter(
          (b) => b !== who && !b.finished && b.s > who.s,
        );
        target = rivals.sort((a, b) => a.s - b.s)[0] || null;
      }
      const q = { ...createShell(who, type, target), mesh: getItemModel(type) };
      scene.add(q.mesh);
      projectiles.push(q);
      if (isPlayer) {
        notify(type === "red" ? "HOMING RED SHELL!" : "GREEN SHELL!");
        sfx("shell");
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
    clearInput();
    bots.forEach((b, i) => {
      b.s = -46 - Math.floor(i / 2) * 60 - (i % 2) * 5;
      b.prevS = b.s;
      b.x = [-0.4, 0.4, -0.4, 0.4, -0.4][i];
      b.speed = 0;
      resetMotion(b);
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
    particles.splice(0).forEach((p) => disposeEffect(p.mesh));
    elapsed = 0;
    raceTime = 0;
    running = false;
    paused = false;
    finished = false;
    toastLeft = 0;
    shake = 0;
    ui.toast.textContent = "";
    syncItem();
    updateVehicle(player, playerKart, 0, true);
  }
  function begin() {
    reset();
    startAudio();
    if (audio?.state === "suspended") audio.resume();
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
    countdown = 3.45;
    ui.count.classList.remove("hidden");
    canvas.focus({ preventScroll: true });
    tone(420, 0.18, "square", 0.08);
  }
  function finish() {
    finished = true;
    running = false;
    raceTime = player.finishTime;
    let p = place();
    $("final-place").textContent = ordinal(p);
    $("final-time").textContent = formatTime(player.finishTime);
    $("finish-title").textContent =
      p === 1 ? "WHAT A RACE!" : p <= 3 ? "PODIUM FINISH!" : "RACE COMPLETE!";
    $("finish-copy").textContent =
      p === 1
        ? "You left the whole pack in your dust."
        : "Every turn counts. There’s always the next race.";
    ui.finish.classList.remove("hidden");
    $("again-button").focus({ preventScroll: true });
    document.querySelector("#game-shell").classList.remove("racing");
    engineGain?.gain.setTargetAtTime(0, audio.currentTime, 0.1);
  }
  function clearInput() {
    for (const key of Object.keys(keys)) delete keys[key];
    pointer.down = false;
    pointer.steer = 0;
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
  $("resume-button").addEventListener("click", () => setPaused(false));
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
      e.preventDefault();
    if (k === "escape" && !e.repeat) {
      setPaused(!paused);
      return;
    }
    if (paused || e.target.closest("button")) return;
    keys[k] = true;
    if ((k === "e" || k === "enter") && !e.repeat && running) fireItem(player);
    if (k === "r" && !e.repeat && running && player.speed < 12) {
      recoverPlayer();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  window.addEventListener("blur", () => {
    clearInput();
    if (started && !finished) setPaused(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInput();
      if (started && !finished) setPaused(true);
    }
  });
  document.querySelectorAll("#touch-controls [data-key]").forEach((button) => {
    const key = button.dataset.key;
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!paused && running) {
        button.setPointerCapture(e.pointerId);
        keys[key] = true;
      }
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      button.addEventListener(event, () => {
        keys[key] = false;
      });
  });
  document
    .querySelector('[data-action="pause"]')
    .addEventListener("click", () => setPaused(!paused));
  document
    .querySelector('[data-action="recover"]')
    .addEventListener("click", () => {
      if (running && !paused && player.speed < 12) recoverPlayer();
    });
  document
    .querySelector('[data-action="item"]')
    .addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (running && !paused) fireItem(player);
    });
  const pointer = { down: false, x: 0, steer: 0 };
  canvas.addEventListener("pointerdown", (e) => {
    if (running && !paused) {
      pointer.down = true;
      pointer.x = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (pointer.down)
      pointer.steer = clamp((e.clientX - pointer.x) / 85, -1, 1);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(event, () => {
      pointer.down = false;
      pointer.steer = 0;
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
    dpr = Math.min(devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  const kartUp = new THREE.Vector3(0, 1, 0),
    kartForward = new THREE.Vector3(),
    kartRight = new THREE.Vector3(),
    kartBasis = new THREE.Matrix4();
  function updateVehicle(state, kart, dt) {
    const f = frameAt(trackT(state.s));
    kart.root.position
      .copy(state.renderFrom || state.worldPos)
      .lerp(state.worldPos, dt ? accumulator / FIXED_DT : 1);
    kartUp.copy(state.grounded ? f.up : new THREE.Vector3(0, 1, 0));
    kartForward.set(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    kartForward.addScaledVector(kartUp, -kartForward.dot(kartUp)).normalize();
    kartRight.crossVectors(kartUp, kartForward).normalize();
    kartBasis.makeBasis(kartRight, kartUp, kartForward);
    kart.root.quaternion.slerp(
      new THREE.Quaternion().setFromRotationMatrix(kartBasis),
      dt ? 1 - Math.exp(-14 * dt) : 1,
    );
    kart.bodyGroup.rotation.z = state.grounded
      ? ((state.steering * state.speed) / MAX_SPEED) * 0.065
      : 0;
    kart.bodyGroup.position.y =
      Math.sin(elapsed * 22) * Math.min(0.025, state.speed * 0.0003);
    for (const wheel of kart.wheels) {
      wheel.spin.rotation.x -= (state.longitudinalSpeed * dt) / 0.42;
      wheel.pivot.rotation.y = wheel.front ? -state.steering * 0.32 : 0;
    }
    kart.flame.visible = state.boost > 0;
    kart.flame.scale.setScalar(0.8 + Math.sin(elapsed * 40) * 0.18);
    kart.exhaustMat.emissiveIntensity = state.boost > 0 ? 3 : 0;
    kart.aura.visible = state.star > 0;
    if (state.star > 0) {
      kart.aura.rotation.y += dt * 3;
      for (const star of kart.aura.children.slice(1)) {
        star.position.set(
          Math.cos(star.userData.a + elapsed * 2) * star.userData.r,
          0.2 + Math.sin(elapsed * 4 + star.userData.a) * 0.2,
          Math.sin(star.userData.a + elapsed * 2) * star.userData.r,
        );
        star.rotation.x += dt * 3;
      }
    }
    kart.shadow.position.copy(poseAt(state.s, laneWidth(state.x), 0.08).p);
    kart.shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.up);
    const altitude = Math.max(0, state.worldPos.y - kart.shadow.position.y);
    kart.shadow.material.opacity = 0.27 / (1 + altitude * 0.25);
    kart.shadow.scale.setScalar(1 + altitude * 0.08);
  }
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
    if (state.invulnerable > 0 || state.star > 0 || state.finished)
      return false;
    state.spin = seconds;
    state.invulnerable = seconds + 1;
    state.vx *= 0.55;
    state.vz *= 0.55;
    state.drift = 0;
    if (state === player) {
      shake = 0.22;
      sfx("hit");
    }
    return true;
  }
  function moveRacer(state, input, dt) {
    const events = advanceRacer(state, input, dt, raceTime);
    const sliding = events.sliding;
    if (events.wallImpact && state.contactCooldown === 0) {
      state.contactCooldown = 0.45;
      if (state === player) {
        shake = 0.1;
        sfx("hit");
      }
    }
    if (events.launched && state === player) {
      notify("AIR TIME!");
      sfx("jump");
    }
    if (events.landed && state === player) {
      shake = 0.09;
      notify("SMOOTH LANDING");
    }
    if (events.turboTier && state === player) {
      notify(
        events.turboTier === 2 ? "ORANGE MINI-TURBO!" : "BLUE MINI-TURBO!",
      );
      sfx("boost");
    }
    if (sliding && state === player && Math.random() < dt * 35) {
      spawnParticle(
        state.worldPos.clone().add(new THREE.Vector3(0, 0.35, 0)),
        state.driftTier === 2
          ? "#ff984c"
          : state.driftTier === 1
            ? "#43e6ff"
            : "#bbc8cc",
        0.35,
        0.1,
      );
    }
    if (state.grounded && state.padCooldown === 0) {
      for (const pad of pads) {
        if (
          Math.abs(nearestDelta(state.s, pad.t * TRACK)) < 13 &&
          Math.abs(state.x) < 0.36
        ) {
          state.boost = 1.45;
          state.padCooldown = 1.5;
          if (state === player) {
            notify("NEON BOOST!");
            sfx("boost");
          }
          break;
        }
      }
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
      tone(520, 0.22, "square", 0.1, 300);
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
        countdown > 2.45
          ? "3"
          : countdown > 1.45
            ? "2"
            : countdown > 0.45
              ? "1"
              : "GO!";
      if (Math.ceil(countdown - 0.45) < previous)
        tone(countdown > 0.45 ? 420 : 840, 0.15, "square", 0.08);
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
          ? botInput(player, 0, elapsed, [player, ...bots])
          : {
              throttle: keys.arrowup || keys.w,
              brake: keys.arrowdown || keys.s,
              steer:
                (keys.arrowright || keys.d ? 1 : 0) -
                  (keys.arrowleft || keys.a ? 1 : 0) || pointer.steer,
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
      moveRacer(b, botInput(b, i, elapsed, [player, ...bots]), dt);
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
        if (
          a.finished ||
          b.finished ||
          Math.abs(a.worldPos.y - b.worldPos.y) > 1.5
        )
          continue;
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
          if (closing < -2) sfx("hit");
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
            Math.abs(
              racer.worldPos.y - poseAt(box.s, laneWidth(box.x), 0.065).p.y,
            ) < 2 &&
            Math.abs(nearestDelta(racer.s, box.s)) < 7 &&
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
          Math.abs(nearestDelta(racer.s, banana.s)) < 8 &&
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
      advanceShell(p, dt);
      for (const target of [player, ...bots]) {
        if (
          target.finished ||
          p.life <= 0 ||
          (target === p.owner && p.grace > 0)
        )
          continue;
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
    for (const p of particles) {
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= dt * 1.5;
      p.mesh.material.opacity = Math.max(0, p.life / p.max);
      p.mesh.scale.setScalar(0.45 + 0.9 * Math.max(0, p.life / p.max));
    }
    for (let i = particles.length - 1; i >= 0; i--)
      if (particles[i].life <= 0) {
        disposeEffect(particles[i].mesh);
        particles.splice(i, 1);
      }
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
    rctx.clearRect(0, 0, cw, ch);
    rctx.fillStyle = "rgba(5,16,28,.78)";
    rctx.beginPath();
    rctx.roundRect(0, 0, cw, ch, 8);
    rctx.fill();
    rctx.strokeStyle = "rgba(206,247,244,.14)";
    rctx.lineWidth = 9;
    rctx.lineJoin = "round";
    rctx.lineCap = "round";
    const points = radarPoints,
      { minX, maxX, minZ, maxZ } = radarBounds,
      scale = Math.min(
        (cw - pad * 2) / (maxX - minX),
        (ch - pad * 2) / (maxZ - minZ),
      );
    const map = (p) => [
      pad + (p[0] - minX) * scale,
      pad + (p[1] - minZ) * scale,
    ];
    rctx.beginPath();
    points.forEach((p, i) => {
      const q = map(p);
      i ? rctx.lineTo(q[0], q[1]) : rctx.moveTo(q[0], q[1]);
    });
    rctx.closePath();
    rctx.stroke();
    rctx.strokeStyle = "rgba(211,255,239,.45)";
    rctx.lineWidth = 2;
    rctx.stroke();
    const dot = (s, lane, color, size) => {
      const f = poseAt(s, laneWidth(lane), 0.2),
        q = map([f.p.x, f.p.z]);
      rctx.fillStyle = color;
      rctx.beginPath();
      rctx.arc(q[0], q[1], size, 0, TAU);
      rctx.fill();
    };
    for (const box of boxes) if (box.active) dot(box.s, box.x, "#5af2dd", 1.6);
    for (const b of bots) if (!b.finished) dot(b.s, b.x, b.color, 3.2);
    dot(player.s, player.x, "#d5fa51", 4.2);
    rctx.fillStyle = "#d5fa51";
    rctx.font = 'bold 9px "DM Mono",monospace';
    rctx.fillText("TRACK RADAR", 10, ch - 7);
  }
  const cameraLook = new THREE.Vector3();
  let accumulator = 0,
    hudClock = 0,
    radarClock = 0,
    performanceTime = 0,
    performanceFrames = 0;
  function render(dt) {
    if (!paused) {
      if (landscape) {
        landscape.rotor.rotation.z += dt * 0.75;
        landscape.balloons.forEach(
          (b, i) => (b.rotation.z = Math.sin(elapsed * 0.4 + i) * 0.05),
        );
      }
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.drift * dt;
        if (cloud.position.x > 250) cloud.position.x = -250;
      }
      for (const pad of pads) {
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5 + pad.phase);
        pad.g.children.forEach((m, i) => {
          if (i > 0) m.material.emissiveIntensity = 1.2 + pulse * 2;
        });
      }
      for (const box of boxes) {
        if (box.active) {
          const f = poseAt(
            box.s,
            box.x * 6.25,
            2.3 + Math.sin(elapsed * 2.4 + box.phase) * 0.24,
          );
          box.group.position.copy(f.p);
          box.group.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(
              f.right,
              f.up,
              f.tangent.clone().negate(),
            ),
          );
          box.group.rotateY(elapsed * 0.6 + box.phase);
        }
      }
      for (const b of bananas) {
        b.mesh.position.copy(poseAt(b.s, laneWidth(b.x), 0.25).p);
        b.mesh.rotation.y += dt * 1.5;
      }
      for (const p of projectiles) {
        p.mesh.position.copy(p.worldPos);
        p.mesh.rotation.y += dt * 7;
        p.mesh.rotation.x += dt * 4;
      }
      updateVehicle(player, playerKart, dt);
      bots.forEach((b) => updateVehicle(b, b.kart, dt));
    }
    hudClock += dt;
    radarClock += dt;
    if (radarClock > 0.08) {
      updateRadar();
      radarClock = 0;
    }
    if (hudClock > 0.05) {
      hudClock = 0;
      const rank = place();
      ui.place.innerHTML = `${rank}<small>${ordinal(rank).slice(String(rank).length)}</small>`;
      ui.lap.innerHTML = `${lapNumber(player.s, TRACK, TOTAL_LAPS)} <i>/ ${TOTAL_LAPS}</i>`;
      ui.lapFill.style.width = `${player.finished ? 100 : (modTrack(player.s) / TRACK) * 100}%`;
      ui.driftFill.style.width = `${Math.round(player.drift * 100)}%`;
      ui.speed.textContent = String(Math.round(player.speed)).padStart(3, "0");
      ui.timer.textContent = formatTime(raceTime);
      if (engineOsc) {
        engineOsc.frequency.setTargetAtTime(
          55 + player.speed * 1.2,
          audio.currentTime,
          0.08,
        );
        engineFilter.frequency.setTargetAtTime(
          330 + player.speed * 6,
          audio.currentTime,
          0.1,
        );
        engineGain.gain.setTargetAtTime(
          running && !finished ? 0.018 + player.speed / 10000 : 0.002,
          audio.currentTime,
          0.12,
        );
        audio.harmonic.frequency.setTargetAtTime(
          110 + player.speed * 2.4,
          audio.currentTime,
          0.08,
        );
      }
    }
    if (!paused) {
      let forward = new THREE.Vector3(
        -Math.sin(player.yaw),
        0,
        -Math.cos(player.yaw),
      );
      if (player.spin > 0)
        forward
          .copy(frameAt(trackT(player.s)).tangent)
          .setY(0)
          .normalize();
      const look = player.worldPos.clone().addScaledVector(forward, 7);
      look.y += 1.15;
      const desired = player.worldPos
        .clone()
        .addScaledVector(forward, -8.7 - player.speed * 0.017);
      desired.y += 4.7;
      camera.position.lerp(desired, 1 - Math.exp(-6 * dt));
      cameraLook.lerp(look, 1 - Math.exp(-9 * dt));
      const cameraTrack = projectTrack(camera.position, player.s);
      camera.position.y = Math.max(camera.position.y, cameraTrack.height + 2.1);
      camera.fov +=
        (63 +
          Math.min(7, player.speed * 0.045) +
          (player.boost > 0 ? 3 : 0) -
          camera.fov) *
        (1 - Math.exp(-3 * dt));
      camera.updateProjectionMatrix();
      camera.lookAt(cameraLook);
      if (shake) {
        camera.rotation.z += (Math.random() - 0.5) * shake * 0.05;
      }
    }
    sun.position.copy(player.worldPos).add(new THREE.Vector3(-65, 95, 45));
    sun.target.position.copy(player.worldPos);
    sun.target.updateMatrixWorld();
    renderer.shadowMap.autoUpdate = !paused && !finished;
    renderer.render(scene, camera);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused) {
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
        if (average > 0.025 && dpr > 0.85) {
          dpr = Math.max(0.85, dpr - 0.15);
          renderer.setPixelRatio(dpr);
          renderer.setSize(w, h, false);
        }
        performanceTime = 0;
        performanceFrames = 0;
      }
    }
    if (testMode) {
      testFrameStats.frames++;
      testFrameStats.total += dt;
      testFrameStats.max = Math.max(testFrameStats.max, dt);
      if (testFrameStats.frames % 30 === 0)
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
              s: player.s,
              x: player.x,
              speed: player.speed,
              item: player.item,
              itemCount: player.itemCount,
              grounded: player.grounded,
              drift: player.drift,
              boost: player.boost,
              spin: player.spin,
            },
            bots: bots.map((b) => ({ s: b.s, finished: b.finished })),
            effects: particles.length + bananas.length + projectiles.length,
            render: {
              geometries: renderer.info.memory.geometries,
              textures: renderer.info.memory.textures,
              drawCalls: renderer.info.render.calls,
              triangles: renderer.info.render.triangles,
              fps: testFrameStats.frames / Math.max(0.01, testFrameStats.total),
              maxFrame: testFrameStats.max,
            },
          },
          location.origin,
        );
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
      if (message.type === "test-auto") testAutodrive = !!message.value;
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
  player.yaw = yawFor(frameAt(0).tangent);
  player.worldPos.copy(poseAt(0, 0, 0.065).p);
  bots.forEach((b) => updateVehicle(b, b.kart, 0));
  updateVehicle(player, playerKart, 0, true);
  karts.forEach((k) => {
    k.root.visible = false;
    k.shadow.visible = false;
  });
  boxes.forEach((b) => (b.group.visible = false));
  camera.position.set(0, 30, 35);
  cameraLook.copy(player.worldPos);
  camera.lookAt(cameraLook);
  syncItem();
  requestAnimationFrame(frame);
})();
