import * as THREE from "../../vendor/three/three.module.js";

/** Depth confines strong heat refraction and a faint reflected ribbon to distant scenery. */
export const DESERT_MIRAGE_GLSL = `
#ifdef USE_DESERT_MIRAGE
uniform sampler2D mirageDepth;
uniform vec2 mirageViewRange,mirageRange,mirageTexel;
uniform mat4 mirageInverseProjection,mirageCameraWorld;
uniform float mirageTime,mirageMotion,mirageStrength,mirageHorizon;
uniform vec3 mirageTint;
#include <packing>
float mirageDistance(vec2 uv){
  return -perspectiveDepthToViewZ(texture2D(mirageDepth,uv).x,mirageViewRange.x,mirageViewRange.y);
}
vec3 mirageRay(vec2 uv){
  vec4 view=mirageInverseProjection*vec4(uv*2.-1.,1.,1.);
  return normalize(mat3(mirageCameraWorld)*(view.xyz/view.w));
}
float mirageAmountAt(vec2 uv){
  float distanceFade=smoothstep(mirageRange.x,mirageRange.y,mirageDistance(uv));
  float horizonBand=1.-smoothstep(.06,.34,abs(mirageRay(uv).y));
  return distanceFade*horizonBand*mirageStrength;
}
vec2 refractDesert(vec2 uv,float amount){
  float broad=sin(uv.y*135.+sin(uv.x*19.+mirageTime*.6)*2.-mirageTime*2.1);
  float fine=sin(uv.y*410.+uv.x*37.-mirageTime*3.3);
  vec2 offset=vec2(broad*.01, broad*.02+fine*.005)*amount*mirageMotion;
  vec2 warped=clamp(uv+offset,vec2(.001),vec2(.999));
  // A far pixel must never drag a nearby kart, wall or road edge into the haze.
  return mix(uv,warped,smoothstep(mirageRange.x*.75,mirageRange.x,mirageDistance(warped)));
}
vec3 desertMirageColor(vec3 color,vec2 uv,float amount){
  if(amount<.001)return color;
  vec2 smear=vec2(max(mirageTexel.x*2.,.0045),mirageTexel.y*.7)*amount;
  vec3 soft=color*.4;
  for(int i=1;i<=2;i++){
    vec2 delta=smear*float(i);
    vec2 a=clamp(uv+delta,vec2(.001),vec2(.999));
    vec2 b=clamp(uv-delta,vec2(.001),vec2(.999));
    soft+=mix(color,texture2D(source,a).rgb,step(mirageRange.x,mirageDistance(a)))*.15;
    soft+=mix(color,texture2D(source,b).rgb,step(mirageRange.x,mirageDistance(b)))*.15;
  }
  color=mix(color,soft,amount*.35);
  float below=step(vUv.y,mirageHorizon);
  float groundBand=1.-smoothstep(.025,.17,abs(mirageRay(vUv).y));
  float ribbon=.65+.35*sin(vUv.y*270.+sin(vUv.x*23.+mirageTime*.8)*2.);
  vec2 reflectionUv=clamp(vec2(uv.x,mirageHorizon*2.-uv.y),vec2(.001),vec2(.999));
  vec3 reflection=texture2D(source,reflectionUv).rgb;
  reflection=mix(mirageTint,reflection,step(mirageRange.x,mirageDistance(reflectionUv)));
  color=mix(color,reflection,below*groundBand*amount*ribbon*.12);
  color=mix(color,mirageTint,amount*.025+pow(amount,4.)*.025);
  return color;
}
#endif
`;

export function createDesertMirage(theme = {}) {
  const settings = theme.desertMirage;
  const uniforms = {
    mirageDepth: { value: null },
    mirageViewRange: { value: new THREE.Vector2(0.1, 1400) },
    mirageRange: { value: new THREE.Vector2(settings?.start ?? 180, settings?.end ?? 700) },
    mirageTexel: { value: new THREE.Vector2() },
    mirageInverseProjection: { value: new THREE.Matrix4() },
    mirageCameraWorld: { value: new THREE.Matrix4() },
    mirageTime: { value: 0 },
    mirageMotion: { value: 1 },
    mirageStrength: { value: settings?.strength ?? 0 },
    mirageHorizon: { value: 0.5 },
    mirageTint: { value: new THREE.Color(theme.fog ?? "#e3d8c3") },
  };
  const direction = new THREE.Vector3(),
    point = new THREE.Vector3();
  return {
    enabled: !!settings,
    uniforms,
    update(time, motionEnabled = true, outdoors = true) {
      uniforms.mirageTime.value = motionEnabled ? time : 0;
      uniforms.mirageMotion.value = Number(motionEnabled);
      uniforms.mirageStrength.value = outdoors ? (settings?.strength ?? 0) : 0;
    },
    updateCamera(camera) {
      camera.updateMatrixWorld();
      uniforms.mirageViewRange.value.set(camera.near, camera.far);
      uniforms.mirageInverseProjection.value.copy(camera.projectionMatrixInverse);
      uniforms.mirageCameraWorld.value.copy(camera.matrixWorld);
      camera.getWorldDirection(direction).setY(0).normalize();
      point.copy(camera.position).add(direction).project(camera);
      uniforms.mirageHorizon.value = point.y * 0.5 + 0.5;
    },
    bindDepth(texture, width, height) {
      uniforms.mirageDepth.value = texture;
      uniforms.mirageTexel.value.set(1 / width, 1 / height);
    },
  };
}
