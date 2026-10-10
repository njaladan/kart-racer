import { backgroundKit } from "./kit.js";
import { windmillBackground } from "./windmill.js";
import { neonBackground } from "./neon.js";
import { frostpeakBackground } from "./frostpeak.js";
import { clockworkBackground } from "./clockwork.js";
import { paperBackground } from "./paper.js";
import { tempestBackground } from "./tempest.js";
import { pantryBackground } from "./pantry.js";
import { railstormBackground } from "./railstorm.js";
import { metronomeBackground } from "./metronome.js";
import { pelagicBackground } from "./pelagic.js";
import { emberwingBackground } from "./emberwing.js";

export const COURSE_BACKGROUNDS = {
  "windmill-wilds": windmillBackground,
  "neon-harbor": neonBackground,
  "frostpeak-festival": frostpeakBackground,
  "clockwork-citadel": clockworkBackground,
  "paper-revel": paperBackground,
  "tempest-causeway": tempestBackground,
  "pocket-pantry": pantryBackground,
  "railstorm-express": railstormBackground,
  "metronome-hall": metronomeBackground,
  "pelagic-glasshouse": pelagicBackground,
  "emberwing-observatory": emberwingBackground,
};

export function buildCourseBackground(w) {
  const builder = COURSE_BACKGROUNDS[w.track.course.id];
  if (!builder) return;
  const b = backgroundKit(w);
  builder(b);
  w.scene.userData.courseBackground = b.sites;
}
