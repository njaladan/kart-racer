import * as THREE from "./vendor/three/three.module.js";
import { createKartDecalAtlas } from "./graphics.js";

/** Build locally bundled Kenney racers with independent materials and wheel state. */
export function createKartBuilder({
  scene,
  models,
  textures,
  shadowTexture,
  paintColors,
  theme = {},
}) {
  const TAU = Math.PI * 2;
  const decals = createKartDecalAtlas(paintColors);
  let kartIndex = 0;

  function buildKart(color, name, isPlayer = false) {
    const root = new THREE.Group();
    root.name = name;
    const kartNames = ['oobi', 'oodi', 'ooli', 'oopi', 'oozi'];
    const modelName = `kenney-kart-${kartNames[kartIndex % kartNames.length]}`;
    const source = models[modelName];
    if (!source?.isObject3D) throw new Error(`Missing shared racer model: ${modelName}`);
    const importedModel = source.clone(true);
    const bodyGroup = new THREE.Group();
    bodyGroup.name = `${name} imported racer`;
    // Preserve the painted Kenney atlas while making each competitor easy to
    // identify at race distance with restrained color on the shell material.
    const raceTint = new THREE.Color(color);
    importedModel.traverse((part) => {
      if (!part.isMesh) return;
      part.castShadow = true;
      part.receiveShadow = true;
      const chassis = part.name.startsWith('kart-');
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      const tinted = materials.map((sourceMaterial) => {
        const material = sourceMaterial.clone();
        material.roughness = Math.min(material.roughness ?? 0.72, chassis ? 0.42 : 0.82);
        if (chassis) material.color.copy(raceTint).lerp(new THREE.Color('#ffffff'), 0.42);
        if (!material.envMap) {
          material.envMap = textures.environment;
          material.envMapIntensity = theme.terrain === 'concrete' ? 0.18 : 0.28;
        }
        return material;
      });
      part.material = Array.isArray(part.material) ? tinted : tinted[0];
    });
    // Kenney's source faces +Z while the race uses -Z as forward. The loader
    // normalized these assets to one metre tall and centered them on the floor.
    bodyGroup.add(importedModel);
    bodyGroup.rotation.y = Math.PI;
    bodyGroup.scale.set(3.45, 2.05, 2.28);
    root.add(bodyGroup);

    const wheels = [];
    importedModel.traverse((part) => {
      if (!part.name.startsWith('wheel-')) return;
      wheels.push({ pivot: part, spin: part, front: part.name.includes('front') });
    });
    if (wheels.length !== 4) throw new Error(`${modelName} should contain four animated wheels`);

    const number = new THREE.Mesh(decals.geometry(kartIndex, 0.14), decals.material);
    number.rotation.x = -Math.PI / 2;
    number.position.set(0, 0.53, 0.27);
    number.castShadow = false;
    bodyGroup.add(number);
    for (const side of [-1, 1]) {
      const patch = new THREE.Mesh(decals.geometry(kartIndex, 0.14), decals.material);
      patch.rotation.set(0, side * Math.PI / 2, 0);
      patch.position.set(side * 0.33, 0.38, 0);
      patch.castShadow = false;
      bodyGroup.add(patch);
    }

    const flameGeometry = new THREE.ConeGeometry(0.17, 0.78, 8).toNonIndexed();
    const flameMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true,
      opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false });
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(0, 0.66, 1.32);
    root.add(flame);
    flame.visible = false;

    const aura = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.055, 8, 40),
      new THREE.MeshBasicMaterial({ color: '#e9f562' }));
    ring.rotation.x = Math.PI / 2;
    aura.add(ring);
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22),
        new THREE.MeshBasicMaterial({ color: ['#fc6adf', '#56f2ec', '#fff263', '#ff9851', '#9f83ff'][i] }));
      star.userData.a = (i * TAU) / 5;
      star.userData.r = 1.55;
      aura.add(star);
    }
    aura.position.y = 1.32;
    root.add(aura);
    aura.visible = false;

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.8),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.27,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    scene.add(shadow);
    scene.add(root);
    const kart = { root, bodyGroup, shadow, wheels, flame, aura, name, isPlayer, color };
    kartIndex += 1;
    return kart;
  }


  return buildKart;
}
