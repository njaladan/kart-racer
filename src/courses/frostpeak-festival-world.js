import { createFestivalKit } from "./frostpeak-festival/festival-kit.js";
import { buildWinterValley } from "./frostpeak-festival/build-winter-valley.js";
import { buildSnowTerrain } from "./frostpeak-festival/build-snow-terrain.js";
import { buildMountainHorizon } from "./frostpeak-festival/build-mountain-horizon.js";
import { buildSkiLift } from "./frostpeak-festival/build-ski-lift.js";
import { buildMountainWonders } from "./frostpeak-festival/build-mountain-wonders.js";
import { buildFestivalTown } from "./frostpeak-festival/build-festival-town.js";
import { buildWinterLife } from "./frostpeak-festival/build-winter-life.js";
import { buildFestivalSky } from "./frostpeak-festival/build-festival-sky.js";
import { buildGroomer } from "./frostpeak-festival/build-groomer.js";

export function buildWorld(context) {
  const { THREE, scene, scenery, track, textures, kit } = context;
  const festival = createFestivalKit(context);
  const { palette, geometry, edgeOffset, landAt, rail, groundShadow } = festival;
  buildMountainHorizon({ THREE, scenery, kit, textures });
  buildSnowTerrain({ THREE, scenery, track, kit, textures, edgeOffset });
  buildWinterValley({ THREE, scenery, track, festival });
  const lift = buildSkiLift({
    THREE,
    scene,
    scenery,
    track,
    kit,
    palette,
    geometry,
    edgeOffset,
    landAt,
    rail,
    groundShadow,
  });
  const groomer = buildGroomer({ ...context, festival });
  const wonders = buildMountainWonders({ ...context, festival });
  const town = buildFestivalTown({ ...context, festival });
  const life = buildWinterLife({
    ...context,
    festival,
    town,
    assets: context.assets || { models: {} },
  });
  const sky = buildFestivalSky({ ...context, festival });
  const motion = [groomer, wonders, life, sky];
  for (const g of lift.gondolas) g.userData.skipBake = true;
  return {
    animated: [...motion.flatMap((part) => part.animated), ...lift.gondolas],
    update(time) {
      for (const part of motion) part.update(time);
      for (let i = 0; i < lift.gondolas.length; i++) {
        // A lift is a round trip; cabins never teleport from summit to valley.
        const cycle = (time * 0.012 + i / lift.gondolas.length) % 1;
        const u = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2;
        const f = u * 48,
          k = Math.min(47, Math.floor(f));
        const a = lift.liftPoints[k],
          b = lift.liftPoints[k + 1];
        const cabin = lift.gondolas[i];
        cabin.position.copy(a).lerp(b, f - k);
        cabin.position.x += cycle < 0.5 ? -1.8 : 1.8;
        cabin.rotation.set(
          Math.sin(time * 1.3 + i) * 0.025,
          Math.atan2(b.x - a.x, b.z - a.z),
          Math.sin(time * 0.7 + i) * 0.035,
        );
      }
    },
  };
}
