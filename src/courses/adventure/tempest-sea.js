import * as THREE from "../../../vendor/three/three.module.js";
import { patchMaterial } from "../../rendering/surface-detail.js";
import { STORM_SEA_LEVEL, STORM_WAVES, stormWaveGLSL } from "./tempest-waves.js";
import { createStormDetailTexture, createStormCoastTexture } from "./tempest-sea-textures.js";

/** Dense over the playable coast, coarser beyond it; immutable GPU-displaced grid. */
export function createStormSeaGeometry(segments = 192) {
  const geometry = new THREE.PlaneGeometry(1700, 1700, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const coordinate = (v) => {
    const u = Math.abs(v) / 850;
    return Math.sign(v) * (u <= 5 / 6 ? u * 576 : 480 + ((u - 5 / 6) * 6) ** 1.6 * 370);
  };
  for (let i = 0; i < position.count; i++)
    position.setXYZ(i, coordinate(position.getX(i)), 0, coordinate(position.getZ(i)));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const height = STORM_WAVES.reduce((sum, w) => sum + w.amplitude, 0);
  const lateral = STORM_WAVES.reduce((sum, w) => sum + w.steepness / w.k, 0);
  geometry.boundingSphere.radius += Math.hypot(height, lateral);
  geometry.boundingBox.min.addScalar(-lateral);
  geometry.boundingBox.max.addScalar(lateral);
  return geometry;
}

/** One opaque PBR draw, no scene captures, transparent foam cards or frame history. */
export function createStormSea(scene) {
  const coast = createStormCoastTexture(),
    detail = createStormDetailTexture();
  const uniforms = {
    stormTime: { value: 0 },
    stormDetail: { value: detail },
    stormCoast: { value: coast.texture },
    stormFoamColor: { value: new THREE.Color("#c5e5df") },
    stormCrestColor: { value: new THREE.Color("#3d8b92") },
  };
  const material = new THREE.MeshStandardMaterial({
    color: "#275c70",
    roughness: 0.24,
    metalness: 0,
    envMap: scene.environment || null,
    envMapIntensity: 1.05,
    side: THREE.DoubleSide,
  });
  material.name = "Tempest wind sea with crest and coastal foam";
  material.userData.waterUniforms = uniforms;
  material.addEventListener("dispose", () => {
    detail.dispose();
    coast.texture.dispose();
  });
  patchMaterial(material, "tempest-gerstner-sea-v1", (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `${stormWaveGLSL()}
      varying vec2 vStormBase; varying vec3 vStormWorld; varying vec3 vStormSurface;
      ${shader.vertexShader}`
      .replace(
        "#include <beginnormal_vertex>",
        `
      vec3 stormDisplacement, stormTx, stormTz; vec2 stormCompression;
      stormSurface(position.xz,stormDisplacement,stormTx,stormTz,stormCompression);
      vec3 objectNormal=normalize(cross(stormTz,stormTx));
      vStormBase=position.xz;
      vStormSurface=vec3(stormCompression,stormDisplacement.y);`,
      )
      .replace("#include <begin_vertex>", "vec3 transformed=position+stormDisplacement;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vStormWorld=(modelMatrix*vec4(transformed,1.)).xyz;`,
      );
    shader.fragmentShader = `uniform float stormTime;
      uniform sampler2D stormDetail,stormCoast; uniform vec3 stormFoamColor,stormCrestColor;
      varying vec2 vStormBase; varying vec3 vStormWorld; varying vec3 vStormSurface;
      ${shader.fragmentShader}`
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      vec2 drift=vec2(.6,-.8)*stormTime;
      vec4 seaA=texture2D(stormDetail,(vStormBase-drift*.55)*vec2(.018,.026));
      mat2 seaRotation=mat2(.8,-.6,.6,.8);
      vec4 seaB=texture2D(stormDetail,seaRotation*(vStormBase-drift*.83)*.039);
      float seaDistance=length(vStormWorld-cameraPosition);
      float seaNear=1.-smoothstep(90.,380.,seaDistance);
      float compression=min(vStormSurface.x,vStormSurface.y+.065);
      float breaker=1.-smoothstep(.42,.76,compression);
      float foamPatch=smoothstep(.27,.72,seaA.b*.65+seaB.b*.35);
      float coastDistance=texture2D(stormCoast,vStormWorld.xz/1700.+.5).r*48.-16.;
      float surge=.5+.5*sin(coastDistance*.55-stormTime*1.4+seaA.b*4.);
      float shore=(1.-smoothstep(1.5,13.,max(0.,coastDistance)+seaA.b*3.))*(.45+.55*surge);
      float foamCoverage=clamp(breaker*foamPatch*.85+shore*(.4+.6*foamPatch),0.,1.);
      float bubbles=texture2D(stormDetail,(vStormBase-drift*.28)*.085).a;
      // Sparse bubble walls merge into dense froth as coverage rises.
      float foamGrain=mix(.82,smoothstep(.38-foamCoverage*.3,.72-foamCoverage*.35,bubbles),seaNear);
      float seaFoam=clamp(foamCoverage*1.5,0.,1.)*foamGrain;
      float crestLight=smoothstep(-1.,5.,vStormSurface.z)*.26*(1.-seaFoam);
      diffuseColor.rgb=mix(diffuseColor.rgb,stormCrestColor,crestLight);
      diffuseColor.rgb=mix(diffuseColor.rgb,stormFoamColor,seaFoam);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor=mix(mix(.36,.24,seaNear),.86,seaFoam);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec2 ripple=(seaA.rg*2.-1.)*.24+seaRotation*(seaB.rg*2.-1.)*.13;
        normal=normalize(normal+mat3(viewMatrix)*vec3(-ripple.x,0.,-ripple.y)*
          mix(.22,1.,seaNear)*(1.-seaFoam*.85));`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
        // Water's normal-incidence reflectance is ~2%; foam becomes rough diffuse bubbles.
        material.specularColor*=.5*(1.-seaFoam*.85);`,
      );
  });
  const ocean = new THREE.Mesh(createStormSeaGeometry(), material);
  ocean.name = "Tempest Atlantic wind sea";
  ocean.position.y = STORM_SEA_LEVEL;
  ocean.castShadow = false;
  ocean.receiveShadow = true;
  ocean.userData.skipBake = true;
  ocean.onBeforeRender = () => coast.update();
  let tier = 2;
  return {
    ocean,
    addShore: coast.addShore,
    update(seconds) {
      uniforms.stormTime.value = seconds;
    },
    setQuality(value) {
      const next = value === 0 ? 0 : 2;
      if (next === tier) return;
      tier = next;
      ocean.geometry.dispose();
      ocean.geometry = createStormSeaGeometry(tier === 0 ? 128 : 192);
    },
  };
}
