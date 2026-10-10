import * as THREE from "../../vendor/three/three.module.js";
import { patchMaterial } from "./surface-detail.js";

/** A fixed optical warp, installed only on the desert backdrop's own materials.
 * World coordinates anchor the waves through camera turns. Distance uses horizontal
 * separation, so pitching/rotating the chase camera cannot change the distortion.
 * Only projection changes: lighting, shadows and the driving geometry stay intact.
 */
export function installDesertMirage(material, settings = {}) {
  const uniforms = {
    desertMirageRange: { value: new THREE.Vector2(settings.start ?? 450, settings.end ?? 800) },
    desertMirageStrength: { value: settings.strength ?? 1 },
  };
  // These horizon illusions must not be baked into the lighting of the actual course.
  material.userData.excludeFromReflectionProbe = true;
  return patchMaterial(material, "desert-backdrop-mirage-v1", (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform vec2 desertMirageRange;
      uniform float desertMirageStrength;
      ${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `vec4 mvPosition=vec4(transformed,1.);
      #ifdef USE_BATCHING
        mvPosition=batchingMatrix*mvPosition;
      #endif
      #ifdef USE_INSTANCING
        mvPosition=instanceMatrix*mvPosition;
      #endif
      vec4 mirageWorld=modelMatrix*mvPosition;
      float mirageDistance=length(mirageWorld.xz-cameraPosition.xz);
      float mirageAmount=smoothstep(desertMirageRange.x,desertMirageRange.y,mirageDistance)*desertMirageStrength;
      // The pattern has no screen coordinates or animation clock.
      float mirageBroad=sin(mirageWorld.x*.071+mirageWorld.z*.053);
      float mirageShear=sin(mirageWorld.y*.65+mirageWorld.x*.026+mirageWorld.z*.023);
      vec3 mirageOffset=vec3(sin(mirageWorld.y*.4+mirageWorld.z*.031)*2.,
        mirageBroad*10.+mirageShear*6.,0.)*mirageAmount;
      mvPosition=viewMatrix*vec4(mirageWorld.xyz+mirageOffset,1.);
      gl_Position=projectionMatrix*mvPosition;`,
    );
  });
}
