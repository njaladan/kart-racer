import * as THREE from "../../vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "./course-kit.js";
import { createScenerySite } from "./scenery-sites.js";
import { registerLightPool } from "./course-lighting.js";

// Focal, downloaded artwork belongs to a place: expedition desks, breakfast
// displays, station supplies and lit festival stands rather than repeated rows.
export const HERO_SITES = {
  "windmill-wilds": [
    ["lantern", 0, 0.55, -1, 2.8],
    ["lantern", 4, 0.48, 1, 3.2],
  ],
  "neon-harbor": [
    ["boombox", 0, 0.48, -1, 3.8],
    ["boombox", 5, 0.76, 1, 3.2],
  ],
  "sunstone-ruins": [
    ["camera", 0, 0.7, -1, 4.8],
    ["lantern", 3, 0.38, -1, 3.6],
    ["lantern", 4, 0.62, 1, 3.6],
  ],
  "frostpeak-festival": [
    ["camera", 0, 0.63, -1, 4.2],
    ["lantern", 3, 0.58, 1, 3.2],
  ],
  "clockwork-citadel": [
    ["chair", 0, 0.55, -1, 5.2],
    ["lantern", 2, 0.7, 1, 4.2],
  ],
  "paper-revel": [
    ["lantern", 0, 0.6, -1, 4.2],
    ["lantern", 3, 0.6, 1, 4.2],
  ],
  "tempest-causeway": [
    ["lantern", 0, 0.5, -1, 4.2],
    ["lantern", 4, 0.6, 1, 4.2],
  ],
  "pocket-pantry": [
    ["avocado", 0, 0.58, -1, 18],
    ["fridge", 0, 0.82, 1, 35],
    ["bottle", 4, 0.56, -1, 19],
  ],
  "railstorm-express": [
    ["bottle", 0, 0.7, -1, 5.2],
    ["lantern", 4, 0.7, 1, 3.8],
  ],
  "metronome-hall": [
    ["boombox", 0, 0.58, -1, 13],
    ["chair", 3, 0.5, -1, 13],
    ["lantern", 5, 0.55, 1, 5],
  ],
  "pelagic-glasshouse": [
    ["lantern", 0, 0.7, -1, 4],
    ["lantern", 5, 0.55, 1, 4],
  ],
  "emberwing-observatory": [
    ["camera", 0, 0.58, -1, 7],
    ["camera", 5, 0.62, 1, 6],
    ["lantern", 4, 0.6, -1, 4],
  ],
};

export function addHeroScenery(scene, track, assets, textures = {}) {
  const sites = HERO_SITES[track.course.id] || [];
  if (!sites.some(([key]) => assets.models?.[`hero:${key}`])) return;
  const root = new THREE.Group();
  root.name = "Downloaded PBR focal props";
  const placements = [];
  scene.userData.downloadedHeroPlacements = placements;
  scene.add(root);
  const kit = createCourseKit(root, track, assets);
  const safe = createScenerySite(kit, track, root);
  const timber = kit.material("#b69873", { map: textures.wood });
  timber.userData.surfaceKind = "wood";
  const support = kit.material("#7f8586", { map: textures.stone });
  support.userData.surfaceKind = "stone";
  for (const [key, section, fraction, side, height] of sites) {
    if (!kit.hasAsset(`hero:${key}`)) continue;
    // Determine the actual downloaded footprint rather than trusting the height.
    const source = assets.models[`hero:${key}`];
    const size = new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
    const width = Math.max(size.x, size.z) * height;
    const radius = Math.max(3.2, width * 0.72);
    const t = track.sectorT(section, fraction);
    const offset = track.platformEdgeAt(t, side) + side * (radius + 3.5);
    const g = safe(section, fraction, offset, radius, height + 5);
    if (!g) continue;
    g.name = `${key} focal setting`;
    g.userData.heroSite = key;
    placements.push({ key, t, position: g.position.toArray() });
    const ground = track.course.theme.groundHeight ?? -1.7;
    const depth = Math.max(0.3, g.position.y - ground);
    // Structural bases meet the local driving-height display and surrounding floor.
    kit.box(support, g, [0, -depth / 2, 0], [width + 1.5, depth, width + 1.5]);
    const raised = ["camera", "chair", "fridge"].includes(key) ? 0.12 : 1.2;
    if (raised > 0.2) {
      kit.box(timber, g, [0, raised - 0.12, 0], [width + 1.6, 0.24, width + 1.3]);
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          kit.box(
            support,
            g,
            [x * width * 0.38, raised / 2, z * width * 0.38],
            [0.28, raised, 0.28],
          );
    }
    const object = kit.asset(`hero:${key}`, g, [0, raised, 0], [height, height, height]);
    // A model's authored front (+Z) faces inward across the track, rather
    // than showing only its narrow side to the approaching driver.
    if (key !== "lantern") object.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (["lantern", "boombox", "fridge"].includes(key)) {
      g.updateWorldMatrix(true, false);
      registerLightPool(scene, {
        position: g.localToWorld(
          new THREE.Vector3(
            key === "lantern" ? 0 : -side * (size.z * height * 0.5 + 0.3),
            raised + height * 0.55,
            key === "lantern" ? size.z * height * 0.5 + 0.3 : 0,
          ),
        ),
        color: key === "fridge" ? "#cfeaff" : key === "boombox" ? "#78d8ed" : "#ffd6a0",
        intensity: key === "fridge" ? 20 : 12,
        radius: Math.max(12, height * 1.6),
        area: key === "fridge" ? [height * 0.35, height * 0.55, 0.4] : [0.4, 0.4, 0.4],
      });
    }
  }
  batchScenery(root);
}
