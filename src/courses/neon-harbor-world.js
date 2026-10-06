import { buildHarborLife } from "./neon-harbor/build-harbor-life.js";
import { buildWaterfront } from "./neon-harbor/build-waterfront.js";
import { buildCityProps } from "./neon-harbor/build-city-props.js";
import { createLumenMaterials } from "./neon-harbor/lumen-materials.js";
import { buildLumenDistricts } from "./neon-harbor/build-lumen-districts.js";
import { buildLumenQuays } from "./neon-harbor/build-lumen-quays.js";
import { buildPortLighting } from "./neon-harbor/build-port-lighting.js";
import { buildLumenMotion } from "./neon-harbor/build-lumen-motion.js";
import { buildPortLandmarks } from "./neon-harbor/build-port-landmarks.js";
import { installSurfaceDetail } from "../rendering/surface-detail.js";

// Authored imported architecture supplies silhouettes, recesses and baked AO.
// The shared engine retains every physical road, verge and camera boundary.
export default function buildWorld(context) {
  const { THREE, scene, scenery, track, kit, hazardAt, trafficAt, textures = {} } = context;
  const { material } = kit;
  const steel = material("#647889", { map: textures.metal, metalness: 0.28, roughness: 0.58 });
  const concrete = material("#a0adb5", { map: textures.concrete, roughness: 0.85 });
  const amber = material("#d5a761", { map: textures.metal, metalness: 0.15, roughness: 0.65 });
  const trim = material("#adc2ce", { map: textures.concrete, roughness: 0.8 });
  const cyan = material("#78ded5", { emissive: "#26aebb", emissiveIntensity: 1.35 });
  const pink = material("#eb91c7", { emissive: "#bf4789", emissiveIntensity: 1.3 });
  const blue = material("#547896", { map: textures.metal, roughness: 0.57 });
  const rust = material("#a27665", { map: textures.metal, roughness: 0.8 });
  const dark = material("#354157", { roughness: 0.87 });
  const glass = material("#324f6d", { metalness: 0, roughness: 0.2, envMapIntensity: 1.25 });
  const window = material("#e6c393", { emissive: "#d39247", emissiveIntensity: 0.95 });
  installSurfaceDetail(concrete, { kind: "terrain", scale: 0.12, strength: 0.13 });
  installSurfaceDetail(steel, { kind: "terrain", scale: 0.08, strength: 0.075 });
  const palette = {
    amber,
    blue,
    concrete,
    cyan,
    dark,
    glass,
    pink,
    rust,
    steel,
    trim,
    window,
  };
  const geometry = {
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    sphere: new THREE.SphereGeometry(1, 12, 8),
  };
  const animated = [],
    ferries = [],
    craneHooks = [];
  const props = buildCityProps({ THREE, scene, kit, scenery, track, palette });
  const { safeGroup, lamp, fitAsset } = props;

  const { harborPose } = buildWaterfront({
    THREE,
    scene,
    animated,
    craneHooks,
    ferries,
    lamp,
    safeGroup,
    fitAsset,
    scenery,
    textures,
    track,
    kit,
    palette,
    geometry,
  });
  const lumenMaterials = createLumenMaterials({ THREE, kit, textures, palette });
  buildLumenDistricts({ THREE, scenery, track, kit, props, materials: lumenMaterials });
  buildLumenQuays({ THREE, scenery, track, kit, props, materials: lumenMaterials });
  const motion = buildLumenMotion({
    THREE,
    scenery,
    track,
    kit,
    props,
    materials: lumenMaterials,
    animated,
  });
  const portLandmarks = buildPortLandmarks({
    THREE,
    scenery,
    kit,
    palette,
    track,
    trafficAt,
    animated,
    geometry,
    props,
    materials: lumenMaterials,
    textures,
  });
  buildPortLighting({ THREE, scenery, track, kit, props, materials: lumenMaterials });
  const harborLife = buildHarborLife({
    THREE,
    animated,
    craneHooks,
    harborPose,
    hazardAt,
    safeGroup,
    scene,
    scenery,
    track,
    kit,
    palette,
    geometry,
  });
  return {
    animated,
    update(time, state) {
      harborLife.update(time, state);
      portLandmarks.update(time, state);
      motion.update(time);
    },
  };
}
