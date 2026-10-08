#!/usr/bin/env node
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { COURSES } from "../src/courses/registry.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const skipExport = args.includes("--skip-export");
const selected = args.filter((arg) => arg !== "--skip-export");
const courses = selected.length ? selected : COURSES.map(({ id }) => id);
if (courses.some((id) => !COURSES.some((course) => course.id === id))) {
  throw new Error("Unknown course requested for lighting bake");
}
function run(command, parameters) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, parameters, { cwd: root, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`${command} failed (${code ?? signal})`)),
    );
  });
}
if (!skipExport) await run(process.execPath, ["tools/export-lighting-scene.mjs", ...courses]);
const concurrency = Math.max(
  1,
  Math.min(
    courses.length,
    Number(process.env.LIGHTING_BAKE_JOBS) || Math.min(3, availableParallelism()),
  ),
);
let next = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < courses.length) {
      const course = courses[next++];
      for (const script of ["bake-course-lighting.py", "bake-mesh-lighting.py"]) {
        await run(process.env.BLENDER_PATH || "blender", [
          "-b",
          "-t",
          "1",
          "--python-exit-code",
          "1",
          "--python",
          `tools/${script}`,
          "--",
          course,
        ]);
      }
    }
  }),
);
console.log(`Regenerated ground and mesh lighting for ${courses.length} courses.`);
