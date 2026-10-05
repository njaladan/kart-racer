import { addGlow, createContactShadowMesh } from "../../rendering/visual-effects.js";
import { registerLightPool } from "../../rendering/course-lighting.js";

/** Textured authored buildings and street furniture, fitted to safe footprints. */
export function buildCityProps({ THREE, scene, kit, scenery, track, palette }) {
  const { asset, batch, box, groupAt } = kit;
  const { cyan, pink, steel, window, dark } = palette;
  const bounds = new THREE.Box3(),
    size = new THREE.Vector3(),
    inverse = new THREE.Matrix4(),
    piece = new THREE.Box3(),
    transform = new THREE.Matrix4();

  function fitAsset(name, parent, position, dimensions) {
    if (!kit.hasAsset?.(name)) return null;
    const object = asset(name, parent, position);
    object.updateMatrixWorld(true);
    bounds.makeEmpty();
    inverse.copy(object.matrixWorld).invert();
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry.computeBoundingBox();
      transform.multiplyMatrices(inverse, child.matrixWorld);
      bounds.union(piece.copy(child.geometry.boundingBox).applyMatrix4(transform));
    });
    bounds.getSize(size);
    object.scale.set(...dimensions.map((d, i) => d / Math.max(0.001, size.getComponent(i))));
    return object;
  }
  function groundShadow(parent, width, depth, y = 0.035) {
    const shadow = createContactShadowMesh({ width, depth, opacity: 0.23 });
    shadow.position.y = y;
    parent.add(shadow);
  }
  function safeGroup(t, offset, radius) {
    const pose = track.poseAt(t * track.TRACK, offset, 0);
    const p = track.projectTrack(pose.p, t * track.TRACK, true);
    const edge = p.offset > 0 ? p.rightEdge : -p.leftEdge;
    if (p.distance < edge + radius + 2) return null;
    return kit.landGroup ? kit.landGroup(t, offset, scenery) : groupAt(t, offset, scenery);
  }
  function lightAt(group, local, color, intensity = 2, radius = 17) {
    group.updateMatrixWorld(true);
    const p = group.localToWorld(new THREE.Vector3(...local));
    registerLightPool(scene, { position: p, color, intensity, radius });
    // The offline course bake uses the same authored emitter locations.
    const emitter = new THREE.Group();
    emitter.position.set(...local);
    emitter.userData.bakeLight = { color, intensity, distance: radius };
    group.add(emitter);
  }
  function building(t, offset, width, height, depth, index) {
    const g = safeGroup(t, offset, Math.hypot(width + 2, depth + 2) / 2);
    if (!g) return null;
    const market = height < 24;
    const model = market
      ? index % 2
        ? "market-house"
        : "market-house-c"
      : index % 2
        ? "housing-a"
        : "housing-b";
    const imported = fitAsset(`harbor:${model}`, g, [0, 0, 0], [width, height, depth]);
    if (!imported) return null;
    if (Math.abs(offset) < 60) groundShadow(g, width * 1.3, depth * 1.3);
    // Reused trim detail complements the authored geometry and its baked AO.
    box(
      index % 2 ? cyan : pink,
      g,
      [0, market ? 4.8 : height * 0.33, depth / 2 + 0.07],
      [width * 0.72, 0.12, 0.1],
    );
    if (!market) {
      fitAsset("harbor:aircon", g, [width * 0.24, height - 0.15, -depth * 0.15], [2.1, 1.5, 1.8]);
      box(dark, g, [0, height + 0.05, 0], [width * 1.025, 0.15, depth * 1.025]);
    }
    if (Math.abs(offset) < 60) {
      lightAt(g, [0, 4, depth / 2 + 0.4], index % 2 ? "#5cdad4" : "#ee73b5", 2.4, 15);
      for (const side of [-1, 1])
        box(window, g, [side * width * 0.29, 1.7, depth / 2 + 0.09], [width * 0.18, 2.1, 0.07]);
    }
    batch(g);
    return imported;
  }
  function industrialBuilding(t, offset, width, height, depth, index) {
    const g = safeGroup(t, offset, Math.hypot(width, depth) / 2);
    if (!g) return null;
    const imported = fitAsset(
      `harbor:${index % 2 ? "housing-a" : "housing-b"}`,
      g,
      [0, 0, 0],
      [width, height, depth],
    );
    if (!imported) return null;
    fitAsset("harbor:aircon", g, [width * 0.2, height, -depth * 0.18], [2.5, 1.8, 2]);
    box(steel, g, [0, height + 0.08, 0], [width * 1.04, 0.16, depth * 1.04]);
    if (Math.abs(offset) < 55) {
      groundShadow(g, width * 1.25, depth * 1.25);
      lightAt(g, [0, 3.5, depth / 2 + 0.5], "#ffc77d", 2.2, 14);
    }
    batch(g);
    return imported;
  }
  function lamp(t, offset, index) {
    const g = safeGroup(t, offset, 1.8);
    if (!g) return;
    const lamp = fitAsset("harbor:lamp", g, [0, 0, 0], [1.8, 9, 1.1]);
    if (lamp) lamp.rotation.y = offset > 0 ? Math.PI : 0;
    const color = index % 3 ? "#ffdb99" : "#68cbe4";
    lightAt(g, [-Math.sign(offset) * 0.9, 8.5, 0], color, 3.2, 21);
    // An emitter is small; its baked pavement illumination supplies the volume.
    if (index % 2 === 0)
      addGlow(g, { color, size: 2.1, opacity: 0.19, position: [-Math.sign(offset) * 0.9, 8.5, 0] });
  }
  return { safeGroup, groundShadow, building, industrialBuilding, lamp, fitAsset, lightAt };
}
