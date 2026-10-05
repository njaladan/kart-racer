import { createTrack } from './track-builder.js';
import windmill from './courses/windmill-wilds.js';
export { TRACK, wrap01, trackT, laneWidth, yawFor, createTrack } from './track-builder.js';
export const TARGET_LENGTH = 1500;
export let activeTrack;
export let WORLD_PER_UNIT, metresToProgress, SECTIONS, sectionAt, RAMPS, MILL_T, CART_T, BRIDGE_RANGE, SHORTCUT, BOOST_PADS, ITEM_ROWS, shortcutWidth, roadHalfWidth, surfaceAt, collisionBounds, bankAt, rampHeight, routePoint, SAMPLE_COUNT, COURSE_LENGTH, frameAt, poseAt, projectTrack, sectorT;
export function selectCourse(course) {
  activeTrack = createTrack(course);
  ({WORLD_PER_UNIT, metresToProgress, SECTIONS, sectionAt, RAMPS, MILL_T, CART_T, BRIDGE_RANGE, SHORTCUT, BOOST_PADS, ITEM_ROWS, shortcutWidth, roadHalfWidth, surfaceAt, collisionBounds, bankAt, rampHeight, routePoint, SAMPLE_COUNT, COURSE_LENGTH, frameAt, poseAt, projectTrack, sectorT} = activeTrack);
  return activeTrack;
}
selectCourse(windmill);
