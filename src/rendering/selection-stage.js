import { PMREMGenerator } from "../../vendor/three/three.webgpu.js";
import { createWebGPURenderer } from "./webgpu-renderer.js";
import * as THREE from "../../vendor/three/three.module.js";
import { createKartBuilder } from "./kart-builder.js";
import { RACERS } from "./racer-roster.js";
import { contactShadow } from "./visuals.js";

/** A small showroom, rendered only while visible, using the actual racing models. */
export async function createSelectionStage({ canvas, models, environment, menu }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.set(4.7, 3.1, 5.6);
  camera.lookAt(0, 0.8, 0);
  const renderer = await createWebGPURenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  scene.add(new THREE.HemisphereLight("#ddf8ff", "#3b3659", 3));
  const key = new THREE.DirectionalLight("#fff3da", 4);
  key.position.set(3, 6, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#a6b6ff", 2);
  rim.position.set(-3, 3, -4);
  scene.add(rim);
  const environmentGenerator = new PMREMGenerator(renderer);
  const previewEnvironment = environmentGenerator.fromEquirectangular(
    environment.userData.sourceEnvironment,
  );
  scene.environment = previewEnvironment.texture;
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.65, 0.2, 64),
    new THREE.MeshStandardMaterial({ color: "#242d40", metalness: 0.35, roughness: 0.35 }),
  );
  plinth.position.y = -0.17;
  scene.add(plinth);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(2.48, 0.022, 4, 64),
    new THREE.MeshBasicMaterial({ color: "#cbff76" }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.055;
  scene.add(halo);
  const build = createKartBuilder({
    scene,
    models,
    textures: { environment: scene.environment },
    shadowTexture: contactShadow(),
  });
  const karts = new Map();
  let selected = null,
    time = 0;
  menu.setRacerPreview((id) => {
    if (selected) {
      selected.root.visible = false;
      selected.shadow.visible = false;
    }
    if (!karts.has(id)) {
      const r = RACERS.find((r) => r.id === id);
      const kart = build(r.color, r.name, false, id);
      kart.shadow.visible = false;
      kart.aura.visible = kart.flame.visible = false;
      karts.set(id, kart);
    }
    selected = karts.get(id);
    selected.root.visible = true;
    halo.material.color.set(RACERS.find((r) => r.id === id).color);
  });
  return {
    update(dt) {
      menu.updateGamepad(dt);
      if (canvas.getClientRects().length === 0) return;
      const width = canvas.clientWidth,
        height = canvas.clientHeight;
      if (!width || !height) return;
      const size = new THREE.Vector2();
      renderer.getSize(size);
      if (size.x !== width || size.y !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      if (
        menu.preferences.motion &&
        !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      )
        time += Math.min(dt, 0.05);
      if (selected) {
        selected.root.rotation.y = Math.sin(time * 0.34) * 0.25 - 0.35;
        selected.bodyGroup.position.y = Math.sin(time * 2) * 0.016;
        for (const d of selected.driverParts || [])
          d.object.rotation.z = d.rotation.z + Math.sin(time * 1.6) * 0.035;
        for (const w of selected.wheels)
          if (w.front) w.pivot.rotation.y = Math.sin(time * 0.8) * 0.12;
      }
      renderer.render(scene, camera);
    },
  };
}
