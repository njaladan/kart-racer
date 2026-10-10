import { patchMaterial } from "../../rendering/surface-detail.js";

/** Distant heat refraction and low haze, in the existing material pass on every tier. */
export function createDesertAtmosphere(THREE, theme) {
  const clock = { value: 0 };
  const tint = { value: new THREE.Color(theme.fog) };
  function apply(material) {
    return patchMaterial(material, "desert-mirage-v1", (shader) => {
      shader.uniforms.mirageTime = clock;
      shader.uniforms.mirageTint = tint;
      shader.vertexShader = `uniform float mirageTime;varying float vMirageDistance,vMirageBand;\n${shader.vertexShader}`;
      shader.fragmentShader = `uniform vec3 mirageTint;varying float vMirageDistance,vMirageBand;\n${shader.fragmentShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vMirageDistance=length(mvPosition.xyz);
        vMirageBand=1.-smoothstep(.025,.16,abs(mvPosition.y)/max(vMirageDistance,1.));
        float mirageFade=smoothstep(170.,480.,vMirageDistance)*vMirageBand;
        float wave=sin(mvPosition.y*1.7+mirageTime*1.8+mvPosition.x*.12);
        wave+=sin(mvPosition.y*3.8-mirageTime*2.3+vMirageDistance*.035)*.35;
        gl_Position.xy+=vec2(wave*.35,wave)*gl_Position.w*mirageFade*.0011;`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `float desertVeil=(1.-exp(-vMirageDistance*.0012))*(.12+vMirageBand*.2);
        outgoingLight=mix(outgoingLight,mirageTint,desertVeil);
        #include <opaque_fragment>`,
      );
    });
  }
  return {
    apply,
    clock,
    update: (time, state) => (clock.value = state?.motionEnabled === false ? 0 : time),
  };
}

/** Thin, broken blue glints suggest illusory water between the far dune ridges. */
export function createMiragePool(THREE, clock) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { mirageTime: clock, mirageColor: { value: new THREE.Color("#b0cbd2") } },
    vertexShader: `varying vec2 vUv;varying float vDistance;
      void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);
        vDistance=length(p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float mirageTime;uniform vec3 mirageColor;varying vec2 vUv;varying float vDistance;
      void main(){
        vec2 p=vUv*2.-1.;float edge=1.-smoothstep(.3,1.,dot(p,p));
        float ribbon=.45+.55*sin(vUv.y*110.+sin(vUv.x*17.+mirageTime*.7)*2.-mirageTime*1.3);
        float farFade=smoothstep(170.,350.,vDistance)*(1.-smoothstep(650.,1200.,vDistance));
        gl_FragColor=vec4(mirageColor,edge*ribbon*farFade*.14);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
