import { createRouteClearance } from "./route-clearance.js";

/** Reserve whole structures against every road floor, including alternate paths. */
export function createScenerySite(kit, track, parent) {
  const allows = createRouteClearance(track);
  return (section, fraction, offset, footprint = 5, height = 40, bottom) => {
    const t = track.sectorT(section, fraction);
    const base = track.frameAt(t).p.y - 1;
    const floor = bottom ?? track.course.theme.groundHeight ?? -25;
    for (let attempt = 0; attempt < 18; attempt++) {
      const lateral = offset + (offset < 0 ? -1 : 1) * attempt * 8;
      const g = kit.groupAt(t, lateral, parent);
      g.position.y = base;
      g.rotation.set(0, track.yawFor(track.frameAt(t).tangent), 0);
      const low = Math.min(base - 2, floor);
      if (
        allows(
          g,
          [0, (height + low - base) / 2, 0],
          [footprint * 2, height - low + base, footprint * 2],
        )
      ) {
        g.userData.scenerySite = { section, fraction, footprint, height };
        return g;
      }
      g.removeFromParent();
    }
    return null;
  };
}
