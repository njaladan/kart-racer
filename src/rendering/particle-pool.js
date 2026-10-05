import * as THREE from "../../vendor/three/three.module.js";

export class ParticlePool {
  constructor(scene, capacity = 96) {
    this.capacity = capacity;
    this.count = 0;
    this.renderLimit = capacity;
    this.particles = Array.from({ length: capacity }, () => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      color: new THREE.Color(),
      life: 0,
      max: 1,
      size: 1,
    }));
    this.object = new THREE.Object3D();
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ vertexColors: false, transparent: true, depthWrite: false }),
      capacity,
    );
    this.mesh.name = "Pooled drift and boost sparks";
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    // A tiny bounded pool moves with racers; do not use a stale instance bound.
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\nattribute float particleOpacity; varying float vParticleOpacity; varying vec2 vParticleUv;",
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvParticleOpacity = particleOpacity; vParticleUv = uv;",
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
        mvPosition.xy += position.xy * vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
        gl_Position = projectionMatrix * mvPosition;`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nvarying float vParticleOpacity; varying vec2 vParticleUv;",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float particleSoft = 1.-smoothstep(.05,.5,length(vParticleUv-.5));
diffuseColor.a *= vParticleOpacity * particleSoft; if(diffuseColor.a<.01)discard;`,
      );
    };
    this.mesh.material.customProgramCacheKey = () => "pooled-billboard-particle-v2";
    this.opacity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.opacity.setUsage(THREE.DynamicDrawUsage);
    this.mesh.geometry.setAttribute("particleOpacity", this.opacity);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }
  spawn(position, color, life = 0.6, size = 0.2, velocity = null) {
    let index = this.count;
    if (index < this.capacity) this.count++;
    else {
      index = 0;
      for (let i = 1; i < this.capacity; i++)
        if (this.particles[i].life < this.particles[index].life) index = i;
    }
    const p = this.particles[index];
    p.position.copy(position);
    p.color.set(color);
    p.life = p.max = life;
    p.size = size;
    if (velocity) p.velocity.copy(velocity);
    else p.velocity.set((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2);
  }
  step(dt) {
    for (let i = this.count - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.count--;
        this.particles[i] = this.particles[this.count];
        this.particles[this.count] = p;
        continue;
      }
      p.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= dt * 1.5;
    }
  }
  sync() {
    this.mesh.count = Math.min(this.count, this.renderLimit);
    this.mesh.visible = this.mesh.count > 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i],
        fade = Math.max(0, p.life / p.max);
      this.object.position.copy(p.position);
      this.object.scale.setScalar(p.size * (0.45 + 0.9 * fade));
      this.object.updateMatrix();
      this.mesh.setMatrixAt(i, this.object.matrix);
      this.mesh.setColorAt(i, p.color);
      this.opacity.setX(i, fade);
    }
    if (this.count) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
      this.opacity.needsUpdate = true;
    }
  }
  setQuality(tier) {
    this.renderLimit = Math.ceil(this.capacity * [0.45, 0.65, 0.85, 1][tier]);
  }
  clear() {
    this.count = this.mesh.count = 0;
    this.mesh.visible = false;
  }
}
