#!/usr/bin/env node
// Blender receives the same evaluated road edges and flight endpoints as the game.
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import course from "../src/courses/emberwing-observatory.js";
import { createTrack } from "../src/track/track-builder.js";
import { rangeFor } from "../src/simulation/course-mechanics.js";

const track = createTrack(course);
const flight = rangeFor(track, course.traversals[0]);
const a = track.poseAt(flight.start * track.TRACK, 0).p;
const b = track.poseAt(flight.end * track.TRACK, 0).p;
const sections = [];
for (const [section, range] of track.SECTIONS.entries()) {
  const spans =
    section === 2
      ? [
          [range.start, flight.start],
          [flight.end, range.end],
        ]
      : [[range.start, range.end]];
  for (const [span, [start, end]] of spans.entries()) {
    const count = Math.max(3, Math.ceil(((end - start) * track.COURSE_LENGTH) / 3));
    const edges = [-1, 1].map((side) =>
      Array.from({ length: count + 1 }, (_, i) => {
        const t = start + ((end - start) * i) / count;
        // Match the rock shoulder exactly at its top, then grow outwards below it.
        const offset = section === 2 ? side * 22 : track.platformEdgeAt(t, side);
        const p = track.poseAt(t * track.TRACK, offset, -0.24).p;
        const right = track.frameAt(t).right.clone().setY(0).normalize().multiplyScalar(side);
        return { p: p.toArray(), outward: right.toArray(), t };
      }),
    );
    sections.push({ name: `ember:cliff-${section}-${span}`, section, span, edges });
  }
}
const layout = {
  course: course.id,
  floor: course.theme.groundHeight,
  caldera: {
    centre: [(a.x + b.x) / 2, -7, (a.z + b.z) / 2],
    radius: Math.hypot(a.x - b.x, a.z - b.z) / 2 + 22,
  },
  sections,
};
layout.digest = createHash("sha256").update(JSON.stringify(layout)).digest("hex");
await writeFile(
  process.argv[2] || "/tmp/emberwing-layout.json",
  JSON.stringify(layout, null, 2) + "\n",
);
console.log(`Exported ${sections.length} cliff spans; layout ${layout.digest.slice(0, 12)}`);
