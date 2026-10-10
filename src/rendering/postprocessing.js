import { RenderTarget } from "../../vendor/three/three.webgpu.js";
import * as THREE from "../../vendor/three/three.module.js";

const vertexShader = `varying vec2 vUv;void main(){vUv=vec2(uv.x,1.-uv.y);gl_Position=vec4(position.xy,0.,1.);}`;

/** HDR scene + quarter-size separable bloom. Low tier renders directly. */
export function createPostProcessing(renderer, theme = {}, wetReflections = null) {
  const target = new RenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const bloomA = new RenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  const bloomB = bloomA.clone();
  const fullscreen = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  fullscreen.add(quad);
  const extract = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: { source: { value: target.texture }, texel: { value: new THREE.Vector2() } },
    vertexShader,
    fragmentShader: `uniform sampler2D source;uniform vec2 texel;varying vec2 vUv;
      void main(){vec3 sum=vec3(0.);for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){
        vec3 c=texture2D(source,vUv+vec2(float(x),float(y))*texel).rgb;
        float l=max(c.r,max(c.g,c.b));sum+=c*max(l-1.05,0.)/max(l,.0001);}}
        gl_FragColor=vec4(sum/9.,1.);}`,
  });
  const blur = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: { source: { value: bloomA.texture }, direction: { value: new THREE.Vector2() } },
    vertexShader,
    fragmentShader: `uniform sampler2D source;uniform vec2 direction;varying vec2 vUv;
      void main(){vec3 c=texture2D(source,vUv).rgb*.227027;
        c+=(texture2D(source,vUv+direction*1.384615).rgb+texture2D(source,vUv-direction*1.384615).rgb)*.316216;
        c+=(texture2D(source,vUv+direction*3.230769).rgb+texture2D(source,vUv-direction*3.230769).rgb)*.070270;
        gl_FragColor=vec4(c,1.);}`,
  });
  const night = theme.night ?? theme.terrain === "concrete";
  const grade = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      source: { value: target.texture },
      bloom: { value: bloomA.texture },
      boostBlur: { value: 0 },
      waterImmersion: { value: 0 },
      waterTime: { value: 0 },
      bloomStrength: { value: night ? 0.18 : 0.08 },
      gradeTint: {
        value: new THREE.Vector3(
          ...(theme.gradeTint ??
            (theme.terrain === "snow"
              ? [0.98, 1, 1.025]
              : theme.terrain === "sand"
                ? [1.025, 1, 0.965]
                : night
                  ? [0.98, 1, 1.02]
                  : [1.015, 1.01, 0.99])),
        ),
      },
    },
    vertexShader,
    fragmentShader: `uniform sampler2D source,bloom;uniform float bloomStrength,boostBlur,waterImmersion,waterTime;uniform vec3 gradeTint;varying vec2 vUv;
      void main(){
        vec2 sampleUv=vUv;
        if(waterImmersion>.001){
          float crossing=4.*waterImmersion*(1.-waterImmersion);
          vec2 waterRipple=vec2(sin(vUv.y*28.+waterTime*1.7),sin(vUv.x*23.-waterTime*1.3));
          sampleUv=clamp(vUv+waterRipple*(waterImmersion*.00035+crossing*.002),vec2(.001),vec2(.999));
        }
        vec3 c=texture2D(source,sampleUv).rgb;
        // Four extra taps in the existing grade pass; no history or new targets.
        // The center stays sharp; Performance disables boost blur.
        if(boostBlur>.001){
          vec2 radial=vUv-vec2(.5,.54);
          float edge=smoothstep(.18,.6,length(radial));
          vec2 stepUv=radial*boostBlur*edge*.012;
          c=c*.4;
          for(int i=1;i<=4;i++) c+=texture2D(source,clamp(vUv-stepUv*float(i),vec2(0.),vec2(1.))).rgb*.15;
        }
        c+=texture2D(bloom,sampleUv).rgb*bloomStrength;
        c*=gradeTint*mix(vec3(1.),vec3(.9,1.,1.025),waterImmersion);gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  let quality = 3;
  let bloomEnabled = true;
  const size = new THREE.Vector2();
  let width = 0,
    height = 0;
  function draw(material, output) {
    quad.material = material;
    renderer.setRenderTarget(output);
    renderer.render(fullscreen, camera);
  }
  return {
    setWaterMedium(immersion, time) {
      grade.uniforms.waterImmersion.value = immersion;
      grade.uniforms.waterTime.value = time;
    },
    setBoostMotion(strength, kick) {
      grade.uniforms.boostBlur.value = strength + kick * 0.35;
    },
    setOptions(preferences) {
      bloomEnabled = preferences.bloom;
    },
    setQuality(tier) {
      quality = tier;
      wetReflections?.setQuality(tier);
    },
    render(scene, sceneCamera) {
      if (quality === 0) {
        renderer.render(scene, sceneCamera);
        return;
      }
      renderer.getDrawingBufferSize(size);
      if (size.x !== width || size.y !== height) {
        width = size.x;
        height = size.y;
        target.setSize(width, height);
        bloomA.setSize(Math.max(1, Math.ceil(width / 4)), Math.max(1, Math.ceil(height / 4)));
        bloomB.setSize(bloomA.width, bloomA.height);
        extract.uniforms.texel.value.set(1 / width, 1 / height);
      }
      const toneMapping = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping;
      wetReflections?.render(renderer, scene, sceneCamera);
      renderer.setRenderTarget(target);
      renderer.render(scene, sceneCamera);
      if (quality >= 2 && bloomEnabled) {
        draw(extract, bloomA);
        blur.uniforms.source.value = bloomA.texture;
        blur.uniforms.direction.value.set(1 / bloomA.width, 0);
        draw(blur, bloomB);
        blur.uniforms.source.value = bloomB.texture;
        blur.uniforms.direction.value.set(0, 1 / bloomA.height);
        draw(blur, bloomA);
      }
      grade.uniforms.bloomStrength.value = quality >= 2 && bloomEnabled ? (night ? 0.18 : 0.08) : 0;
      renderer.toneMapping = toneMapping;
      draw(grade, null);
    },
    dispose() {
      wetReflections?.dispose();
      target.dispose();
      bloomA.dispose();
      bloomB.dispose();
      extract.dispose();
      blur.dispose();
      grade.dispose();
      quad.geometry.dispose();
    },
  };
}
