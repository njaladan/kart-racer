import * as THREE from "../../vendor/three/three.module.js";
import { addGlow } from "./visual-effects.js";

/** Build locally bundled SuperTuxKart racers with independent materials and wheels. */
export function createKartBuilder({ scene, models, textures, shadowTexture, theme = {} }) {
  const TAU = Math.PI * 2;

  function buildKart(color, name, isPlayer = false, racerId = "tux") {
    const root = new THREE.Group();
    root.name = name;
    const modelName = `stk-kart-${racerId}`;
    const source = models[modelName];
    if (!source?.isObject3D) throw new Error(`Missing shared racer model: ${modelName}`);
    const importedModel = source.clone(true);
    const bodyGroup = new THREE.Group();
    bodyGroup.name = `${name} imported racer`;
    const litMaterials = [];
    const driverParts = [];
    importedModel.traverse((part) => {
      if (!part.isMesh) return;
      part.layers.enable(1);
      part.castShadow = true;
      part.receiveShadow = true;
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      const independent = materials.map((sourceMaterial) => {
        const material = sourceMaterial.clone();
        if (!material.envMap) {
          material.envMap = textures.environment;
          material.envMapIntensity = theme.terrain === "concrete" ? 0.18 : 0.28;
        }
        material.userData.baseKartColor = material.color.clone();
        litMaterials.push(material);
        return material;
      });
      part.material = Array.isArray(part.material) ? independent : independent[0];
    });
    // Converted STK assets face -Z, matching the race. Scale uniformly to
    // preserve proportions, a shared wheel footprint and tall characters.
    const driverPattern = {
      tux: /tux_body/i,
      kiki: /Kiki_body|kiki_hair|Cloth_Kiki|Eyes2/i,
      konqi: /^Konqi_dif|konqi-eye|konqi_scarf/i,
      nolok: /nolok_character|AAARH/i,
      pidgin: /^pidgin\.png/i,
      wilber: /character|driver/i,
    }[racerId];
    importedModel.traverse((part) => {
      if (part.isMesh && driverPattern?.test(part.name)) {
        driverParts.push({
          object: part,
          rotation: part.rotation.clone(),
          position: part.position.clone(),
        });
      }
    });
    bodyGroup.add(importedModel);
    root.add(bodyGroup);
    const wheels = [];
    const wheelBounds = new THREE.Box3();
    const wheelPivots = [];
    importedModel.traverse((part) => {
      if (part.name.startsWith("wheel-")) wheelPivots.push(part);
    });
    for (const part of wheelPivots) {
      wheelBounds.union(new THREE.Box3().setFromObject(part));
      // Steering and rolling require separate transforms. Rolling the axle
      // pivot itself would erase steering or move an off-center wheel.
      const spin = new THREE.Group();
      spin.name = `${part.name}-spin`;
      for (const child of [...part.children]) spin.add(child);
      part.add(spin);
      wheels.push({ pivot: part, spin, front: part.name.includes("front") });
    }
    if (wheels.length !== 4) throw new Error(`${modelName} should contain four animated wheels`);
    const size = new THREE.Box3().setFromObject(importedModel).getSize(new THREE.Vector3());
    const footprint = wheelBounds.getSize(new THREE.Vector3());
    const scale = Math.min(2.4 / footprint.x, 2.6 / size.y, 3.4 / size.z);
    bodyGroup.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    for (const wheel of wheels) {
      const bounds = new THREE.Box3().setFromObject(wheel.spin).getSize(new THREE.Vector3());
      wheel.radius = Math.max(0.1, bounds.y / 2);
    }

    const flameGeometry = new THREE.ConeGeometry(0.17, 0.78, 8).toNonIndexed();
    const flameMaterial = new THREE.MeshBasicMaterial({
      color: "#ffe87b",
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(0, 0.66, 1.32);
    root.add(flame);
    flame.visible = false;
    const boostGlow = addGlow(root, {
      color: "#ffc951",
      size: 2.15,
      opacity: 0.52,
      position: [0, 0.66, 1.48],
    });
    boostGlow.visible = false;

    const aura = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.34, 0.055, 8, 40),
      new THREE.MeshBasicMaterial({ color: "#e9f562" }),
    );
    ring.rotation.x = Math.PI / 2;
    aura.add(ring);
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22),
        new THREE.MeshBasicMaterial({
          color: ["#fc6adf", "#56f2ec", "#fff263", "#ff9851", "#9f83ff"][i],
        }),
      );
      star.userData.a = (i * TAU) / 5;
      star.userData.r = 1.55;
      aura.add(star);
    }
    aura.position.y = 1.32;
    root.add(aura);
    aura.visible = false;

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.65, 3.65),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.38,
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
      litMaterials,
      driverParts,
      suspension: { compression: 0, velocity: 0, previousGrounded: true },
      shadow,
      wheels,
      flame,
      boostGlow,
      aura,
      name,
      isPlayer,
      color,
      racerId,
    };
    return kart;
  }

  return buildKart;
}
