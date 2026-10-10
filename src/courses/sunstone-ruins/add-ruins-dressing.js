import { placeRock } from "./ruins-assets.js";

/** Composed expedition scenery: authored STK models, clusters and terrain beds.
 * Every root tests its whole footprint against the nearest physical road arm.
 */
export function addRuinsDressing({
  kit,
  track,
  grounded,
  groundShadow,
  duneGeometry,
  sand,
  sandShade,
}) {
  const { sectorT, mesh, asset } = kit;
  // Each sector gets foreground objects, mid-distance structures and lower
  // contrast far silhouettes. Counts are bounded; repeated GLBs share buffers.
  for (let sector = 0; sector < 6; sector++) {
    for (let cluster = 0; cluster < 11; cluster++) {
      const t = sectorT(sector, (cluster + 0.6) / 12);
      const side = cluster % 2 ? 1 : -1;
      const edge = track.surfaceAt(t);
      const offset = side > 0 ? edge.rightEdge + 8 : edge.leftEdge - 8;
      const root = grounded(t, offset, 4);
      if (!root) continue;
      root.name = `Ruins sector ${sector} foreground cluster`;
      // Rough sand/gravel transition beds feather down to the shared terrain.
      const bed = mesh(
        duneGeometry,
        cluster % 3 ? sand : sandShade,
        root,
        [0, -0.08, 0],
        [4.4, 0.65, 5.8],
      );
      bed.castShadow = false;
      bed.userData.bakeReceiver = true;
      groundShadow(root, 7, 6);
      for (let j = 0; j < 3; j++) {
        const b = placeRock(
          kit,
          "ruins:boulder",
          root,
          [-2.4 + j * 2.1, -0.06, (j % 2) * 2 - 1],
          [1.4 + j * 0.45, 0.65 + j * 0.45, 1.4 + j * 0.4],
        );
        b.rotation.y = cluster * 1.37 + j;
      }
      const shrub = asset("ruins:shrub", root, [1.6, 0, 1.3], [1.8, 1.5, 1.8]);
      shrub.rotation.y = cluster * 0.9;
      if (sector === 0 || sector === 3) {
        asset("ruins:grass", root, [-1.8, 0, 1.5], [1.2, 1.2, 1.2]);
        asset("ruins:grass", root, [2.7, 0, -1.8], [0.8, 0.8, 0.8]);
      }
    }
    for (let cluster = 0; cluster < 4; cluster++) {
      const t = sectorT(sector, 0.14 + cluster * 0.22);
      const side = cluster % 2 ? 1 : -1;
      const offset = side * (sector === 5 ? 82 : 61);
      const root = grounded(t, offset, 25);
      if (!root) continue;
      root.name = `Ruins sector ${sector} settlement`;
      if (sector === 0) {
        const hut = asset("ruins:hut", root, [0, 0, 0], [8.5, 8.5, 8.5]);
        hut.rotation.y = cluster * 0.8;
        asset("ruins:palm", root, [10, 0, 3], [11, 11, 11]);
        asset("ruins:palm", root, [-8, 0, -5], [8, 8, 8]);
      } else if (sector === 3 || sector === 4) {
        const ruin = asset(
          cluster % 2 ? "ruins:shrine" : "ruins:ruined-house",
          root,
          [0, 0, 0],
          [15, 15, 15],
        );
        ruin.rotation.y = cluster * 0.87;
        asset("ruins:dragon", root, [-9, 0, -7], [4, 4, 4]);
      } else {
        const crag = placeRock(kit, "ruins:cliff", root, [0, -1.5, 0], [17, 19 + cluster * 3, 15]);
        crag.rotation.y = cluster * 0.75;
        placeRock(kit, "ruins:boulder", root, [-11, 0, 4], [8, 7, 7]);
        if (cluster % 2 === 0) {
          asset("ruins:ruined-house", root, [8, 0, 6], [9, 9, 9]);
        }
      }
      groundShadow(root, 24, 20);
    }
  }
}
