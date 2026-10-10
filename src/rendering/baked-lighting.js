import * as THREE from "../../vendor/three/three.module.js";
import { patchMaterial } from "./surface-detail.js";
import { loadGlobalIllumination, installGlobalIllumination } from "./baked-global-illumination.js";

/** Offline scene rays supply occlusion, bounced color and static lamp pools. */
export async function loadCourseBake(courseId) {
  const base = `./assets/lighting/${courseId}/`;
  const response = await fetch(`${base}bake.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Course lighting could not load: ${courseId}`);
  const metadata = await response.json();
  if (
    metadata.globalIllumination &&
    metadata.globalIllumination.sourceSceneSha256 !== metadata.sourceSceneSha256
  )
    throw new Error(`Baked GI references a different scene: ${courseId}`);
  const loader = new THREE.TextureLoader();
  const [lighting, height, spill] = await Promise.all([
    loader.loadAsync(base + metadata.lighting),
    loader.loadAsync(base + metadata.height),
    metadata.lightVolume ? loader.loadAsync(base + metadata.lightVolume.file) : null,
  ]);
  for (const texture of [lighting, height, spill].filter(Boolean)) {
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  height.generateMipmaps = false;
  height.minFilter = height.magFilter = THREE.LinearFilter;
  if (spill) {
    spill.generateMipmaps = false;
    spill.minFilter = spill.magFilter = THREE.LinearFilter;
  }
  const globalIllumination = await loadGlobalIllumination(
    metadata.globalIllumination,
    base,
    loader,
  );
  return { metadata, lighting, height, spill, globalIllumination };
}

export function installCourseBake(scene, bake) {
  if (!bake) return;
  const { bounds, heightRange, bounceScale = 0.65 } = bake.metadata;
  const volume = bake.metadata.lightVolume;
  const uniforms = {
    courseBakeMap: { value: bake.lighting },
    courseHeightMap: { value: bake.height },
    courseBakeBounds: { value: new THREE.Vector4(...bounds) },
    courseBakeHeight: { value: new THREE.Vector2(...heightRange) },
    courseBakeBounce: { value: bounceScale },
    courseBakeEnabled: { value: 1 },
  };
  scene.userData.courseBakeUniforms = uniforms;
  if (volume) {
    Object.assign(uniforms, {
      courseSpillMap: { value: bake.spill },
      courseSpillGrid: { value: new THREE.Vector2(volume.columns, volume.rows) },
      courseSpillHeights: { value: volume.heights },
      courseSpillStrength: { value: volume.strength },
    });
  }
  const volumeShader = volume
    ? `
    uniform sampler2D courseSpillMap;
    uniform vec2 courseSpillGrid;
    uniform float courseSpillHeights[${volume.heights.length}],courseSpillStrength;
    vec3 courseSpillSlice(vec2 uv,int layer){
      float index=float(layer);
      vec2 tile=vec2(mod(index,courseSpillGrid.x),floor(index/courseSpillGrid.x));
      return texture2D(courseSpillMap,(tile+clamp(uv,vec2(${0.5 / volume.resolution}),vec2(${1 - 0.5 / volume.resolution})))/courseSpillGrid).rgb;
    }
    vec3 courseSpillAt(vec2 uv,float height){
      int lower=0;
      for(int i=0;i<${volume.heights.length - 1};i++){
        if(height>=courseSpillHeights[i])lower=i;
      }
      float blend=clamp((height-courseSpillHeights[lower])/
        (courseSpillHeights[lower+1]-courseSpillHeights[lower]),0.,1.);
      return mix(courseSpillSlice(uv,lower),courseSpillSlice(uv,lower+1),blend);
    }`
    : "";
  scene.userData.courseBake = bake.metadata;
  scene.traverse((object) => {
    if (!object.isMesh || object.userData.skipBake) return;
    if (object.userData.bakeReceiver) {
      // A large receiver's corner samples cannot represent shadows between
      // vertices. Keep its spatial ground bake active even with a mesh bake.
      object.geometry = object.geometry.clone();
      object.geometry.setAttribute(
        "courseGroundBake",
        new THREE.Uint8BufferAttribute(
          new Uint8Array(object.geometry.attributes.position.count).fill(255),
          1,
          true,
        ),
      );
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material?.isMeshStandardMaterial || material.userData.waterUniforms) continue;
      material.defaultAttributeValues ||= {};
      material.defaultAttributeValues.lightBake = [0, 0, 0, 0];
      material.defaultAttributeValues.instanceLightBake = [0, 0, 0, 0];
      material.defaultAttributeValues.courseGroundBake = [0];
      patchMaterial(material, `offline-course-bake-v4-${volume?.heights.length ?? 0}`, (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = `varying vec3 vCourseBakeWorld;varying vec4 vMeshLightBake;
          attribute float courseGroundBake;varying float vCourseGroundBake;
          #ifdef USE_INSTANCING
            attribute vec4 instanceLightBake;
          #else
            attribute vec4 lightBake;
          #endif
          ${shader.vertexShader}`;
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
          vCourseBakeWorld=(modelMatrix*bakePosition).xyz;
          vCourseGroundBake=courseGroundBake;
          #ifdef USE_INSTANCING
            vMeshLightBake=instanceLightBake;
          #else
            vMeshLightBake=lightBake;
          #endif`,
        );
        shader.fragmentShader = `varying vec3 vCourseBakeWorld;varying vec4 vMeshLightBake;varying float vCourseGroundBake;
          uniform sampler2D courseBakeMap,courseHeightMap;
          uniform vec4 courseBakeBounds;
          uniform vec2 courseBakeHeight;
          uniform float courseBakeBounce,courseBakeEnabled;
          ${volumeShader}\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_end>",
          `#include <lights_fragment_end>
          vec2 bakeUv=(vCourseBakeWorld.xz-courseBakeBounds.xy)/courseBakeBounds.zw;
          float insideBake=step(0.,bakeUv.x)*step(0.,bakeUv.y)*step(bakeUv.x,1.)*step(bakeUv.y,1.);
          float hasMeshBake=step(.001,vMeshLightBake.a)*(1.-step(.5,vCourseGroundBake))*courseBakeEnabled;
          reflectedLight.indirectDiffuse*=mix(1.,vMeshLightBake.a,hasMeshBake);
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*vMeshLightBake.rgb*courseBakeBounce*hasMeshBake;
          reflectedLight.indirectSpecular*=mix(1.,vMeshLightBake.a,hasMeshBake*roughnessFactor*.35);
          // Most scenery already has mesh lighting. Sample the fallback maps
          // only for uncovered surfaces, retaining exactly the baked result.
          if(hasMeshBake<.5){
            vec4 courseLight=texture2D(courseBakeMap,bakeUv);
            float encodedHeight=dot(texture2D(courseHeightMap,bakeUv).rg,vec2(256./257.,1./257.));
            float bakeY=mix(courseBakeHeight.x,courseBakeHeight.y,encodedHeight);
            float nearGround=(1.-smoothstep(1.5,6.,abs(vCourseBakeWorld.y-bakeY)))*insideBake*courseBakeEnabled;
            reflectedLight.indirectDiffuse*=mix(1.,courseLight.a,nearGround);
            reflectedLight.indirectDiffuse+=diffuseColor.rgb*courseLight.rgb*courseBakeBounce*nearGround;
          ${
            volume
              ? `vec3 spillLight=courseSpillAt(bakeUv,vCourseBakeWorld.y)*insideBake*courseSpillStrength*(1.-hasMeshBake)*courseBakeEnabled;
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*spillLight;
          reflectedLight.indirectSpecular+=spillLight*.12*(1.-roughnessFactor);`
              : ""
          }
          }`,
        );
      });
    }
  });
  installGlobalIllumination(scene, bake.globalIllumination, bake.metadata.heightRange);
}
