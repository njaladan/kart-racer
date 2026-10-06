import { sunShaft } from "./sunstone-materials.js";
import { addGlow, createContactShadowMesh } from "../../rendering/visual-effects.js";
import { registerLightPool } from "../../rendering/course-lighting.js";

/** Bounded wall dressing and skylight cards; nothing enters the driving footprint. */
export function buildTempleAtmosphere({ THREE, scene, track, kit, palette, animated, motions }) {
  const { box, mesh, groupAt, sectorT, material } = kit;
  const { stone, pale, dark, gold, glow } = palette;
  const leaf = material("#526339", { roughness: 0.97, side: THREE.DoubleSide });
  const rock = new THREE.IcosahedronGeometry(1, 0);
  const leafGeometry = new THREE.SphereGeometry(1, 4, 2);
  for (const sector of [3, 4, 5]) {
    for (let i = 0; i < 9; i++) {
      const t = sectorT(sector, (i + 0.5) / 9);
      const g = groupAt(t);
      for (const side of [-1, 1]) {
        const surface = track.surfaceAt(t);
        const edge = side < 0 ? -surface.leftEdge : surface.rightEdge;
        const x = side * (edge + 1.7);
        for (let j = 0; j < 5; j++) {
          const boulder = mesh(
            j % 3 ? rock : leafGeometry,
            j % 2 ? stone : pale,
            g,
            [x + side * (j % 3) * 0.7, 0.18 + (j % 2) * 0.1, (j - 2) * 0.9],
            [0.28 + (j % 3) * 0.22, 0.2 + (j % 3) * 0.12, 0.35 + (j % 2) * 0.24],
          );
          boulder.rotation.set(j * 0.7, i * 1.3, j * 0.3);
        }
        const shadow = createContactShadowMesh({ width: 3.5, depth: 5, opacity: 0.24 });
        shadow.position.set(x + side * 0.6, 0.04, 0);
        g.add(shadow);
        if (i % 2 === 0) {
          for (let j = 0; j < 17; j++) {
            const y = 17 - j * 0.65;
            const vineX = x + side * (1.5 + Math.sin(j * 0.7 + i) * 0.25);
            box(leaf, g, [vineX, y, 0], [0.075, 0.8, 0.075]);
            for (const branch of [-1, 1]) {
              const blade = mesh(
                leafGeometry,
                leaf,
                g,
                [vineX, y - 0.15, branch * 0.25],
                [0.16, 0.36, 0.09],
              );
              blade.rotation.x = branch * 0.7;
            }
          }
        }
        if (sector === 4 && i % 2 === 1) {
          box(dark, g, [x, 1.2, 0], [1.1, 2.4, 1.1]);
          mesh(new THREE.CylinderGeometry(0.6, 0.35, 0.6, 8), gold, g, [x, 2.6, 0]);
          const flame = mesh(new THREE.ConeGeometry(0.27, 1.2, 6), glow, g, [x, 3.4, 0]);
          const halo = addGlow(g, {
            color: "#ffc075",
            size: 3.5,
            opacity: 0.27,
            position: [x, 3.2, 0],
          });
          g.updateMatrixWorld(true);
          registerLightPool(scene, {
            position: flame.getWorldPosition(new THREE.Vector3()),
            color: "#ffb965",
            intensity: 9,
            radius: 14,
          });
          animated.push(flame, halo);
          motions.push((time) => {
            const flicker = Math.sin(time * 7 + i) * 0.09 + Math.sin(time * 11 + side) * 0.04;
            flame.scale.y = 1 + flicker;
            halo.material.opacity = 0.27 + flicker * 0.2;
          });
        }
      }
    }
  }
  // Only open roof slots get shafts, so the effect has a visible physical source.
  for (const fraction of [1.5 / 22, 7.5 / 22, 13.5 / 22, 19.5 / 22]) {
    const g = groupAt(sectorT(4, fraction));
    const shaft = sunShaft(THREE, { width: 6, height: 23, length: 7 });
    shaft.position.y = 12;
    g.add(shaft);
    animated.push(shaft);
  }
}
