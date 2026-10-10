import { createDuneGeometry, duneHeightAt } from "./create-desert-geometry.js";
import { createDesertAtmosphere, createMiragePool } from "./desert-atmosphere.js";

/** Overlapping dunes and varied archaeological silhouettes surround every course view. */
export function buildDesertHorizon({ THREE, scenery, track, kit, textures, motions }) {
  const { mesh, box, material } = kit;
  const theme = track.course.theme;
  const atmosphere = createDesertAtmosphere(THREE, theme);
  motions.push(atmosphere.update);
  const sands = ["#e6bd79", "#d9af73", "#ebcc95"].map((color) =>
    atmosphere.apply(material(color, { bumpMap: textures.sand, bumpScale: 0.025 })),
  );
  const stones = ["#b59875", "#bca487", "#d4bd9c"].map((color) =>
    atmosphere.apply(material(color, { roughness: 1 })),
  );
  const dune = createDuneGeometry(THREE, 24);
  const farDune = createDuneGeometry(THREE, 18);
  const pyramid = new THREE.ConeGeometry(1, 1, 4);
  pyramid.rotateY(Math.PI / 4);
  const obelisk = new THREE.CylinderGeometry(0.65, 1, 1, 4);
  const tip = new THREE.ConeGeometry(1, 1, 4);
  tip.rotateY(Math.PI / 4);
  const poolMaterial = createMiragePool(THREE, atmosphere.clock);
  const poolGeometry = new THREE.PlaneGeometry(2, 2);
  poolGeometry.rotateX(-Math.PI / 2);

  // Continue the sand floor beyond the original ground square. Its edge lies
  // well beyond the fog distance even from the highest mesa camera.
  const floorGeometry = new THREE.RingGeometry(780, 2200, 96);
  floorGeometry.rotateX(-Math.PI / 2);
  const floor = mesh(floorGeometry, sands[2], scenery, [0, theme.groundHeight - 0.1, 0]);
  floor.name = "Desert floor beyond the horizon";
  floor.castShadow = floor.receiveShadow = false;
  floor.userData.bakeReceiver = true;

  const layers = [
    { radius: 650, count: 26, width: 160, depth: 165, height: 46 },
    { radius: 930, count: 30, width: 210, depth: 210, height: 68 },
    { radius: 1320, count: 34, width: 245, depth: 270, height: 87 },
  ];
  layers.forEach((layer, depth) => {
    for (let i = 0; i < layer.count; i++) {
      const angle = (i / layer.count) * Math.PI * 2 + depth * 0.37;
      const radius = layer.radius + Math.sin(i * 2.39 + depth) * 27;
      const height = layer.height * (0.75 + (Math.sin(i * 1.83 + depth) + 1) * 0.25);
      const root = new THREE.Group();
      root.name = `Desert horizon layer ${depth + 1} dune ${i + 1}`;
      root.position.set(
        -60 + Math.cos(angle) * radius,
        theme.groundHeight,
        10 + Math.sin(angle) * radius,
      );
      root.rotation.y = -angle - Math.PI / 2;
      root.userData.scenicAssembly = true;
      scenery.add(root);
      const hill = mesh(
        depth === 2 ? farDune : dune,
        sands[depth],
        root,
        [0, -0.4, 0],
        [layer.width, height, layer.depth],
      );
      hill.name = "Wind sculpted horizon crescent";
      hill.castShadow = false;
      hill.userData.bakeReceiver = true;
      if (i % 3 === 1) continue; // Open stretches give each landmark room on the skyline.
      const ruin = new THREE.Group();
      ruin.position.set(0, duneHeightAt(0, 0.22) * height - 1.5, layer.depth * 0.22);
      ruin.rotation.y = i * 0.81;
      root.add(ruin);
      const stone = stones[depth];
      const scale = 0.85 + depth * 0.32 + (i % 3) * 0.16;
      ruin.scale.setScalar(scale);
      switch ((i + depth * 2) % 5) {
        case 0:
          ruin.name = "Half buried stepped sun temple";
          for (let step = 0; step < 6; step++)
            box(stone, ruin, [0, step * 5 + 1, 0], [58 - step * 8, 6, 48 - step * 6]);
          box(stone, ruin, [0, 34, 0], [12, 10, 12]);
          break;
        case 1:
          ruin.name = "Broken desert aqueduct";
          for (let arch = 0; arch < 4; arch++) {
            const x = -33 + arch * 22;
            box(stone, ruin, [x, 17 + arch * 2, 0], [5, 34 + arch * 4, 7]);
            if (arch < 2) box(stone, ruin, [x + 11, 36 + arch * 2, 0], [27, 5, 8]);
          }
          break;
        case 2:
          ruin.name = "Twin sun obelisks";
          for (const x of [-12, 12]) {
            box(stone, ruin, [x, 1, 0], [12, 4, 12]);
            mesh(obelisk, stone, ruin, [x, 25, 0], [5, 48, 5]);
            mesh(tip, stone, ruin, [x, 52, 0], [3.25, 6, 3.25]);
          }
          break;
        case 3:
          ruin.name = "Lost pyramid group";
          mesh(pyramid, stone, ruin, [0, 28, 0], [56, 58, 56]);
          mesh(pyramid, stone, ruin, [48, 12, 17], [28, 27, 28]);
          break;
        default:
          ruin.name = "Abandoned desert settlement";
          for (let building = 0; building < 7; building++) {
            const h = 7 + (building % 3) * 5;
            box(stone, ruin, [-30 + building * 10, h / 2 - 1, (building % 2) * 14], [8, h, 11]);
          }
          box(stone, ruin, [-22, 22, 4], [9, 44, 9]);
      }
      // The shallow glints lie in the basin behind the crest and disappear on approach.
      if (depth === 0 && i % 4 === 0) {
        const glint = mesh(
          poolGeometry,
          poolMaterial,
          root,
          [15, 0.12, -layer.depth * 1.15],
          [100, 1, 29],
        );
        glint.name = "Illusory distant water";
        glint.castShadow = glint.receiveShadow = false;
      }
      ruin.traverse((object) => {
        if (object.isMesh) object.castShadow = false;
      });
    }
  });
}
