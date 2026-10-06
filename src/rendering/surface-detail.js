import * as THREE from "../../vendor/three/three.module.js";

/** Compose material modifications, preserving existing bake and wind hooks. */
export function patchMaterial(material, key, patch) {
  if (material.userData[key]) return material;
  material.userData[key] = true;
  const previous = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey.bind(material);
  const priorKey = cacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    patch(shader);
  };
  material.customProgramCacheKey = () => `${priorKey}|${key}`;
  material.needsUpdate = true;
  return material;
}

function addWorldPosition(shader, name) {
  shader.vertexShader = `varying vec3 ${name};\n${shader.vertexShader}`;
  shader.fragmentShader = `varying vec3 ${name};\n${shader.fragmentShader}`;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <worldpos_vertex>",
    `#include <worldpos_vertex>
    vec4 ${name}Position = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
      ${name}Position = batchingMatrix * ${name}Position;
    #endif
    #ifdef USE_INSTANCING
      ${name}Position = instanceMatrix * ${name}Position;
    #endif
    ${name} = (modelMatrix * ${name}Position).xyz;`,
  );
}

/** Broad world-space breakup survives tile UVs, instancing and regional merging. */
export function installSurfaceDetail(
  material,
  { kind = "terrain", scale = 0.055, strength = 0.12, edgeColor = null, edgeWidth = 0 } = {},
) {
  if (!material?.isMeshStandardMaterial) return material;
  const uniforms = {
    detailScale: { value: scale },
    detailStrength: { value: strength },
    detailEdgeColor: { value: new THREE.Color(edgeColor || material.color) },
    detailEdgeWidth: { value: edgeWidth },
  };
  return patchMaterial(material, `surface-detail-${kind}-v2`, (shader) => {
    Object.assign(shader.uniforms, uniforms);
    addWorldPosition(shader, "vSurfaceWorld");
    shader.fragmentShader = `uniform float detailScale,detailStrength,detailEdgeWidth;
      uniform vec3 detailEdgeColor;
      float surfaceHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float surfaceNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(surfaceHash(i),surfaceHash(i+vec2(1.,0.)),f.x),
          mix(surfaceHash(i+vec2(0.,1.)),surfaceHash(i+vec2(1.)),f.x),f.y);}
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float macro=surfaceNoise(vSurfaceWorld.xz*detailScale)*.65+
        surfaceNoise(vSurfaceWorld.xz*detailScale*3.7)*.35;
      diffuseColor.rgb*=1.+(macro-.5)*detailStrength*2.;
      ${kind === "road" ? "float wear=surfaceNoise(vSurfaceWorld.xz*.18);diffuseColor.rgb*=mix(.92,1.04,wear);" : ""}
      ${kind === "ice" ? "diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.82,.95,1.05),macro*.3);" : ""}
      if(detailEdgeWidth>0.)diffuseColor.rgb=mix(diffuseColor.rgb,detailEdgeColor,
        (1.-smoothstep(0.,detailEdgeWidth,abs(vSurfaceWorld.y)))*.18);`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(macro-.5)*.09,.08,1.);",
    );
  });
}

/** Two flowing normal layers, physical Fresnel and foam in a single opaque draw. */
export function createWaterMaterial({
  scene,
  color = "#278caa",
  normalMap = null,
  environment = null,
  roughness = 0.2,
  foam = true,
  flow = 0.035,
  shoreRadius = 0,
  opacity = 1,
} = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    envMap: environment || scene?.environment || null,
    envMapIntensity: 0.8,
    normalMap,
    normalScale: new THREE.Vector2(0.26, 0.26),
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    side: THREE.DoubleSide,
  });
  material.name = "Flowing Fresnel water with shoreline foam";
  const uniforms = {
    waterTime: { value: 0 },
    waterFlow: { value: flow },
    waterRadius: { value: shoreRadius },
  };
  if (scene) (scene.userData.surfaceAnimations ||= []).push(uniforms.waterTime);
  patchMaterial(material, "water-two-layer-v2", (shader) => {
    Object.assign(shader.uniforms, uniforms);
    addWorldPosition(shader, "vWaterWorld");
    shader.vertexShader = `varying vec2 vWaterLocal;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvWaterLocal=position.xy;",
    );
    shader.fragmentShader = `varying vec2 vWaterLocal;uniform float waterTime,waterFlow,waterRadius;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      vec2 waveP=vWaterWorld.xz*.34;
      float wt=waterTime*waterFlow;
      vec2 ripple=vec2(cos(waveP.x*1.7+waveP.y*.8+wt*8.),sin(waveP.y*2.1-waveP.x*.6-wt*6.))*.055;
      ripple+=vec2(sin(waveP.y*3.8+waveP.x-wt*4.),cos(waveP.x*3.2-waveP.y+wt*5.))*.028;
      #ifdef USE_NORMALMAP_TANGENTSPACE
        vec3 waveA=texture2D(normalMap,vNormalMapUv+vec2(wt,wt*.42)).xyz*2.-1.;
        vec3 waveB=texture2D(normalMap,vNormalMapUv*1.83+vec2(-wt*.63,wt*.71)).xyz*2.-1.;
        normal=normalize(tbn*normalize(vec3((waveA.xy+waveB.xy)*normalScale,1.)));
      #endif
      normal=normalize(normal+mat3(viewMatrix)*vec3(ripple.x,0.,ripple.y));`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_physical_fragment>",
      `// Run after normal setup and before physical lighting consumes the tint.
      // The standard material already samples the PMREM environment with a
      // dielectric Fresnel term. A small angle-dependent tint makes that edge
      // response legible even when the probe is mostly sky or a flat horizon.
      float waterFresnel=.02+.72*pow(1.-clamp(abs(dot(normalize(normal),normalize(vViewPosition))),0.,1.),5.);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.58,.83,.9),waterFresnel*.24);
      ${
        foam
          ? `float shore=waterRadius>0.?smoothstep(waterRadius*.86,waterRadius*.985,length(vWaterLocal)):0.;
        float crest=sin(vWaterWorld.x*.75+vWaterWorld.z*.93-waterTime*.8)*.5+.5;
        float foamMask=shore*(.35+.65*smoothstep(.42,.78,crest));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.86,.85),foamMask*.6);
        roughnessFactor=mix(roughnessFactor,.72,foamMask);`
          : ""
      }
      #include <lights_physical_fragment>`,
    );
  });
  return material;
}

export function advanceSurfaceDetails(scene, time) {
  for (const uniform of scene.userData.surfaceAnimations || []) uniform.value = time;
}

/** A light height haze supplements ordinary distance fog; no volume ray march. */
export function installHeightHaze(material, theme = {}) {
  if (!material?.isMeshStandardMaterial) return;
  patchMaterial(material, "height-haze-v1", (shader) => {
    addWorldPosition(shader, "vHazeWorld");
    shader.uniforms.hazeTint = { value: new THREE.Color(theme.fog || "#b8d8de") };
    shader.uniforms.hazeStrength = { value: theme.terrain === "sand" ? 0.24 : 0.15 };
    shader.fragmentShader = `uniform vec3 hazeTint;uniform float hazeStrength;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      float hazeDistance=length(vHazeWorld-cameraPosition);
      float groundHaze=exp(-max(vHazeWorld.y,0.)*.028);
      float hazeAmount=(1.-exp(-hazeDistance*.0015))*groundHaze*hazeStrength;
      outgoingLight=mix(outgoingLight,hazeTint,hazeAmount);
      #include <opaque_fragment>`,
    );
  });
}

/** Gentle foliage/cloth sway uses the race clock and adds no per-frame geometry work. */
export function installFoliageWind(scene, material, { strength = 0.045 } = {}) {
  if (!material?.isMeshStandardMaterial) return;
  const time = { value: 0 };
  (scene.userData.surfaceAnimations ||= []).push(time);
  patchMaterial(material, "foliage-wind-v1", (shader) => {
    shader.uniforms.foliageTime = time;
    shader.uniforms.foliageStrength = { value: strength };
    shader.vertexShader = `uniform float foliageTime,foliageStrength;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec4 foliageWorld=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        foliageWorld=instanceMatrix*foliageWorld;
      #endif
      foliageWorld=modelMatrix*foliageWorld;
      float foliageWave=sin(foliageWorld.x*.16+foliageWorld.z*.11+foliageTime*1.45);
      float foliageAnchor=smoothstep(0.,1.5,max(0.,position.y));
      transformed.x+=foliageWave*foliageStrength*foliageAnchor;
      transformed.z+=cos(foliageWorld.z*.15+foliageTime*.9)*foliageStrength*.45*foliageAnchor;`,
    );
  });
}
