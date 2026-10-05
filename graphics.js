import * as THREE from './vendor/three/three.module.js';

// Assets are local at runtime. Failed optional downloads fall back to the
// game's procedural artwork, so an unavailable texture cannot stop a race.
export async function loadGraphicsAssets(renderer) {
  const loader = new THREE.TextureLoader();
  const texture = async (name) => {
    try {
      const t = await loader.loadAsync(`./assets/${name}.webp`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return t;
    } catch (error) {
      console.warn(`Using procedural fallback for ${name}`, error);
      return null;
    }
  };
  const models = async () => {
    try {
      const responses = await Promise.all([fetch('./assets/nature.json'), fetch('./assets/nature.bin')]);
      if (responses.some(r => !r.ok)) throw new Error('Nature asset request failed');
      const [manifest, buffer] = await Promise.all([responses[0].json(), responses[1].arrayBuffer()]);
      return manifest.models.map(model => {
        const data = new THREE.InterleavedBuffer(new Float32Array(buffer, model.offset, model.vertices * manifest.stride), manifest.stride);
        const g = new THREE.BufferGeometry();
        g.name = model.name;
        g.setAttribute('position', new THREE.InterleavedBufferAttribute(data, 3, 0));
        g.setAttribute('normal', new THREE.InterleavedBufferAttribute(data, 3, 3));
        g.setAttribute('color', new THREE.InterleavedBufferAttribute(data, 3, 6));
        g.computeBoundingBox();
        g.computeBoundingSphere();
        return g;
      });
    } catch (error) {
      console.warn('Using procedural scenery fallback', error);
      return null;
    }
  };
  const [grass, asphalt, sky, nature] = await Promise.all([
    texture('grass'), texture('asphalt'), texture('sky-reflections'), models(),
  ]);
  let environment = null;
  if (sky) {
    sky.mapping = THREE.EquirectangularReflectionMapping;
    const generator = new THREE.PMREMGenerator(renderer);
    // Filter once at startup. Only the small kart surfaces use this map.
    environment = generator.fromEquirectangular(sky);
    generator.dispose();
    sky.dispose();
  }
  return { grass, asphalt, nature, environment: environment?.texture ?? null };
}

// Soft, fixed underside shading without a screen-space AO pass. Clone a
// geometry before using this helper if it is shared by differently lit meshes.
export function bakeVertexShade(geometry, strength = 0.18) {
  if (geometry.getAttribute('color')) return geometry;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const span = Math.max(0.001, max.y - min.y);
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const height = (positions.getY(i) - min.y) / span;
    const underside = Math.max(0, -normals.getY(i));
    const shade = 1 - strength * (0.55 * (1 - height) + 0.45 * underside);
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function createKartDecalAtlas(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  colors.forEach((color, i) => {
    const x = (i % 4) * 128, y = Math.floor(i / 4) * 128;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#fff8dc'; ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.stroke();
    ctx.fillStyle = '#243a4b'; ctx.font = 'italic 900 76px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), 60, 68);
    ctx.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map: texture, roughness: 0.6, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1,
  });
  return {
    material,
    geometry(index, size) {
      const g = new THREE.PlaneGeometry(size, size), uv = g.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, ((index % 4) + uv.getX(i)) / 4,
          (1 - Math.floor(index / 4) + uv.getY(i)) / 2);
      }
      return g;
    },
  };
}

export class ParticlePool {
  constructor(scene, capacity = 96) {
    this.capacity = capacity;
    this.count = 0;
    this.particles = Array.from({ length: capacity }, () => ({
      position: new THREE.Vector3(), velocity: new THREE.Vector3(),
      color: new THREE.Color(), life: 0, max: 1, size: 1,
    }));
    this.object = new THREE.Object3D();
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ vertexColors: false, transparent: true, depthWrite: false }), capacity);
    this.mesh.name = 'Pooled drift and boost sparks';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    // A tiny bounded pool moves with racers; do not use a stale instance bound.
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>',
        '#include <common>\nattribute float particleOpacity; varying float vParticleOpacity;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvParticleOpacity = particleOpacity;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
        '#include <common>\nvarying float vParticleOpacity;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.a *= vParticleOpacity;');
    };
    this.mesh.material.customProgramCacheKey = () => 'pooled-particle-opacity-v1';
    this.opacity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.opacity.setUsage(THREE.DynamicDrawUsage);
    this.mesh.geometry.setAttribute('particleOpacity', this.opacity);
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
    p.position.copy(position); p.color.set(color);
    p.life = p.max = life; p.size = size;
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
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i], fade = Math.max(0, p.life / p.max);
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
  clear() {
    this.count = this.mesh.count = 0;
    this.mesh.visible = false;
  }
}

export function createStableShadowFollower(sun) {
  const offset = new THREE.Vector3(-65, 95, 45);
  const z = offset.clone().normalize();
  const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const center = new THREE.Vector3();
  const texelX = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
  const texelY = (sun.shadow.camera.top - sun.shadow.camera.bottom) / sun.shadow.mapSize.y;
  return position => {
    // Quantize in light space, not world X/Z, to keep projected shadow texels
    // anchored as the kart moves. The light direction stays exactly constant.
    center.copy(position)
      .addScaledVector(x, Math.round(position.dot(x) / texelX) * texelX - position.dot(x))
      .addScaledVector(y, Math.round(position.dot(y) / texelY) * texelY - position.dot(y));
    sun.target.position.copy(center);
    sun.position.copy(center).add(offset);
    sun.target.updateMatrixWorld();
  };
}

export function addGradientSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 16, 8), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    uniforms: { zenith: { value: new THREE.Color('#56ace2') }, horizon: { value: new THREE.Color('#c2e1e6') } },
    vertexShader: `varying vec3 direction;
      void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; varying vec3 direction;
      void main(){float h=clamp(normalize(direction).y,0.,1.);
        gl_FragColor=vec4(mix(horizon,zenith,pow(h,.45)),1.);
        #include <colorspace_fragment>
      }`,
  }));
  sky.name = 'Painted sky and horizon haze';
  sky.frustumCulled = false;
  sky.onBeforeRender = (_renderer, _scene, camera) => {
    sky.position.copy(camera.position);
    sky.updateMatrixWorld();
  };
  scene.add(sky);
}
