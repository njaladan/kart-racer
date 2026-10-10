import { createDesertHeightField, createDesertTerrainTile } from "./desert-terrain.js";
import { buildWeatheredLandmarks } from "./weathered-landmarks.js";
import { installSurfaceDetail } from "../../rendering/surface-detail.js";

/** Continuous wind-shaped sand and a few archaeological sites, with long empty vistas. */
export function buildDesertHorizon({ THREE, scenery, track, kit, textures }) {
  const field = createDesertHeightField(track);
  const sand = kit.material("#ffffff", {
    roughness: 1,
    bumpMap: textures.sand,
    bumpScale: 0.025,
  });
  installSurfaceDetail(sand, { kind: "terrain", strength: 0.055, scale: 0.013 });
  for (let x = -6; x < 6; x++)
    for (let z = -6; z < 6; z++) {
      const wx = x * 240 + 120,
        wz = z * 240 + 120;
      const geometry = createDesertTerrainTile(THREE, field, wx, wz);
      const tile = kit.mesh(geometry, sand, scenery, [wx, 0, wz]);
      tile.name = "Continuous wind shaped desert terrain";
      tile.castShadow = false;
      tile.userData.bakeReceiver = true;
      tile.userData.desertTerrain = true;
    }
  buildWeatheredLandmarks({ THREE, scenery, kit, textures, field });
  return field;
}
