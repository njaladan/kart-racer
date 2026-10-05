import * as THREE from "../../vendor/three/three.module.js";

// A light finishing pass avoids blur and keeps the middle of the road untouched.
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
      void main(){vec2 p=(vUv-.5)*vec2(aspect,1.);float radius=length(p);
        float edge=smoothstep(.27,.7,abs(vUv.x-.5));
        float angle=atan(p.y,p.x);float lane=fract(angle*13.+.17);
        float thin=1.-smoothstep(.035,.085,abs(lane-.5));
        float travel=fract(radius*1.8-time*(1.5+boost*2.)+floor(angle*13.)*.13);
        float streak=thin*smoothstep(.65,.94,travel)*edge*speed*(.07+boost*.12);
        float vignette=smoothstep(.27,.75,length(vUv-.5))*.07;
        float alpha=max(streak,vignette);
        vec3 color=mix(vec3(.035,.065,.085),vec3(.82,.96,1.),streak/max(.001,alpha));
        gl_FragColor=vec4(color,alpha);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.name = "Restrained edge turbo streaks and display finish";
  mesh.frustumCulled = false;
  mesh.renderOrder = 10000;
  scene.add(mesh);
  return {
    update(time, speed, boosting, aspect) {
      uniforms.time.value = time;
      uniforms.speed.value = THREE.MathUtils.smoothstep(speed, 32, 70);
      uniforms.boost.value = boosting ? 1 : 0;
      uniforms.aspect.value = aspect;
    },
  };
}
