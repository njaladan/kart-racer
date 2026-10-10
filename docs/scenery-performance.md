# Scenery batching experiment

The game currently uses Three's WebGL renderer. The M1 MacBook Air profile from
the earlier profiling chat showed two different limits: Neon and Windmill had
substantial CPU submission cost, while Frostpeak was sensitive to rendering
resolution and material shading. GPU timer-query values were unreliable under
ANGLE/Metal. That evidence does not establish an expected WebGPU FPS multiplier.

Reduce rendering work and measure on the M1 before replacing the renderer. The
first runtime compiler groups compatible static scenery into spatial
`BatchedMesh` chunks. This is a limited rendering stage, not an offline course
compiler or streaming system: authored builders and asset loading still run.
Moving objects, existing instances, transparent surfaces, water, wind deformation,
custom render hooks, mirrored/sheared transforms and partial geometry stay on
their existing rendering paths. LOD membership, normalized baked-light attributes,
shader uniforms and per-member camera/shadow culling are retained.

Chunks are enabled by default. `&sceneryChunks=0` (or `?sceneryChunks=0` as the
first URL parameter) disables them for comparison without allocating buffers.
Browsers without `WEBGL_multi_draw` keep the original scene and do not allocate
batch buffers.
The experiment leaves resolution, effects and triangle detail unchanged. It
adds vertex transform/indirection work and duplicates eligible geometry buffers;
fewer submissions alone do not establish a net GPU, FPS or battery benefit.

Cloud software-renderer checks at two camera positions found approximately 3%
fewer submissions in Frostpeak, 6–9% in Neon, 9–12% in Pelagic and 11–16% in Sunstone,
with the same submitted triangle counts and no WebGL errors. A separate
controlled rendering comparison with rotated/scaled objects, shared animated
scan materials and carved sandstone was pixel-identical. Cloud course images
had dark material rendering on both paths, so they do not establish full course
visual fidelity on the M1. These are correctness/submission checks, not M1 FPS
or power measurements.

## Compare on the M1

Serve the repository on port 5173. With Chrome and Playwright installed, run:

```sh
PROFILE_CHUNKS=1 PROFILE_WIDTH=1440 PROFILE_HEIGHT=900 PROFILE_VISUALS=1 \
  node tools/profile-courses.mjs frostpeak-festival neon-harbor pelagic-glasshouse
```

This retains the previously profiled 2304x1440 drawing buffer, Ultra, bloom and
motion, with adaptive quality disabled. Each course is compared with chunks off
and on using the same authored scene and deterministic seed. Reports and views
are saved under `/tmp/kart-profile`; `PLAYWRIGHT_MODULE` can point at an existing
Playwright installation. Compare FPS, CPU submission time, frame percentiles and
images; add `PROFILE_CHUNKS_FIRST=1` to reverse stage order when assessing small
differences. Thermal
conditions and background apps can dominate small improvements.

Use M1 results to assess the net benefit and check for visual regressions.
Next, an offline course compiler can prebuild geometry, spatial ownership,
lighting attributes and asset manifests to reduce startup work and support
streaming. Keep that output independent of the rendering backend. WebGPU can
then consume the same course data, but the current GLSL material hooks,
postprocessing and reflection passes still need migration. GPU-heavy courses
also need shading/pass profiling; chunking does not reduce their pixel workload.
