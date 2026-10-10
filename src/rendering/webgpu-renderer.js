import { WebGPURenderer } from "../../vendor/three/three.webgpu.js";
import { installWebGPUMaterials } from "./webgpu-shaders.js";

export async function createWebGPURenderer(options) {
  if (!globalThis.navigator?.gpu) {
    throw new Error(
      "WebGPU is unavailable. Open Turbo Trail in a WebGPU-capable browser over HTTPS or localhost.",
    );
  }
  const renderer = new WebGPURenderer({ ...options, getFallback: null });
  renderer._getFallback = null;
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend) {
    renderer.dispose();
    throw new Error("A WebGPU adapter could not be initialized.");
  }
  installWebGPUMaterials(renderer);
  return renderer;
}
