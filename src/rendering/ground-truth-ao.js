import * as THREE from "../../vendor/three/three.module.js";
import {
  GTAOShader,
  generateMagicSquareNoise,
} from "../../vendor/three/addons/shaders/GTAOShader.js";
import {
  PoissonDenoiseShader,
  generatePdSamplePointInitializer,
} from "../../vendor/three/addons/shaders/PoissonDenoiseShader.js";

/** GTAO from resolved scene depth: no normal/geometry pass or temporal history. */
export function createGroundTruthAO(depthTexture, settings = {}) {
  const noise = generateMagicSquareNoise();
  const raw = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  const filtered = raw.clone();
  const ao = new THREE.ShaderMaterial({
    ...GTAOShader,
    defines: { ...GTAOShader.defines, NORMAL_VECTOR_TYPE: 0, SAMPLES: 12 },
    uniforms: THREE.UniformsUtils.clone(GTAOShader.uniforms),
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const denoise = new THREE.ShaderMaterial({
    ...PoissonDenoiseShader,
    defines: {
      ...PoissonDenoiseShader.defines,
      NORMAL_VECTOR_TYPE: 0,
      DEPTH_SWIZZLING: "x",
      SAMPLES: 8,
      SAMPLE_VECTORS: generatePdSamplePointInitializer(8, 2, 1),
      FRAGMENT_OUTPUT: "vec4(denoised, -viewPos.z)",
    },
    uniforms: THREE.UniformsUtils.clone(PoissonDenoiseShader.uniforms),
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  // texelFetch is undefined outside the texture. Clamp reconstructed-normal taps.
  for (const material of [ao, denoise]) {
    material.fragmentShader = material.fragmentShader.replace(
      "texelFetch(tDepth, uv.xy, 0)",
      "texelFetch(tDepth, clamp(uv.xy, ivec2(0), textureSize(tDepth, 0) - ivec2(1)), 0)",
    );
    material.uniforms.tDepth.value = depthTexture;
    material.uniforms.tNoise.value = noise;
  }
  ao.uniforms.radius.value = settings.radius ?? 1.15;
  ao.uniforms.thickness.value = settings.thickness ?? 0.65;
  ao.uniforms.distanceFallOff.value = 1;
  denoise.uniforms.tDiffuse.value = raw.texture;
  denoise.uniforms.radius.value = 3;
  denoise.uniforms.depthPhi.value = 0.35;
  denoise.uniforms.normalPhi.value = 8;
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ao);
  quad.frustumCulled = false;
  scene.add(quad);
  const clearColor = new THREE.Color();
  let width = 0,
    height = 0;
  return {
    texture: filtered.texture,
    size: new THREE.Vector2(1, 1),
    render(renderer, sceneCamera, fullWidth, fullHeight, tier) {
      // Half resolution, capped by the longest axis while retaining aspect ratio.
      const scale = Math.min(0.5, (tier === 3 ? 960 : 640) / Math.max(fullWidth, fullHeight));
      const w = Math.max(1, Math.ceil(fullWidth * scale));
      const h = Math.max(1, Math.ceil(fullHeight * scale));
      if (w !== width || h !== height) {
        width = w;
        height = h;
        raw.setSize(w, h);
        filtered.setSize(w, h);
        this.size.set(w, h);
        for (const material of [ao, denoise]) material.uniforms.resolution.value.set(w, h);
      }
      for (const material of [ao, denoise])
        material.uniforms.cameraProjectionMatrixInverse.value.copy(
          sceneCamera.projectionMatrixInverse,
        );
      ao.uniforms.cameraProjectionMatrix.value.copy(sceneCamera.projectionMatrix);
      ao.uniforms.cameraWorldMatrix.value.copy(sceneCamera.matrixWorld);
      ao.uniforms.cameraNear.value = sceneCamera.near;
      ao.uniforms.cameraFar.value = sceneCamera.far;
      renderer.getClearColor(clearColor);
      const clearAlpha = renderer.getClearAlpha();
      const autoClear = renderer.autoClear;
      try {
        renderer.autoClear = true;
        renderer.setClearColor(0xffffff, 1);
        quad.material = ao;
        renderer.setRenderTarget(raw);
        renderer.render(scene, camera);
        quad.material = denoise;
        renderer.setRenderTarget(filtered);
        renderer.render(scene, camera);
      } finally {
        renderer.setClearColor(clearColor, clearAlpha);
        renderer.autoClear = autoClear;
      }
    },
    dispose() {
      noise.dispose();
      raw.dispose();
      filtered.dispose();
      ao.dispose();
      denoise.dispose();
      quad.geometry.dispose();
    },
  };
}
