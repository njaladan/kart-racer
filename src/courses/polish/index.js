import { createPolishKit } from "../../rendering/course-polish-kit.js";
import { polishWindmill } from "./windmill.js";
import { polishSunstone } from "./sunstone.js";
import { polishFrostpeak } from "./frostpeak.js";
import { polishNeon } from "./neon.js";
import { polishClockwork } from "./clockwork.js";
import { polishMetronome } from "./metronome.js";
import { polishPaper } from "./paper.js";
import { polishPantry } from "./pantry.js";
import { polishRailstorm } from "./railstorm.js";
import { polishTempest } from "./tempest.js";
import { polishPelagic } from "./pelagic.js";
import { polishEmberwing } from "./emberwing.js";

export const COURSE_POLISH = Object.freeze({
  "windmill-wilds": polishWindmill,
  "sunstone-ruins": polishSunstone,
  "frostpeak-festival": polishFrostpeak,
  "neon-harbor": polishNeon,
  "clockwork-citadel": polishClockwork,
  "metronome-hall": polishMetronome,
  "paper-revel": polishPaper,
  "pocket-pantry": polishPantry,
  "railstorm-express": polishRailstorm,
  "tempest-causeway": polishTempest,
  "pelagic-glasshouse": polishPelagic,
  "emberwing-observatory": polishEmberwing,
});

export function buildCoursePolish(context) {
  const kit = createPolishKit(context);
  COURSE_POLISH[context.track.course.id]?.(kit);
  return kit.finish();
}
