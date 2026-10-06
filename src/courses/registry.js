import windmill from "./windmill-wilds.js";
import neonHarbor from "./neon-harbor.js";
import sunstoneRuins from "./sunstone-ruins.js";
import frostpeakFestival from "./frostpeak-festival.js";
import clockwork from "./clockwork-citadel.js";
import paper from "./paper-revel.js";
import { validateCourseDefinition } from "./course-contract.js";

export const COURSES = Object.freeze(
  [windmill, neonHarbor, sunstoneRuins, frostpeakFestival, clockwork, paper].map(
    validateCourseDefinition,
  ),
);
export const DEFAULT_COURSE = windmill;

/** Return null for an unknown ID so callers choose their fallback explicitly. */
export function findCourseById(id) {
  return COURSES.find((course) => course.id === id) ?? null;
}

// Preserve the original defaulting lookup for existing callers while new code
// can use findCourseById() when it needs to distinguish a bad ID.
export const courseById = (id) => findCourseById(id) ?? DEFAULT_COURSE;
