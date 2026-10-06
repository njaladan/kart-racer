import { patchMaterial } from "./surface-detail.js";

const PROFILES = {
  "windmill-wilds": "canopy",
  "neon-harbor": "rain",
  "sunstone-ruins": "sand",
  "frostpeak-festival": "ice",
  "clockwork-citadel": "metal",
  "paper-revel": "paper",
  "tempest-causeway": "rain",
  "pocket-pantry": "warm",
  "railstorm-express": "dew",
  "metronome-hall": "beat",
  "pelagic-glasshouse": "caustic",
  "emberwing-observatory": "ember",
};

/** Subtle weather/light movement composes with scans, normals and the existing bake. */
export function installEnvironmentSurfaceMotion(material, courseId, clock) {
  if (!material?.isMeshStandardMaterial) return material;
  const profile = PROFILES[courseId];
  return patchMaterial(material, `environment-surface-${profile}-v1`, (shader) => {
    shader.uniforms.environmentClock = clock;
    shader.vertexShader = `varying vec3 vEnvironmentWorld;\n${shader.vertexShader}`.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
      vec4 environmentPosition=vec4(transformed,1.);
      #ifdef USE_BATCHING
        environmentPosition=batchingMatrix*environmentPosition;
      #endif
      #ifdef USE_INSTANCING
        environmentPosition=instanceMatrix*environmentPosition;
      #endif
      vEnvironmentWorld=(modelMatrix*environmentPosition).xyz;`,
    );
    shader.fragmentShader = `varying vec3 vEnvironmentWorld;uniform float environmentClock;
      float environmentHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      ${shader.fragmentShader}`;
    const patterns = {
      canopy: `float canopy=sin(ep.x*.19+sin(ep.y*.13)+et*.08)*sin(ep.y*.16-et*.06);
        diffuseColor.rgb*=.965+canopy*.035;`,
      rain: `vec2 rainCell=floor(ep*.8),rainUv=fract(ep*.8);
        float rainSeed=environmentHash(rainCell),rainAge=fract(et*.65+rainSeed);
        vec2 rainCenter=vec2(environmentHash(rainCell+7.),environmentHash(rainCell+13.))*.6+.2;
        float rainRadius=length(rainUv-rainCenter);
        float rainWave=sin((rainRadius-rainAge*.48)*80.)*
          exp(-abs(rainRadius-rainAge*.48)*35.)*(1.-rainAge);
        environmentRelief=rainWave*.008;
        environmentShine=rainWave*.025;`,
      sand: `float sandVeil=sin(ep.x*.45+sin(ep.y*.16)-et*.28)*sin(ep.y*.7+et*.11);
        diffuseColor.rgb*=1.+sandVeil*.014;`,
      ice: `float iceSeed=environmentHash(floor(ep*13.));
        environmentShine=pow(max(0.,sin(et*.8+iceSeed*20.)),12.)*step(.985,iceSeed)*.35;`,
      metal: `float oilSheen=sin(ep.x*.08+ep.y*.05+et*.08);
        diffuseColor.rgb*=vec3(1.+oilSheen*.012,1.,1.-oilSheen*.01);`,
      paper: `float fiber=sin(ep.x*24.)*sin(ep.y*19.);
        float lanternShade=sin(ep.x*.13+et*.09)*sin(ep.y*.15-et*.08);
        diffuseColor.rgb*=.987+lanternShade*.013+fiber*.004;`,
      warm: `float windowShade=sin(ep.x*.07+et*.025)*sin(ep.y*.12+et*.02);
        diffuseColor.rgb*=.984+windowShade*.016;`,
      dew: `float dewSeed=environmentHash(floor(ep*5.));
        environmentShine=step(.99,dewSeed)*pow(max(0.,sin(et*.45+dewSeed*30.)),8.)*.17;`,
      beat: `float beatPhase=et*3.14159265;
        float brassSweep=pow(max(0.,sin(ep.x*.11+ep.y*.07-beatPhase)),10.);
        environmentShine=brassSweep*.025;`,
      caustic: `float caustic=sin(ep.x*.6+sin(ep.y*.3+et*.2))*sin(ep.y*.5-et*.32);
        diffuseColor.rgb*=1.+pow(abs(caustic),8.)*.045;`,
      ember: `float lavaShimmer=sin(ep.x*.14+et*.25)*sin(ep.y*.18-et*.17);
        diffuseColor.rgb*=vec3(1.+max(0.,lavaShimmer)*.025,1.,1.);`,
    };
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
        vec2 ep=vEnvironmentWorld.xz;float et=environmentClock;
        float environmentRelief=0.,environmentShine=0.;
        ${patterns[profile]}`,
    );
    if (profile === "rain")
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 erDx=dFdx(-vViewPosition),erDy=dFdy(-vViewPosition);
        vec3 erRx=cross(erDy,normal),erRy=cross(normal,erDx);
        float erDet=dot(erDx,erRx);
        normal=normalize(abs(erDet)*normal-sign(erDet)*
          (dFdx(environmentRelief)*erRx+dFdy(environmentRelief)*erRy));`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor-environmentShine,.09,1.);",
    );
  });
}
