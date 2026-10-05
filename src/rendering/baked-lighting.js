import * as THREE from "../../vendor/three/three.module.js";
import { patchMaterial } from "./surface-detail.js";

/** Offline scene rays supply occlusion, bounced color and static lamp pools. */
export async function loadCourseBake(courseId) {
  const base = `./assets/lighting/${courseId}/`;
  const response = await fetch(`${base}bake.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Course lighting could not load: ${courseId}`);
  const metadata = await response.json();
  const loader = new THREE.TextureLoader();
  const [lighting, height] = await Promise.all([
    loader.loadAsync(base + metadata.lighting),
    loader.loadAsync(base + metadata.height),
  ]);
  for (const texture of [lighting, height]) {
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  height.generateMipmaps = false;
  height.minFilter = height.magFilter = THREE.LinearFilter;
  return { metadata, lighting, height };
}

export function installCourseBake(scene, bake) {
  if (!bake) return;
  const { bounds, heightRange, bounceScale = 0.65 } = bake.metadata;
  const uniforms = {
    courseBakeMap: { value: bake.lighting },
    courseHeightMap: { value: bake.height },
    courseBakeBounds: { value: new THREE.Vector4(...bounds) },
    courseBakeHeight: { value: new THREE.Vector2(...heightRange) },
    courseBakeBounce: { value: bounceScale },
  };
  scene.userData.courseBake = bake.metadata;
  scene.traverse((object) => {
    if (!object.isMesh || object.userData.skipBake) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material?.isMeshStandardMaterial || material.userData.waterUniforms) continue;
      patchMaterial(material, "offline-course-bake-v1", (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = `varying vec3 vCourseBakeWorld;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
          vec4 bakePosition=vec4(transformed,1.);
          #ifdef USE_BATCHING
            bakePosition=batchingMatrix*bakePosition;
          #endif
          #ifdef USE_INSTANCING
            bakePosition=instanceMatrix*bakePosition;
          #endif
          vCourseBakeWorld=(modelMatrix*bakePosition).xyz;`,
        );
        shader.fragmentShader = `varying vec3 vCourseBakeWorld;
          uniform sampler2D courseBakeMap,courseHeightMap;
          uniform vec4 courseBakeBounds;
          uniform vec2 courseBakeHeight;
          uniform float courseBakeBounce;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_end>",
          `#include <lights_fragment_end>
          vec2 bakeUv=(vCourseBakeWorld.xz-courseBakeBounds.xy)/courseBakeBounds.zw;
          float insideBake=step(0.,bakeUv.x)*step(0.,bakeUv.y)*step(bakeUv.x,1.)*step(bakeUv.y,1.);
          vec4 courseLight=texture2D(courseBakeMap,bakeUv);
          float encodedHeight=dot(texture2D(courseHeightMap,bakeUv).rg,vec2(256./257.,1./257.));
          float bakeY=mix(courseBakeHeight.x,courseBakeHeight.y,encodedHeight);
          float nearGround=(1.-smoothstep(1.5,6.,abs(vCourseBakeWorld.y-bakeY)))*insideBake;
          reflectedLight.indirectDiffuse*=mix(1.,courseLight.a,nearGround);
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*courseLight.rgb*courseBakeBounce*nearGround;`,
        );
      });
    }
  });
}
