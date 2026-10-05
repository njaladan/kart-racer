import * as THREE from './vendor/three/three.module.js';

export function addCourseSky(scene,theme) {
  const material=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{zenith:{value:new THREE.Color(theme.sky)},horizon:{value:new THREE.Color(theme.fog)}},
    vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform vec3 zenith; uniform vec3 horizon; varying vec3 direction;
      void main(){float h=clamp(normalize(direction).y,0.,1.);gl_FragColor=vec4(mix(horizon,zenith,pow(h,.45)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(700,24,12),material);sky.frustumCulled=false;scene.add(sky);
  return sky;
}

// Shadow target translates in texel-sized increments in light coordinates.
export function stabilizeSun(sun,position) {
  const forward=new THREE.Vector3(-65,95,45).normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),forward).normalize();
  const up=new THREE.Vector3().crossVectors(forward,right).normalize();
  const texel=(sun.shadow.camera.right-sun.shadow.camera.left)/sun.shadow.mapSize.x;
  const target=position.clone();
  target.addScaledVector(right,Math.round(position.dot(right)/texel)*texel-position.dot(right));
  target.addScaledVector(up,Math.round(position.dot(up)/texel)*texel-position.dot(up));
  sun.target.position.copy(target);sun.position.copy(target).add(new THREE.Vector3(-65,95,45));sun.target.updateMatrixWorld();
}
