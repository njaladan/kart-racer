import { bevelBox } from "../../rendering/visuals.js";
import { carvedSandstone } from "./sunstone-materials.js";

/** Chipped masonry, leaning fragments and collapsed openings form irregular ruin clusters. */
export function buildWeatheredLandmarks({ THREE, scenery, kit, textures, field }) {
  const { mesh, material } = kit;
  const stones = ["#b5a58f", "#cabaa0", "#9b9488"].map((color) => {
    const m = material(color, { bumpMap: textures.stone, bumpScale: 0.07, roughness: 1 });
    carvedSandstone(m);
    return m;
  });
  const blocks = [0.4, 2.7, 5.3].map((phase) => {
    const g = bevelBox(1, 1, 1, 0.09);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const chip = Math.sin(x * 17 + y * 13 + z * 19 + phase) * 0.035;
      p.setXYZ(i, x + chip, y + chip * 0.6, z - chip * 0.8);
    }
    g.computeVertexNormals();
    return g;
  });
  const pillar = new THREE.CylinderGeometry(0.8, 1, 1, 7, 4);
  const sites = [
    [-455, 10, "arch", 1.05],
    [-400, -210, "village", 0.8],
    [-535, -225, "arch", 1.2],
    [-185, -540, "temple", 1.15],
    [465, -300, "village", 1.0],
    [555, 180, "arch", 0.9],
    [145, 570, "temple", 1.35],
    [-575, 350, "village", 0.9],
    [-780, -530, "temple", 0.9],
    [870, -340, "arch", 1.3],
    [555, 895, "village", 1.1],
    [-245, 970, "arch", 0.9],
    [-990, 440, "temple", 1.1],
  ];
  let seed = 82941;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (const [x, z, kind, scale] of sites) {
    const root = new THREE.Group();
    root.name = `Weathered desert ${kind} cluster`;
    root.position.set(x, field.heightAt(x, z) - 2.2, z);
    root.rotation.y = rand() * Math.PI * 2;
    root.scale.setScalar(scale);
    root.userData.scenicAssembly = true;
    root.userData.desertLandmark = true;
    scenery.add(root);
    function block(position, dimensions, lean = 0.025) {
      const b = mesh(
        blocks[Math.floor(rand() * blocks.length)],
        stones[Math.floor(rand() * stones.length)],
        root,
        position,
        dimensions,
      );
      b.rotation.set((rand() - 0.5) * lean, (rand() - 0.5) * lean, (rand() - 0.5) * lean);
      b.castShadow = false;
      return b;
    }
    if (kind === "arch") {
      // One incomplete stone arch and a lower, collapsed companion.
      for (const side of [-1, 1])
        for (let row = 0; row < (side < 0 ? 4 : 3); row++)
          block([side * 12 + row * side * 0.18, row * 3 + 1, 0], [4.8, 3.1, 5.5]);
      for (let i = 0; i < 9; i++) {
        if (i === 2 || i === 7) continue;
        const a = (i / 8) * Math.PI;
        const b = block([Math.cos(a) * 12, 10 + Math.sin(a) * 12, 0], [4.9, 3.9, 5.2], 0.08);
        b.rotation.z = a - Math.PI / 2;
      }
      block([30, 6, 7], [4, 14, 4], 0.3);
      block([22, 2, 13], [14, 4, 5], 0.5);
    } else if (kind === "temple") {
      // Broken terraces composed from individual courses of masonry.
      for (let tier = 0; tier < 5; tier++) {
        const span = 40 - tier * 6;
        for (let piece = 0; piece < 5; piece++) {
          if (tier > 1 && rand() < 0.28) continue;
          block(
            [-span / 2 + ((piece + 0.5) * span) / 5, tier * 3.4, -tier * 1.4],
            [span / 5 - 0.3, 3.8, 28 - tier * 4],
          );
        }
      }
      for (const side of [-1, 1]) {
        const column = mesh(
          pillar,
          stones[1],
          root,
          [side * 9, 19 + side * 2, -5],
          [2.5, 10 + side * 4, 2.5],
        );
        column.rotation.z = side * 0.09;
        column.castShadow = false;
      }
    } else {
      for (let house = 0; house < 4; house++) {
        const bx = (house - 1.5) * 15,
          bz = (house % 2) * 15;
        for (let row = 0; row < 3; row++) {
          block([bx, row * 3, bz], [11 - row * 1.3, 3.3, 2.6], 0.09);
          if (row < 2 || house % 2)
            block([bx - 5, row * 3, bz + 4], [2.6, 3.3, 10 - row * 2], 0.08);
        }
      }
      const tower = mesh(pillar, stones[2], root, [-18, 11, -12], [3.1, 22, 3.1]);
      tower.rotation.z = -0.13;
      tower.castShadow = false;
    }
    // Fallen columns and fragments blend each ruin into accumulated sand.
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2,
        radius = 18 + rand() * 28;
      const px = Math.cos(a) * radius,
        pz = Math.sin(a) * radius;
      // Root rotation is applied explicitly so rubble follows the same terrain field.
      const wx = x + scale * (px * Math.cos(root.rotation.y) + pz * Math.sin(root.rotation.y));
      const wz = z + scale * (-px * Math.sin(root.rotation.y) + pz * Math.cos(root.rotation.y));
      const y = (field.heightAt(wx, wz) - root.position.y) / scale;
      const rubble = block(
        [px, y - 0.5, pz],
        [2 + rand() * 6, 1 + rand() * 2, 2 + rand() * 3],
        0.7,
      );
      rubble.rotation.y = rand() * Math.PI;
    }
  }
}
