import * as THREE from "../../vendor/three/three.module.js";
import { GRAPHICS_TIERS } from "./graphics-quality.js";
import { sceneryGroundHeight } from "./terrain-height.js";

export const PARTICLE_SHAPES = Object.freeze({
  mote: 0,
  petal: 1,
  leaf: 2,
  flake: 3,
  streak: 4,
  smoke: 5,
  bubble: 6,
  spark: 7,
  confetti: 8,
  ripple: 9,
  spray: 10,
  firefly: 11,
});
export const PARTICLE_MOTIONS = Object.freeze({ drift: 0, fall: 1, rise: 2, splash: 3, ripple: 4 });

/** Static instance data, analytic race-clock movement and one draw per local field. */
export function createEnvironmentParticleField(track, spec, seed = 1, source = null) {
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const count = spec.count ?? 64,
    bases = [],
    seeds = [],
    rights = [],
    forwards = [],
    colors = [],
    bounds = new THREE.Box3(),
    color = new THREE.Color(spec.color);
  const t = track.sectorT(spec.section, spec.fraction ?? 0.5),
    origin = source
      ? new THREE.Vector3(...(spec.sourcePosition ?? [0, 0, 0]))
      : track.poseAt(t * track.TRACK, spec.offset ?? 0, 0).p;
  for (let i = 0; i < count; i++) {
    const at = t + ((random() - 0.5) * (spec.span ?? 50)) / track.COURSE_LENGTH,
      offset = (spec.offset ?? 0) + (random() - 0.5) * (spec.width ?? 24),
      pose = track.poseAt(at * track.TRACK, offset, spec.above ?? 0.12),
      tint = color.clone();
    if (spec.terrain)
      pose.p.y = sceneryGroundHeight(track.projectTrack(pose.p, 0, true)) + (spec.above ?? 0.12);
    if (spec.absoluteHeight != null) pose.p.y = spec.absoluteHeight;
    const local = source
      ? new THREE.Vector3(
          (random() - 0.5) * (spec.width ?? 2),
          0,
          (random() - 0.5) * (spec.span ?? 4),
        )
      : pose.p.clone().sub(origin);
    bounds.expandByPoint(local);
    bases.push(...local.toArray());
    rights.push(
      ...(source || spec.terrain || spec.absoluteHeight != null ? [1, 0, 0] : pose.right.toArray()),
    );
    forwards.push(
      ...(source || spec.terrain || spec.absoluteHeight != null
        ? [0, 0, 1]
        : pose.tangent.toArray()),
    );
    seeds.push(random(), random(), random(), random());
    tint.offsetHSL((random() - 0.5) * (spec.multicolor ? 0.6 : 0.035), 0, (random() - 0.5) * 0.09);
    if (spec.additive) tint.multiplyScalar(spec.intensity ?? 1.7);
    colors.push(...tint.toArray());
  }
  const height = spec.height ?? 12,
    wind = spec.wind ?? [2, 0, 0.6],
    size = spec.size ?? [0.18, 0.18],
    sizeMargin = Math.max(...size) * 3;
  bounds.min.add(
    new THREE.Vector3(
      -Math.abs(wind[0]) - 3 - sizeMargin,
      -sizeMargin,
      -Math.abs(wind[2]) - 3 - sizeMargin,
    ),
  );
  bounds.max.add(
    new THREE.Vector3(
      Math.abs(wind[0]) + 3 + sizeMargin,
      height + sizeMargin,
      Math.abs(wind[2]) + 3 + sizeMargin,
    ),
  );
  const plane = new THREE.PlaneGeometry(2, 2),
    geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  for (const [name, attribute] of Object.entries(plane.attributes))
    geometry.setAttribute(name, attribute);
  geometry.setAttribute(
    "particleBase",
    new THREE.InstancedBufferAttribute(new Float32Array(bases), 3),
  );
  geometry.setAttribute(
    "particleSeed",
    new THREE.InstancedBufferAttribute(new Float32Array(seeds), 4),
  );
  geometry.setAttribute(
    "particleRight",
    new THREE.InstancedBufferAttribute(new Float32Array(rights), 3),
  );
  geometry.setAttribute(
    "particleForward",
    new THREE.InstancedBufferAttribute(new Float32Array(forwards), 3),
  );
  geometry.setAttribute(
    "particleTint",
    new THREE.InstancedBufferAttribute(new Float32Array(colors), 3),
  );
  geometry.boundingBox = bounds;
  geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
  geometry.instanceCount = count;
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    fog: true,
    blending: spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      ...THREE.UniformsLib.fog,
      fieldTime: { value: 0 },
      fieldHeight: { value: height },
      fieldLifetime: { value: spec.lifetime ?? 10 },
      fieldWind: { value: new THREE.Vector3(...wind) },
      fieldSize: { value: new THREE.Vector2(...size) },
      fieldOpacity: { value: spec.opacity ?? 0.55 },
      fieldMotion: { value: PARTICLE_MOTIONS[spec.motion ?? "drift"] },
      fieldShape: { value: PARTICLE_SHAPES[spec.shape ?? "mote"] },
    },
    vertexShader: `attribute vec3 particleBase,particleRight,particleForward,particleTint;
      attribute vec4 particleSeed;
      uniform float fieldTime,fieldHeight,fieldLifetime,fieldMotion,fieldShape;
      uniform vec2 fieldSize;uniform vec3 fieldWind;
      varying vec2 vEffectUv;varying vec3 vEffectTint;
      varying float vEffectFade,vEffectSeed,vEffectPhase;
      #include <fog_pars_vertex>
      void main(){
        float cycle=fract(particleSeed.w+fieldTime/fieldLifetime);
        float phase=particleSeed.x*6.283185;
        vec3 p=particleBase;
        float sway=sin(fieldTime*.53+phase+cycle*5.);
        if(fieldMotion<.5){
          p.y+=(1.-cycle)*fieldHeight;
          p.x+=sway*1.5;p.z+=cos(fieldTime*.37+phase)*1.3;
          p+=fieldWind*(cycle-.5);
        }else if(fieldMotion<1.5){
          p.y+=(1.-cycle)*fieldHeight;p+=fieldWind*(cycle-.5);
        }else if(fieldMotion<2.5){
          p.y+=cycle*fieldHeight;
          p.x+=sway*cycle*1.8;p.z+=cos(phase+cycle*4.)*cycle;
          p+=fieldWind*cycle;
        }else if(fieldMotion<3.5){
          p.y+=4.*fieldHeight*cycle*(1.-cycle);
          p.x+=sin(phase)*cycle*2.;p.z+=cos(phase)*cycle*2.;
          p+=fieldWind*cycle;
        }
        float growth=fieldShape>4.5&&fieldShape<5.5?.35+cycle*1.2:1.;
        vec2 quad=position.xy*fieldSize*(.65+particleSeed.z*.7)*growth;
        float angle=fieldShape>3.5&&fieldShape<4.5?-.18:
          (fieldShape<3.5||fieldShape>7.5&&fieldShape<8.5?phase+fieldTime*(particleSeed.y-.5):0.);
        quad=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*quad;
        vec4 mvPosition=modelViewMatrix*vec4(p,1.);
        if(fieldMotion>3.5){
          float ringSize=.15+cycle*2.;
          mvPosition=modelViewMatrix*vec4(p+particleRight*quad.x*ringSize+particleForward*quad.y*ringSize,1.);
        }else mvPosition.xy+=quad;
        gl_Position=projectionMatrix*mvPosition;
        vEffectUv=uv;vEffectTint=particleTint;vEffectSeed=particleSeed.y;
        vEffectPhase=cycle;
        vEffectFade=smoothstep(0.,.12,cycle)*(1.-smoothstep(.72,1.,cycle));
        vEffectFade*=smoothstep(.4,2.5,-mvPosition.z)*(1.-smoothstep(100.,170.,-mvPosition.z));
        if(fieldShape>10.5)vEffectFade*=.25+.75*pow(.5+.5*sin(fieldTime*2.1+phase),3.);
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float fieldShape,fieldOpacity;
      varying vec2 vEffectUv;varying vec3 vEffectTint;
      varying float vEffectFade,vEffectSeed,vEffectPhase;
      #include <fog_pars_fragment>
      void main(){
        vec2 p=vEffectUv*2.-1.;float radius=length(p),mask=0.;
        if(fieldShape<.5){mask=1.-smoothstep(.1,1.,radius);}
        else if(fieldShape<1.5){
          float petal=length(vec2(p.x*(1.35+.3*p.y),p.y));
          mask=1.-smoothstep(.75,1.,petal);
        }else if(fieldShape<2.5){
          float leaf=abs(p.x)*1.8+abs(p.y)*.65;
          mask=1.-smoothstep(.78,1.,leaf);
          mask*=.65+.35*smoothstep(.015,.06,abs(p.x+p.y*.12));
        }else if(fieldShape<3.5){
          float a=atan(p.y,p.x);
          mask=(1.-smoothstep(.7,.95,radius))*(.4+.6*pow(abs(cos(a*3.)),8.));
        }else if(fieldShape<4.5){
          mask=(1.-smoothstep(.2,.8,abs(p.x)))*(1.-smoothstep(.5,1.,abs(p.y)));
        }else if(fieldShape<5.5){
          float cloud=radius+sin(p.x*7.+vEffectSeed*6.)*sin(p.y*6.)*.08;
          mask=pow(1.-smoothstep(.1,1.,cloud),2.);
        }else if(fieldShape<6.5){
          mask=(1.-smoothstep(.035,.12,abs(radius-.75)))*.7;
          mask+=pow(max(0.,1.-length(p-vec2(-.35,.35))*4.),3.)*.7;
        }else if(fieldShape<7.5){
          mask=pow(max(0.,1.-radius),2.)+max(0.,1.-abs(p.x)*9.)*max(0.,1.-abs(p.y))* .25;
        }else if(fieldShape<8.5){mask=(1.-smoothstep(.65,.9,abs(p.x)))*(1.-smoothstep(.45,.8,abs(p.y)));}
        else if(fieldShape<9.5){mask=(1.-smoothstep(.025,.10,abs(radius-.67)))*(1.-vEffectPhase);}
        else if(fieldShape<10.5){mask=pow(max(0.,1.-length(vec2(p.x*1.4,p.y))),2.);}
        else {mask=pow(max(0.,1.-radius),2.);}
        float alpha=mask*vEffectFade*fieldOpacity;if(alpha<.006)discard;
        gl_FragColor=vec4(vEffectTint,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        ${spec.additive ? THREE.ShaderChunk.fog_fragment.replace(/\bfogColor\b/g, "vec3(0.)") : "#include <fog_fragment>"}
      }`,
  });
  const object = new THREE.Mesh(geometry, material);
  object.name = spec.name;
  object.position.copy(origin);
  object.castShadow = object.receiveShadow = false;
  object.userData.skipBake = true;
  object.userData.environmentParticle = { shape: spec.shape, motion: spec.motion, count };
  const center = new THREE.Vector3(),
    radius = geometry.boundingSphere.radius;
  return {
    object,
    spec,
    capacity: count,
    update(time) {
      material.uniforms.fieldTime.value = time;
    },
    setQuality(tier) {
      geometry.instanceCount = Math.ceil(count * GRAPHICS_TIERS[tier].effectDensity);
    },
    updateCamera(position) {
      object.updateWorldMatrix(true, false);
      center.copy(geometry.boundingSphere.center).applyMatrix4(object.matrixWorld);
      object.visible = position.distanceToSquared(center) < (170 + radius) ** 2;
    },
  };
}
