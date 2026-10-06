import * as THREE from "../../vendor/three/three.module.js";
import { COURSE_ENVIRONMENTS } from "./environment-palettes.js";
import { createEnvironmentParticleField } from "../rendering/environment-particles.js";
import { installEnvironmentSurfaceMotion } from "../rendering/environment-surfaces.js";
import { vignetteKit } from "./vignettes/vignette-kit.js";
import { buildWindmillStories } from "./vignettes/windmill.js";
import { buildNeonStories } from "./vignettes/neon.js";
import { buildSunstoneStories } from "./vignettes/sunstone.js";
import { buildFrostpeakStories } from "./vignettes/frostpeak.js";
import { buildClockworkStories } from "./vignettes/clockwork.js";
import { buildPaperStories } from "./vignettes/paper.js";

const STORIES = {
  "windmill-wilds": buildWindmillStories,
  "neon-harbor": buildNeonStories,
  "sunstone-ruins": buildSunstoneStories,
  "frostpeak-festival": buildFrostpeakStories,
  "clockwork-citadel": buildClockworkStories,
  "paper-revel": buildPaperStories,
};

/** Compose existing worlds with their local weather, particles and surface response. */
export function buildCourseEnvironment({ scene, track, textures, surfaces = [] }) {
  const builder = STORIES[track.course.id];
  let stories;
  if (builder) {
    const kit = vignetteKit({ scene, track, textures });
    builder(kit);
    stories = kit.finish();
  } else {
    const scenery = new THREE.Group();
    scenery.name = `${track.course.name} environmental layers`;
    scene.add(scenery);
    stories = { scenery, animated: [], sites: [], update() {} };
  }
  const sources = new Map();
  scene.traverse((object) => {
    if (object.userData.environmentSource) sources.set(object.userData.environmentSource, object);
  });
  for (const site of stories.sites) sources.set(site.name, site.group);
  const fields = COURSE_ENVIRONMENTS[track.course.id].map((spec, i) => {
    const source = sources.get(spec.source);
    const field = createEnvironmentParticleField(track, spec, 8107 + i * 137, source);
    (source || stories.scenery).add(field.object);
    return field;
  });
  const clock = { value: 0 };
  for (const material of new Set(surfaces))
    installEnvironmentSurfaceMotion(material, track.course.id, clock);
  fields.forEach((field) => field.update(0));
  return {
    ...stories,
    fields,
    clock,
    animated: [...stories.animated, ...fields.map((field) => field.object)],
    update(time, state) {
      const seconds = state?.motionEnabled === false ? 0 : time;
      clock.value = seconds;
      stories.update(seconds);
      fields.forEach((field) => field.update(seconds));
    },
    setQuality(tier) {
      fields.forEach((field) => field.setQuality(tier));
    },
    updateCamera(position) {
      fields.forEach((field) => field.updateCamera(position));
    },
  };
}

export function composeCourseEnvironment(world, environment, detail) {
  return {
    ...world,
    ...detail,
    environment,
    animated: [...(world.animated || []), ...environment.animated],
    update(time, state) {
      world.update?.(time, state);
      environment.update(time, state);
    },
    setQuality(tier) {
      detail.setQuality(tier);
      world.setQuality?.(tier);
      environment.setQuality(tier);
    },
    updateCamera(position, tier) {
      detail.updateCamera(position, tier);
      world.updateCamera?.(position, tier);
      environment.updateCamera(position);
    },
  };
}
