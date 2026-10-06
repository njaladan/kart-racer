import { patchMaterial } from "../../rendering/surface-detail.js";

/** Analytic shallow caustics stay aligned across merged/instanced scenery and road. */
export function marineCaustics(material, scene) {
  patchMaterial(material, "underwater-caustics", (shader) => {
    const clock = { value: 0 };
    (scene.userData.surfaceAnimations ||= []).push(clock);
    shader.uniforms.waterClock = clock;
    shader.vertexShader = `varying vec3 vReef;\n${shader.vertexShader}`.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\nvec4 reefWorld=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nreefWorld=instanceMatrix*reefWorld;\n#endif\nvReef=(modelMatrix*reefWorld).xyz;",
    );
    shader.fragmentShader =
      `uniform float waterClock; varying vec3 vReef;\n${shader.fragmentShader}`.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float a=sin(vReef.x*.42+sin(vReef.z*.33+waterClock*.8));
      float b=sin(vReef.z*.48+sin(vReef.x*.37-waterClock*.55));
      float light=pow(clamp(1.-abs(a+b)*.6,0.,1.),7.);
      diffuseColor.rgb*=1.+light*.24*(1.-smoothstep(-1.,3.,vReef.y));`,
      );
  });
}

/** Pale glazed road tiles maintain a crisp line through the moving reef light. */
export function glasshouseRoad(material, scene) {
  marineCaustics(material, scene);
  patchMaterial(material, "glasshouse-ceramic", (shader) => {
    shader.vertexShader = `varying vec2 vCeramic;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvCeramic=uv;",
    );
    shader.fragmentShader = `varying vec2 vCeramic;\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec2 tile=vCeramic*vec2(2.,1.);
      vec2 edge=min(fract(tile),1.-fract(tile));
      float seam=smoothstep(.008,.023+max(fwidth(tile.x),fwidth(tile.y)),min(edge.x,edge.y));
      diffuseColor.rgb*=mix(.64,1.,seam);`,
    );
  });
}
