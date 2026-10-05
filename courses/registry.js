import windmill from './windmill-wilds.js';
import neonHarbor from './neon-harbor.js';
import sunstoneRuins from './sunstone-ruins.js';
import frostpeakFestival from './frostpeak-festival.js';

export const COURSES = Object.freeze([windmill,neonHarbor,sunstoneRuins,frostpeakFestival]);
export const courseById = id => COURSES.find(course=>course.id===id) || windmill;
