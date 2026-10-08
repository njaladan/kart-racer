#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectMeshLightSamples } from "../src/rendering/mesh-light-bake.js";

/** Export the assembled course's mesh samples beside the shared scene BVH input. */
export async function exportMeshLighting(
  scene,
  world,
  course,
  output = "/tmp/turbo-trail-lighting-scenes",
) {
  await mkdir(output, { recursive: true });
  const sceneJson = await readFile(resolve(output, `${course.id}.json`));
  const sceneBinary = await readFile(resolve(output, `${course.id}.bin`));
  const sourceSceneSha256 = createHash("sha256")
    .update(sceneJson)
    .update(sceneBinary)
    .digest("hex");
  const collected = collectMeshLightSamples(scene, world);
  const binary = Buffer.from(
    collected.samples.buffer,
    collected.samples.byteOffset,
    collected.samples.byteLength,
  );
  const sampleSha256 = createHash("sha256").update(binary).digest("hex");
  const metadata = {
    version: 1,
    course: course.id,
    sourceSceneSha256,
    sampleFormat: "little-endian float32 x,y,z,nx,ny,nz",
    sampleCount: collected.samplesCount,
    sampleSha256,
    entries: collected.entries,
  };
  await writeFile(resolve(output, `${course.id}-mesh-samples.bin`), binary);
  await writeFile(
    resolve(output, `${course.id}-mesh-samples.json`),
    `${JSON.stringify(metadata)}\n`,
  );
  return {
    course: course.id,
    meshEntries: metadata.entries.length,
    samples: metadata.sampleCount,
    sourceSceneSha256,
  };
}
