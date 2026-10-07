import * as THREE from "../../vendor/three/three.module.js";

/** Small camera-facing solar halo; actual scene occlusion prevents glare through walls. */
export function createSunGlare(scene, theme) {
  const enabled =
    (theme.sunIntensity ?? 0) > 2 && theme.atmosphere !== "storm" && theme.terrain !== "wood";
  const uniforms = {
    center: { value: new THREE.Vector2() },
    strength: { value: 0 },
    aspect: { value: 1 },
    tint: { value: new THREE.Color(theme.sun || "#ffe6b3") },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform vec2 center;uniform float strength,aspect;uniform vec3 tint;varying vec2 vUv;
      void main(){vec2 p=(vUv-center)*vec2(aspect,1.);float r=length(p);
      float halo=exp(-r*r*200.)*.075+exp(-r*r*2200.)*.32;
      float rays=pow(abs(cos(atan(p.y,p.x)*3.)),20.)*exp(-r*35.)*.09;
      vec2 ghost=(vUv-(vec2(.5)+(vec2(.5)-center)*.55))*vec2(aspect,1.);
      float ring=exp(-pow((length(ghost)-.04)*220.,2.))*.016;
      gl_FragColor=vec4(tint,(halo+rays+ring)*strength);}`,
  });
  const object = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  object.name = "Occluded solar halo";
  object.frustumCulled = false;
  object.renderOrder = 80;
  object.userData.skipBake = true;
  object.visible = false;
  scene.add(object);
  const sun = scene.children.find((o) => o.isDirectionalLight),
    direction = new THREE.Vector3(),
    projected = new THREE.Vector3(),
    ray = new THREE.Raycaster();
  let lastCheck = -Infinity,
    visible = false;
  return {
    object,
    update(time, camera, underwater = false, quality = 3) {
      object.visible = enabled && !underwater && !!sun;
      if (!object.visible) return;
      camera.updateMatrixWorld();
      direction.copy(sun.position).sub(sun.target.position).normalize();
      projected.copy(camera.position).addScaledVector(direction, 1000).project(camera);
      const front = direction.dot(camera.getWorldDirection(new THREE.Vector3())) > 0.05;
      const onscreen = front && Math.abs(projected.x) < 1.12 && Math.abs(projected.y) < 1.12;
      if (onscreen && (time < lastCheck || time - lastCheck > 0.35)) {
        const candidates = [];
        scene.traverse((o) => {
          if (!o.isMesh || !o.visible || o.userData.skipBake) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          if (mats.every((m) => m.transparent && m.opacity < 0.5)) return;
          candidates.push(o);
        });
        ray.set(camera.position, direction);
        ray.near = 0.4;
        ray.far = 300;
        visible = !candidates.some((o) => ray.intersectObject(o, false).length);
        lastCheck = time;
      }
      uniforms.center.value.set(projected.x * 0.5 + 0.5, projected.y * 0.5 + 0.5);
      uniforms.aspect.value = camera.aspect;
      const desired = onscreen && visible ? (quality === 0 ? 0.5 : 1) : 0;
      uniforms.strength.value += (desired - uniforms.strength.value) * 0.25;
      object.visible = uniforms.strength.value > 0.002;
    },
  };
}
