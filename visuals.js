import * as THREE from "./vendor/three/three.module.js";
import { surfaceTexture } from "./textures.js";
import { frameAt, projectTrack } from "./track.js";

export function bevelBox(width, height, depth, radius = 0.12) {
  const r = Math.min(radius, width / 3, height / 3, depth / 3),
    x = -width / 2 + r,
    y = -height / 2 + r;
  const shape = new THREE.Shape();
  shape.moveTo(x, y);
  shape.lineTo(x + width - 2 * r, y);
  shape.lineTo(x + width - 2 * r, y + height - 2 * r);
  shape.lineTo(x, y + height - 2 * r);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * r,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: r,
    bevelThickness: r,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -depth / 2 + r);
  geometry.computeVertexNormals();
  return geometry;
}
export function contactShadow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d"),
    gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  gradient.addColorStop(0, "rgba(0,16,30,.7)");
  gradient.addColorStop(0.5, "rgba(0,16,30,.42)");
  gradient.addColorStop(1, "rgba(0,16,30,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
export function addLandscape(scene, renderer, grassMaterial, sharedTextures = {}) {
  const standard = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  const maps = Object.fromEntries(
    ['bark', 'leaves', 'brick', 'roof', 'water', 'fabric'].map(
      (kind) => [kind, sharedTextures[kind] || surfaceTexture(kind, renderer)],
    ),
  );
  const textured = (kind, color = '#ffffff', extra = {}) =>
    standard(color, { map: maps[kind], bumpMap: maps[kind], bumpScale: 0.045, ...extra });
  const mesh = (geometry, material, parent = scene) => {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(650, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        zenith: { value: new THREE.Color("#3299de") },
        horizon: { value: new THREE.Color("#bfe8fa") },
      },
      vertexShader:
        "varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "uniform vec3 zenith; uniform vec3 horizon; varying vec3 direction; void main(){float h=clamp(normalize(direction).y,0.,1.);gl_FragColor=vec4(mix(horizon,zenith,pow(h,.32)),1.); #include <tonemapping_fragment>\n #include <colorspace_fragment>\n }",
    }),
  );
  sky.material.fragmentShader = sky.material.fragmentShader
    .replace("; #include", ";\n#include")
    .replace(" }", "\n}");
  sky.frustumCulled = false;
  scene.add(sky);
  // The embankment meets the ground, so hills and ramps have solid terrain.
  const vertices = [],
    indices = [],
    uv = [],
    rows = 512,
    columns = 13;
  for (let i = 0; i <= rows; i++) {
    const f = frameAt(i / rows);
    for (let j = 0; j < columns; j++) {
      const offset = -25 + (j * 50) / (columns - 1),
        falloff = 1 - THREE.MathUtils.smoothstep(Math.abs(offset), 10, 25);
      const p = f.p.clone().addScaledVector(f.right, offset);
      p.y = -1.68 + (p.y + 1.55) * falloff;
      vertices.push(p.x, p.y, p.z);
      uv.push(p.x / 30, p.z / 30);
      if (i < rows && j < columns - 1) {
        const a = i * columns + j;
        indices.push(
          a,
          a + 1,
          a + columns,
          a + 1,
          a + columns + 1,
          a + columns,
        );
      }
    }
  }
  const terrain = new THREE.BufferGeometry();
  terrain.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  terrain.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  terrain.setIndex(indices);
  terrain.computeVertexNormals();
  const banks = mesh(terrain, grassMaterial);
  banks.castShadow = false;

  const lake = mesh(
    new THREE.CircleGeometry(30, 64),
    textured("water", "#ffffff", { roughness: 0.28, metalness: 0.15, bumpScale: 0.025 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, -1.6, 4);
  lake.scale.set(1, 0.7, 1);
  lake.castShadow = false;
  const island = mesh(new THREE.SphereGeometry(1, 24, 12), grassMaterial);
  island.position.set(10, -2.7, 3);
  island.scale.set(10, 2.5, 8);
  island.castShadow = false;
  const windmill = new THREE.Group();
  windmill.position.set(10, -0.3, 3);
  const tower = mesh(
    new THREE.CylinderGeometry(1.1, 1.7, 8, 24, 4),
    textured("brick"),
    windmill,
  );
  tower.position.y = 4;
  const roof = mesh(
    new THREE.ConeGeometry(2, 2.3, 24, 4),
    textured("roof"),
    windmill,
  );
  roof.position.y = 9;
  const trim = standard('#fff5da'), glass = standard('#315d77', { roughness: 0.24, metalness: 0.35 });
  for (const y of [3, 5.2, 7.3]) {
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, radius = 1.7 - y * 0.075;
      const frame = mesh(bevelBox(0.65, 0.94, 0.12, 0.07), trim, windmill);
      frame.position.set(Math.sin(a) * radius, y, Math.cos(a) * radius);
      frame.rotation.y = a;
      const pane = mesh(bevelBox(0.45, 0.72, 0.13, 0.045), glass, windmill);
      pane.position.copy(frame.position).add(new THREE.Vector3(Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06));
      pane.rotation.y = a;
      const crossbar = mesh(bevelBox(0.48, 0.05, 0.15, 0.01), trim, windmill);
      crossbar.position.copy(pane.position); crossbar.rotation.y = a;
    }
  }
  const door = mesh(bevelBox(0.85, 1.6, 0.18, 0.15), textured('bark'), windmill);
  door.position.set(0, 0.8, 1.66);
  const ledge = mesh(new THREE.CylinderGeometry(1.19, 1.19, 0.2, 24), trim, windmill);
  ledge.position.y = 7.95;
  const rotor = new THREE.Group();
  rotor.position.set(0, 7, -1.2);
  windmill.add(rotor);
  const blades = textured("fabric", "#fff7dc");
  for (let i = 0; i < 4; i++) {
    const blade = mesh(bevelBox(0.8, 4.5, 0.12, 0.05), blades, rotor);
    const a = (i * Math.PI) / 2;
    blade.position.set(Math.sin(a) * 2.25, Math.cos(a) * 2.25, 0);
    blade.rotation.z = -a;
    for (let j = 0; j < 5; j++) {
      const rung = mesh(bevelBox(0.86, 0.05, 0.15, 0.015), trim, rotor);
      const d = 0.65 + j * 0.73;
      rung.position.set(Math.sin(a) * d, Math.cos(a) * d, -0.08);
      rung.rotation.z = -a;
    }
  }
  mesh(new THREE.SphereGeometry(0.35, 12, 8), standard("#bd674b"), rotor);
  scene.add(windmill);

  // Batch small scenery, with a road-clearance check at generation time.
  const dummy = new THREE.Object3D();
  const treeCount = 80,
    wood = textured("bark"),
    leaves = textured("leaves");
  const treeTrunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.3, 3, 12),
    wood,
    treeCount,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 20, 14),
    leaves,
    treeCount,
  );
  const crownLobes = new THREE.InstancedMesh(crowns.geometry, leaves, treeCount * 3);
  for (let i = 0; i < treeCount; i++) {
    const f = frameAt(i / treeCount),
      offset = (i % 2 ? 1 : -1) * (15 + Math.random() * 12),
      p = f.p.clone().addScaledVector(f.right, offset),
      surface = projectTrack(p, 0, true);
    const scale = surface.distance > 13 ? 1 + Math.random() * 0.65 : 0;
    const base =
      -1.68 +
      (surface.height - 0.065 + 1.55) *
        (1 - THREE.MathUtils.smoothstep(surface.distance, 10, 25));
    dummy.rotation.set(0, i, 0);
    dummy.position.set(p.x, base + 1.5 * scale, p.z);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    treeTrunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = base + 3.2 * scale;
    dummy.scale.set(2.6 * scale, 2.3 * scale, 2.4 * scale);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < 3; j++) {
      const a = j * Math.PI * 2 / 3 + i;
      dummy.position.set(p.x + Math.cos(a) * 1.25 * scale, base + (3.6 + j * 0.16) * scale, p.z + Math.sin(a) * 1.25 * scale);
      dummy.scale.set(1.7 * scale, 1.55 * scale, 1.7 * scale);
      dummy.updateMatrix(); crownLobes.setMatrixAt(i * 3 + j, dummy.matrix);
      crownLobes.setColorAt(i * 3 + j, new THREE.Color().setHSL(0.25 + j * 0.015, 0.18, 0.84));
    }
    crowns.setColorAt(
      i,
      new THREE.Color().setHSL(0.25 + Math.random() * 0.07, 0.22, 0.82),
    );
  }
  treeTrunks.castShadow = true;
  crowns.castShadow = true;
  crownLobes.castShadow = true;
  scene.add(treeTrunks, crowns, crownLobes);
  dummy.rotation.set(0, 0, 0);
  const blossomMaterials = ["#ffcb49", "#ff8eaf", "#fff0dc"].map((c) =>
    standard(c),
  );
  const flower = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6), blossomMaterials[0]);
    petal.position.set(Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13);
    petal.scale.set(1, 0.5, 1); flower.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6), blossomMaterials[0]);
  center.position.y = 0.035; flower.add(center);
  batchStaticMeshes(flower);
  const flowerGeometry = flower.children[0].geometry;
  const blossoms = blossomMaterials.map(
    (m) =>
      new THREE.InstancedMesh(flowerGeometry, m, 180),
  );
  for (let i = 0; i < 180; i++) {
    const f = frameAt(i / 180),
      side = i % 2 ? 1 : -1,
      offset = 11 + Math.random() * 7,
      p = f.p.clone().addScaledVector(f.right, offset * side);
    const surface = projectTrack(p, 0, true);
    if (Math.abs(surface.offset) < 10) {
      dummy.scale.setScalar(0);
    } else {
      dummy.scale.setScalar(0.8 + Math.random() * 0.6);
    }
    p.y =
      -1.68 + (p.y + 1.55) * (1 - THREE.MathUtils.smoothstep(offset, 10, 25));
    for (let j = 0; j < 3; j++) {
      dummy.position.set(p.x + j * 0.22, p.y + 0.15, p.z + j * 0.35);
      dummy.updateMatrix();
      blossoms[j].setMatrixAt(i, dummy.matrix);
    }
  }
  for (const b of blossoms) {
    b.instanceMatrix.needsUpdate = true;
    scene.add(b);
  }

  const labels = [
    ["TURBO TRAIL", "#f97a52"],
    ["KEEP IT SUNNY", "#438ed9"],
    ["FULL THROTTLE", "#8866d9"],
    ["DRIFT CLUB", "#29b79d"],
  ];
  for (let i = 0; i < 8; i++) {
    const f = frameAt(0.045 + i * 0.12),
      g = new THREE.Group(),
      offset = (i % 2 ? 1 : -1) * 12;
    g.position.copy(f.p).addScaledVector(f.right, offset);
    g.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(f.right, f.up, f.tangent.clone().negate()),
    );
    const [text, color] = labels[i % 4],
      c = document.createElement("canvas");
    c.width = 512;
    c.height = 160;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 160);
    const sheen = ctx.createLinearGradient(0, 0, 0, 160);
    sheen.addColorStop(0, 'rgba(255,255,255,.28)');
    sheen.addColorStop(1, 'rgba(0,20,50,.18)');
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, 512, 160);
    for (let x = 0; x < 512; x += 20) {
      ctx.fillStyle = x % 40 ? '#ffffff' : '#203b55';
      ctx.fillRect(x, 133, 20, 13);
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 45px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 82);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const board = mesh(bevelBox(6, 1.85, 0.25, 0.08), standard("#fff7e5"), g);
    board.position.y = 2.1;
    for (const z of [-0.14, 0.14]) {
      const face = mesh(
        new THREE.PlaneGeometry(5.9, 1.78),
        new THREE.MeshBasicMaterial({ map: tex }),
        g,
      );
      face.position.set(0, 2.1, z);
      if (z > 0) face.rotation.y = Math.PI;
      face.castShadow = false;
    }
    for (const x of [-2.2, 2.2]) {
      const post = mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6),
        standard("#f6ebd3"),
        g,
      );
      post.position.set(x, 1, 0);
    }
    scene.add(g);
  }
  // Grandstands and a colorful canopy along the home straight.
  for (const side of [-1, 1]) {
    const f = frameAt(0.025),
      g = new THREE.Group();
    g.position.copy(f.p).addScaledVector(f.right, side * 17);
    g.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(f.right, f.up, f.tangent.clone().negate()),
    );
    const seats = standard(side > 0 ? "#ff8361" : "#6abfea");
    for (let row = 0; row < 4; row++) {
      const bench = mesh(bevelBox(1.0, 0.38, 14, 0.1), seats, g);
      bench.position.set(side * row * 1.05, 0.6 + row * 0.6, 0);
    }
    const canopy = mesh(bevelBox(6, 0.25, 16, 0.1), textured("fabric", "#fff3d4"), g);
    canopy.position.set(side * 1.5, 4.9, 0);
    for (const z of [-7, 7]) {
      const post = mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 5, 8),
        standard("#789aaf"),
        g,
      );
      post.position.set(side * 3, 2.4, z);
    }
    scene.add(g);
  }
  // Balloons and flags give the circuit a playful, authored silhouette.
  const balloons = [];
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7,
      g = new THREE.Group();
    g.position.set(Math.cos(a) * 150, 20 + (i % 3) * 5, Math.sin(a) * 150);
    const balloon = mesh(
      new THREE.SphereGeometry(2, 20, 16),
      standard(["#ff8c6a", "#ffe281", "#83ccec"][i % 3]),
      g,
    );
    balloon.scale.y = 1.25;
    const basket = mesh(bevelBox(0.9, 0.65, 0.9, 0.12), textured("bark", "#eac593"), g);
    basket.position.y = -3.5;
    for (const x of [-0.35, 0.35]) {
      const rope = mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 1.2, 4),
        standard("#eee8cd"),
        g,
      );
      rope.position.set(x, -2.65, 0);
    }
    scene.add(g);
    balloons.push(g);
  }
  return { rotor, balloons };
}

// Merge static pieces that share a material. Wheels, flames and other animated
// groups stay separate. This keeps detail without paying a draw call per part.
export function batchStaticMeshes(parent, excluded = []) {
  const batches = new Map(),
    removed = new Set();
  for (const child of [...parent.children]) {
    if (
      !child.isMesh ||
      excluded.includes(child) ||
      Array.isArray(child.material)
    )
      continue;
    child.updateMatrix();
    if (!batches.has(child.material)) batches.set(child.material, []);
    batches.get(child.material).push(child);
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const positions = [],
      normals = [],
      uv = [],
      indices = [];
    let offset = 0;
    for (const m of meshes) {
      const g = m.geometry.clone().applyMatrix4(m.matrix);
      positions.push(...g.attributes.position.array);
      normals.push(...g.attributes.normal.array);
      uv.push(...g.attributes.uv.array);
      if (g.index)
        for (const index of g.index.array) indices.push(index + offset);
      else
        for (let i = 0; i < g.attributes.position.count; i++)
          indices.push(i + offset);
      offset += g.attributes.position.count;
      removed.add(m.geometry);
      g.dispose();
      parent.remove(m);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    const merged = new THREE.Mesh(g, material);
    merged.castShadow = meshes.some((m) => m.castShadow);
    merged.receiveShadow = meshes.some((m) => m.receiveShadow);
    parent.add(merged);
  }
  for (const g of removed) g.dispose();
}
