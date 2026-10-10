import * as THREE from "../../vendor/three/three.module.js";
import { patchMaterial } from "./surface-detail.js";

export async function loadGlobalIllumination(metadata, base, loader) {
  if (!metadata) return null;
  const texture = async (file, height = false) => {
    const result = await loader.loadAsync(base + file);
    result.colorSpace = THREE.NoColorSpace;
    result.wrapS = result.wrapT = THREE.ClampToEdgeWrapping;
    if (height) {
      result.generateMipmaps = false;
      result.minFilter = result.magFilter = THREE.LinearFilter;
    }
    return result;
  };
  const [architecture, ground, groundHeight, temple, templeHeight, probes] = await Promise.all([
    texture(metadata.architecture.file),
    texture(metadata.ground.file),
    texture(metadata.ground.height, true),
    texture(metadata.temple.file),
    texture(metadata.temple.height, true),
    loadBakedProbes(base, metadata.probes),
  ]);
  return { metadata, architecture, ground, groundHeight, temple, templeHeight, probes };
}

async function loadBakedProbes(base, descriptor) {
  const response = await fetch(base + descriptor.metadata);
  if (!response.ok) throw new Error("Baked light probes could not load");
  const metadataBytes = await response.arrayBuffer();
  await verifyDigest(metadataBytes, descriptor.metadataSha256);
  const metadata = JSON.parse(new TextDecoder().decode(metadataBytes));
  const binaryResponse = await fetch(base + metadata.binary.file);
  if (!binaryResponse.ok) throw new Error("Baked light probe data could not load");
  const binary = await binaryResponse.arrayBuffer();
  if (
    binary.byteLength !== metadata.binary.bytes ||
    binary.byteLength !==
      metadata.stations.length * metadata.lanes.length * metadata.heights.length * 28 * 4
  )
    throw new Error("Baked light probe data has the wrong size");
  await verifyDigest(binary, metadata.binary.sha256);
  // DataView also supports big-endian hosts without assuming native byte order.
  const view = new DataView(binary);
  const coefficients = new Float32Array(binary.byteLength / 4);
  for (let i = 0; i < coefficients.length; i++) {
    coefficients[i] = view.getFloat32(i * 4, true);
    if (!Number.isFinite(coefficients[i])) throw new Error("Baked light probe data is not finite");
  }
  return { metadata, coefficients };
}

async function verifyDigest(bytes, expected) {
  if (!expected || !globalThis.crypto?.subtle) return;
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
  if ([...digest].map((v) => v.toString(16).padStart(2, "0")).join("") !== expected)
    throw new Error("Baked GI data digest mismatch");
}

/** Keep the darker of the static visibility and the moving sun shadow.
 * The shadow-casting sun sorts ahead of the unshadowed rim in Three's light list.
 */
export function installBakedSunVisibility(shader, expression) {
  const previous = "mix(1.,staticGi.a,giCoverage)";
  if (expression !== previous && shader.fragmentShader.includes(previous)) {
    shader.fragmentShader = shader.fragmentShader.replace(
      previous,
      `min(${previous},${expression})`,
    );
    return;
  }
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  const start = chunk.indexOf("#if ( NUM_DIR_LIGHTS");
  const end = chunk.indexOf("#if ( NUM_RECT_AREA_LIGHTS", start);
  const directional = chunk.slice(start, end).replace(
    "RE_Direct( directLight,",
    `#if UNROLLED_LOOP_INDEX == 0
      float liveSunVisibility=dot(directLight.color,vec3(1.))/max(.0001,dot(directionalLight.color,vec3(1.)));
      directLight.color=directionalLight.color*min(liveSunVisibility,${expression});
    #endif
    RE_Direct( directLight,`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_fragment_begin>",
    chunk.slice(0, start) + directional + chunk.slice(end),
  );
}

export function installGlobalIllumination(scene, bake, heightRange) {
  if (!bake) return;
  const { metadata } = bake;
  scene.userData.globalIllumination = metadata;
  scene.userData.bakedProbes = bake.probes;
  const uniforms = {
    giArchitecture: { value: bake.architecture },
    giGround: { value: bake.ground },
    giGroundHeight: { value: bake.groundHeight },
    giTemple: { value: bake.temple },
    giTempleHeight: { value: bake.templeHeight },
    giGroundBounds: { value: new THREE.Vector4(...metadata.ground.bounds) },
    giTempleBounds: { value: new THREE.Vector4(...metadata.temple.bounds) },
    giHeightRange: { value: new THREE.Vector2(...heightRange) },
    giScale: { value: metadata.scale },
    giEnabled: { value: 1 },
  };
  scene.userData.globalIlluminationUniforms = uniforms;
  scene.traverse((object) => {
    if (!object.isMesh || object.userData.skipBake) return;
    if (!object.userData.bakeReceiver && !object.geometry.attributes.surfaceLightUv) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material?.isMeshStandardMaterial || material.userData.waterUniforms) continue;
      material.defaultAttributeValues.surfaceLightUv = [0, 0, 0];
      patchMaterial(material, "cycles-static-gi-v1", (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = `attribute vec3 surfaceLightUv;varying vec3 vSurfaceLightUv;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvSurfaceLightUv=surfaceLightUv;",
        );
        shader.fragmentShader = `varying vec3 vSurfaceLightUv;
          uniform sampler2D giArchitecture,giGround,giGroundHeight,giTemple,giTempleHeight;
          uniform vec4 giGroundBounds,giTempleBounds;
          uniform vec2 giHeightRange;
          uniform float giScale,giEnabled;
          float giReceiverCoverage(vec2 uv,sampler2D heights,float receiverY){
            float inside=step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);
            float encoded=dot(texture2D(heights,uv).rg,vec2(256./257.,1./257.));
            float y=mix(giHeightRange.x,giHeightRange.y,encoded);
            return inside*(1.-smoothstep(.4,1.5,abs(receiverY-y)));
          }
          ${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_begin>",
          `vec4 staticGi=vec4(0.,0.,0.,1.);
          float giCoverage=0.;
          if(giEnabled>.5 && vSurfaceLightUv.z>.5){
            staticGi=texture2D(giArchitecture,vSurfaceLightUv.xy);
            giCoverage=1.;
          }else if(giEnabled>.5 && vCourseGroundBake>.5){
            vec2 templeUv=(vCourseBakeWorld.xz-giTempleBounds.xy)/giTempleBounds.zw;
            vec2 templeEdge=min(templeUv,1.-templeUv)*giTempleBounds.zw;
            if(min(templeEdge.x,templeEdge.y)>0.){
              giCoverage=giReceiverCoverage(templeUv,giTempleHeight,vCourseBakeWorld.y)*smoothstep(0.,3.,min(templeEdge.x,templeEdge.y));
              if(giCoverage>0.)staticGi=texture2D(giTemple,templeUv);
            }
            if(giCoverage<.999){
              vec2 groundUv=(vCourseBakeWorld.xz-giGroundBounds.xy)/giGroundBounds.zw;
              float groundCoverage=giReceiverCoverage(groundUv,giGroundHeight,vCourseBakeWorld.y);
              staticGi=mix(texture2D(giGround,groundUv),staticGi,giCoverage);
              giCoverage=max(giCoverage,groundCoverage);
            }
          }
          #include <lights_fragment_begin>`,
        );
        installBakedSunVisibility(shader, "mix(1.,staticGi.a,giCoverage)");
        shader.fragmentShader = shader.fragmentShader.replace(
          "if(hasMeshBake<.5){",
          "if(hasMeshBake<.5 && giCoverage<.999){",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <aomap_fragment>",
          `reflectedLight.indirectDiffuse=mix(reflectedLight.indirectDiffuse,material.diffuseColor*staticGi.rgb*giScale,giCoverage);
          #include <aomap_fragment>`,
        );
      });
    }
  });
}

/** Blend only adjacent route stations and in-road lanes, so neighboring roads
 * behind a wall cannot leak into this racer's lighting. No per-frame allocation.
 */
export function sampleBakedProbes(probes, t, lane, height, result) {
  const { stations } = probes.metadata;
  const heights = probes.metadata.heights || [1.3, 3.8];
  const perStation = heights.length * 3;
  t = ((t % 1) + 1) % 1;
  let low = 0,
    high = stations.length;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (stations[mid].t <= t) low = mid;
    else high = mid;
  }
  const next = (low + 1) % stations.length;
  const along = (t - stations[low].t) / ((next ? stations[next].t : 1) - stations[low].t);
  const lateral = THREE.MathUtils.clamp((lane + 0.65) / 0.65, 0, 2);
  const left = Math.min(1, Math.floor(lateral));
  const across = lateral - left;
  let bottom = 0;
  while (bottom < heights.length - 2 && height > heights[bottom + 1]) bottom++;
  const up = THREE.MathUtils.clamp(
    (height - heights[bottom]) / (heights[bottom + 1] - heights[bottom]),
    0,
    1,
  );
  result.fill(0);
  for (let station = 0; station < 2; station++)
    for (let level = 0; level < 2; level++)
      for (let side = 0; side < 2; side++) {
        const index =
          ((station ? next : low) * perStation + (bottom + level) * 3 + left + side) * 28;
        const weight =
          (station ? along : 1 - along) * (level ? up : 1 - up) * (side ? across : 1 - across);
        for (let coefficient = 0; coefficient < 28; coefficient++)
          result[coefficient] += probes.coefficients[index + coefficient] * weight;
      }
  return result;
}

export function updateRacerProbeLighting(kart, probes, t, lane, height) {
  if (!kart.userDataBakedGi) {
    const uniforms = {
      racerGi: { value: Array.from({ length: 9 }, () => new THREE.Vector3()) },
      racerSunVisibility: { value: 1 },
    };
    kart.userDataBakedGi = { uniforms, sample: new Float32Array(28) };
    for (const material of kart.litMaterials || []) {
      patchMaterial(material, "racer-baked-probes-v1", (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = `uniform vec3 racerGi[9];uniform float racerSunVisibility;
          vec3 racerIndirectAt(vec3 n){
            float x=n.x,y=n.y,z=n.z;
            return max(vec3(0.),racerGi[0]*.282095+racerGi[1]*(.488603*y)+racerGi[2]*(.488603*z)+racerGi[3]*(.488603*x)
              +racerGi[4]*(1.092548*x*y)+racerGi[5]*(1.092548*y*z)+racerGi[6]*(.315392*(3.*z*z-1.))
              +racerGi[7]*(1.092548*x*z)+racerGi[8]*(.546274*(x*x-y*y)));
          }
          ${shader.fragmentShader}`;
        installBakedSunVisibility(shader, "racerSunVisibility");
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <aomap_fragment>",
          `reflectedLight.indirectDiffuse=material.diffuseColor*racerIndirectAt(inverseTransformDirection(normal,viewMatrix));
          #include <aomap_fragment>`,
        );
      });
    }
  }
  const { uniforms, sample } = kart.userDataBakedGi;
  sampleBakedProbes(probes, t, lane, height, sample);
  for (let i = 0; i < 9; i++) uniforms.racerGi.value[i].fromArray(sample, i * 3);
  uniforms.racerSunVisibility.value = THREE.MathUtils.clamp(sample[27], 0, 1);
}

/** Only the authored solar mechanisms use this path, keeping frame work bounded. */
export function updateMovingProbeLighting(scene, probes, track) {
  if (!scene.userData.movingProbeReceivers) {
    const records = [];
    scene.traverse((root) => {
      if (root.userData.probeT == null) return;
      const materials = new Map();
      root.traverse((object) => {
        if (!object.isMesh) return;
        const replace = (material) => {
          if (!material?.isMeshStandardMaterial || material.userData.waterUniforms) return material;
          if (!materials.has(material)) {
            const clone = material.clone();
            clone.onBeforeCompile = material.onBeforeCompile;
            clone.customProgramCacheKey = material.customProgramCacheKey;
            clone.defaultAttributeValues = material.defaultAttributeValues;
            materials.set(material, clone);
          }
          return materials.get(material);
        };
        object.material = Array.isArray(object.material)
          ? object.material.map(replace)
          : replace(object.material);
      });
      records.push({
        root,
        t: root.userData.probeT,
        position: new THREE.Vector3(),
        litMaterials: [...materials.values()],
      });
    });
    scene.userData.movingProbeReceivers = records;
  }
  for (const record of scene.userData.movingProbeReceivers) {
    record.root.getWorldPosition(record.position);
    const surface = track.projectTrack(record.position, record.t * track.TRACK);
    record.t = surface.t;
    updateRacerProbeLighting(
      record,
      probes,
      surface.t,
      surface.offset / Math.max(1, track.roadHalfWidth(surface.t)),
      1.3 + Math.max(0, record.position.y - surface.height),
    );
  }
}
