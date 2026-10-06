import * as THREE from "../../vendor/three/three.module.js";

// Radial action lines leave the kart and the middle of the road readable.
// It is rendered directly in the main scene rather than allocating render targets.
export function addRaceFinish(scene) {
  const uniforms = {
    time: { value: 0 },
    speed: { value: 0 },
    boost: { value: 0 },
    aspect: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform float time,speed,boost,aspect;varying vec2 vUv;
      void main(){
        vec2 p=(vUv-vec2(.5,.54))*vec2(aspect,1.);float radius=length(p);
        float edge=smoothstep(.22,.58,length(vUv-vec2(.5,.54)));
        float angle=atan(p.y,p.x);float sector=floor((angle+3.14159)*18.);
        float lane=fract((angle+3.14159)*18.);
        float seed=fract(sin(sector*127.1)*43758.5453);
        float thin=1.-smoothstep(.018,.055+boost*.035,abs(lane-.5));
        float travel=fract(radius*(2.6-seed)-time*(2.+boost*5.)+seed);
        float tail=smoothstep(.3,.85,travel)*(1.-smoothstep(.96,1.,travel));
        float streak=thin*tail*edge*max(speed,boost)*(.09+boost*.65);
        float vignette=smoothstep(.27,.75,length(vUv-.5))*(.07+boost*.1);
        float alpha=max(streak,vignette);
        vec3 color=mix(vec3(.035,.065,.085),vec3(.82,.96,1.),streak/max(.001,alpha));
        gl_FragColor=vec4(color,alpha);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.name = "Aggressive radial turbo action lines";
  mesh.frustumCulled = false;
  mesh.renderOrder = 10000;
  scene.add(mesh);
  return {
    update(time, speed, boosting, aspect) {
      uniforms.time.value = time;
      uniforms.speed.value = THREE.MathUtils.smoothstep(speed, 32, 70);
      uniforms.boost.value = Number(boosting);
      uniforms.aspect.value = aspect;
    },
  };
}
