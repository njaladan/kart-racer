import * as THREE from "./vendor/three/three.module.js";
import { createKartDecalAtlas, bakeVertexShade } from "./graphics.js";
import { bevelBox, batchStaticMeshes } from "./visuals.js";

/** Create numbered kart meshes using the scene's shared material and mesh factories. */
export function createKartBuilder({
  scene,
  mats,
  textures,
  shadowTexture,
  paintColors,
  theme = {},
}) {
  const TAU = Math.PI * 2;
  const decals = createKartDecalAtlas(paintColors);
  const reflective = {
    envMap: textures.environment,
    envMapIntensity: theme.terrain === "concrete" ? 0.24 : 0.55,
  };
  let kartIndex = 0;

  const mat = (color, roughness = 0.74, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      vertexColors: true,
      ...(extra.map?.userData?.pbr || {}),
      ...extra,
    });
  const surface = (map, bumpScale = 0.025) =>
    map?.userData?.pbr
      ? { map, ...map.userData.pbr }
      : { map, bumpMap: map, bumpScale };
  function addMesh(geometry, material, parent = scene, position = null) {
    if (material.vertexColors) bakeVertexShade(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function buildKart(color, name, isPlayer = false) {
    const root = new THREE.Group();
    root.name = name;
    const paint = mat(color, 0.34, {
        metalness: 0.2,
        map: textures.paint,
        ...reflective,
      }),
      highlight = mat(
        new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.42),
        0.32,
        { metalness: 0.25, ...reflective },
      ),
      dark = mat("#18242e", 0.68, surface(textures.fabric, 0.012)),
      rubber = mat("#ffffff", 0.92, surface(textures.tire, 0.035)),
      skin = mat("#e4ad7c", 0.8),
      helmet = mat(color, 0.25, {
        metalness: 0.25,
        map: textures.paint,
        ...reflective,
      });
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
      mat("#10252f", 0.2, { metalness: 0.55, ...reflective }),
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
    const chrome = mat("#b8c9d2", 0.3, { metalness: 0.65, ...reflective });
    // Sculpted side pods, vents, suspension and a visible rear engine.
    for (const side of [-1, 1]) {
      const pod = addMesh(bevelBox(0.34, 0.34, 1.1, 0.14), paint, root);
      pod.position.set(side * 0.82, 0.77, 0.05);
      for (let i = 0; i < 4; i++) {
        const vent = addMesh(bevelBox(0.025, 0.09, 0.12, 0.01), dark, root);
        vent.position.set(side * 1.0, 0.8, 0.1 + i * 0.16);
        vent.rotation.x = -0.25;
      }
      limb(
        [side * 0.45, 0.51, -0.65],
        [side * 0.87, 0.44, -0.65],
        0.055,
        chrome,
      );
      const endPlate = addMesh(bevelBox(0.08, 0.28, 0.48, 0.035), paint, root);
      endPlate.position.set(side * 0.73, 1.4, 0.9);
      const stripe = addMesh(
        bevelBox(0.14, 0.015, 0.64, 0.004),
        mats.white,
        root,
      );
      stripe.position.set(side * 0.25, 0.944, -1.12);
    }
    const engine = addMesh(bevelBox(0.64, 0.38, 0.48, 0.07), chrome, root);
    engine.position.set(0, 0.92, 0.99);
    for (let i = 0; i < 5; i++) {
      const fin = addMesh(bevelBox(0.73, 0.035, 0.45, 0.008), dark, root);
      fin.position.set(0, 0.78 + i * 0.065, 1.01);
    }
    const number = addMesh(
      decals.geometry(kartIndex, 0.47),
      decals.material,
      root,
    );
    number.rotation.x = -Math.PI / 2;
    number.position.set(0, 0.977, -0.79);
    number.castShadow = false;
    for (const side of [-1, 1]) {
      const patch = addMesh(
        decals.geometry(kartIndex, 0.31),
        decals.material,
        root,
      );
      patch.rotation.y = (side * Math.PI) / 2;
      patch.position.set(side * 1.003, 0.78, -0.24);
      patch.castShadow = false;
    }
    const wheelGeo = new THREE.LatheGeometry(
        [
          [0.24, -0.18],
          [0.35, -0.18],
          [0.41, -0.13],
          [0.43, -0.07],
          [0.43, 0.07],
          [0.41, 0.13],
          [0.35, 0.18],
          [0.24, 0.18],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        32,
      ),
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
          const rim = addMesh(
            new THREE.TorusGeometry(0.255, 0.025, 6, 24),
            chrome,
            spin,
          );
          rim.rotation.y = Math.PI / 2;
          rim.position.x = side * 0.185;
          for (let i = 0; i < 5; i++) {
            const a = (i * TAU) / 5;
            const spoke = addMesh(
              bevelBox(0.028, 0.19, 0.045, 0.008),
              chrome,
              spin,
            );
            spoke.rotation.x = a;
            spoke.position.set(
              side * 0.19,
              Math.cos(a) * 0.14,
              Math.sin(a) * 0.14,
            );
          }
        }
        batchStaticMeshes(spin);
        root.add(pivot);
        wheels.push({ pivot, spin, front: z < 0 });
      }
    const exhaustMat = new THREE.MeshBasicMaterial({
      color: "#fff0a1",
      vertexColors: true,
      toneMapped: false,
    });
    // Two flame lobes share one geometry and draw call, with a hot pale core.
    const flameGeometry = new THREE.ConeGeometry(0.16, 0.85, 7).toNonIndexed();
    const flamePositions = [],
      flameColors = [];
    const source = flameGeometry.getAttribute("position");
    for (const side of [-1, 1])
      for (let i = 0; i < source.count; i++) {
        const x = source.getX(i),
          y = source.getY(i),
          z = source.getZ(i);
        flamePositions.push(side * 0.68 + x, -z, y);
        const hot = THREE.MathUtils.clamp(0.5 - y / 0.85, 0, 1);
        flameColors.push(1, 0.28 + hot * 0.65, 0.04 + hot * 0.35);
      }
    flameGeometry.dispose();
    const flameGeo = new THREE.BufferGeometry();
    flameGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(flamePositions, 3),
    );
    flameGeo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(flameColors, 3),
    );
    const flame = new THREE.Mesh(flameGeo, exhaustMat);
    root.add(flame);
    flame.position.set(0, 0.65, 1.65);
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
    kartIndex += 1;
    return kart;
  }

  return buildKart;
}
