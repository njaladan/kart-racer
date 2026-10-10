import { backgroundKit } from "./kit.js";
import { windmillBackground } from "./windmill.js";
import { neonBackground } from "./neon.js";

export const COURSE_BACKGROUNDS = {
  "windmill-wilds": windmillBackground,
  "neon-harbor": neonBackground,
};

export function buildCourseBackground(w) {
  const builder = COURSE_BACKGROUNDS[w.track.course.id];
  if (!builder) return;
  const b = backgroundKit(w);
  builder(b);
  w.scene.userData.courseBackground = b.sites;
}
