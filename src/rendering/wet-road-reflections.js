import * as THREE from "../../vendor/three/three.module.js";
import { patchMaterial } from "./surface-detail.js";

/** Ultra: one capped half-resolution planar capture, reused on alternating frames.
 * Only flat streets qualify; ramps, banks and moving ferry decks use atlas art.
 */
export function createWetRoadReflections() {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const mirror = new THREE.PerspectiveCamera();
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const uniforms = {
    wetReflectionMap: { value: target.texture },
    wetReflectionMatrix: { value: new THREE.Matrix4() },
    wetReflectionStrength: { value: 0 },
    wetReflectionHeight: { value: 0 },
  };
  let quality = 3,
    frame = 0,
    capturedHeight = Infinity;
  const size = new THREE.Vector2(),
    direction = new THREE.Vector3();
  const look = new THREE.Vector3(),
    up = new THREE.Vector3();
  function install(material) {
    patchMaterial(material, "live-wet-reflection-v1", (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = `uniform sampler2D wetReflectionMap;
        uniform mat4 wetReflectionMatrix;
        uniform float wetReflectionStrength,wetReflectionHeight;
        ${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `if(wetReflectionStrength>0.){
          vec4 reflected=wetReflectionMatrix*vec4(vPavementWorld,1.);
          vec2 reflectionUv=reflected.xy/max(reflected.w,.0001);
          float inFrame=step(0.,reflectionUv.x)*step(reflectionUv.x,1.)*
            step(0.,reflectionUv.y)*step(reflectionUv.y,1.)*
            step(0.,reflected.z)*step(reflected.z,reflected.w)*step(.0001,reflected.w);
          float planeFade=1.-smoothstep(.12,.65,abs(vPavementWorld.y-wetReflectionHeight));
          float distanceFade=1.-smoothstep(28.,65.,length(vPavementWorld-cameraPosition));
          reflectionUv+=vec2(sin(vPavementWorld.z*17.),cos(vPavementWorld.x*13.))*.0008;
          float fresnel=.04+.65*pow(1.-clamp(abs(dot(normal,normalize(vViewPosition))),0.,1.),5.);
          float weight=wetReflectionStrength*pavementWetness*planeFade*distanceFade*inFrame*fresnel;
          outgoingLight=mix(outgoingLight,texture2D(wetReflectionMap,reflectionUv).rgb,weight);
        }
        #include <opaque_fragment>`,
      );
    });
  }
  return {
    install,
    setQuality(tier) {
      quality = tier;
      uniforms.wetReflectionStrength.value = 0;
      capturedHeight = Infinity;
      frame = 0;
      if (tier !== 3) target.setSize(1, 1);
    },
    render(renderer, scene, camera) {
      uniforms.wetReflectionStrength.value = 0;
      const surface = scene.userData.wetReflectionSurface;
      if (quality !== 3 || !surface?.eligible || camera.position.y <= surface.height + 0.1) return;
      renderer.getDrawingBufferSize(size);
      const scale = Math.min(0.5, 640 / Math.max(size.x, size.y));
      const width = Math.max(1, Math.round(size.x * scale));
      const height = Math.max(1, Math.round(size.y * scale));
      const resized = target.width !== width || target.height !== height;
      if (resized) target.setSize(width, height);
      // Use the saved projection with the saved image, avoiding camera reprojection swim.
      const refresh = !surface.frozen && frame++ % 2 === 0;
      if (resized || Math.abs(capturedHeight - surface.height) > 0.12 || refresh) {
        mirror.copy(camera);
        mirror.position.y = 2 * surface.height - camera.position.y;
        camera.getWorldDirection(direction);
        direction.y *= -1;
        up.set(0, 1, 0).applyQuaternion(camera.quaternion);
        up.y *= -1;
        mirror.up.copy(up);
        mirror.lookAt(look.copy(mirror.position).add(direction));
        mirror.updateMatrixWorld();
        const matrix = uniforms.wetReflectionMatrix.value;
        matrix.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
        clip.constant = -surface.height - 0.09;
        const previousTarget = renderer.getRenderTarget();
        const previousClipping = renderer.clippingPlanes;
        const previousShadowUpdate = renderer.shadowMap.autoUpdate;
        const previousXr = renderer.xr.enabled;
        // No recursive reflection or second shadow pass. Always restore renderer state.
        try {
          renderer.xr.enabled = false;
          renderer.shadowMap.autoUpdate = false;
          renderer.clippingPlanes = [clip];
          renderer.setRenderTarget(target);
          renderer.clear();
          renderer.render(scene, mirror);
          capturedHeight = surface.height;
          uniforms.wetReflectionHeight.value = surface.height;
        } finally {
          renderer.setRenderTarget(previousTarget);
          renderer.clippingPlanes = previousClipping;
          renderer.shadowMap.autoUpdate = previousShadowUpdate;
          renderer.xr.enabled = previousXr;
        }
      }
      uniforms.wetReflectionStrength.value = 0.85;
    },
    dispose() {
      target.dispose();
    },
  };
}
