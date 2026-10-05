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
    try {
      // Filter once at startup. Only the small kart surfaces use this map.
      environment = generator.fromEquirectangular(sky);
    } catch (error) {
      console.warn('Using direct lighting without optional kart reflections', error);
    } finally {
      generator.dispose();
      sky.dispose();
    }
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

// A single sky pass supplies layered clouds, the celestial disk and atmospheric
// scattering. All movement is driven by the race clock, never wall-clock time.
export function addGradientSky(scene, theme = {}) {
  const night = theme.terrain === 'concrete', desert = theme.terrain === 'sand';
  const uniforms = {
    zenith: { value: new THREE.Color(theme.sky || '#56ace2') },
    horizon: { value: new THREE.Color(theme.fog || '#c2e1e6') },
    cloudLight: { value: new THREE.Color(night ? '#4f6482' : '#fff7e8') },
    cloudShade: { value: new THREE.Color(night ? '#202c48' : desert ? '#cdbfa9' : '#9ebbcf') },
    celestial: { value: new THREE.Color(night ? '#d5e8ff' : '#fff3c5') },
    sunDirection: { value: new THREE.Vector3(-65, 95, 45).normalize() },
    time: { value: 0 }, night: { value: night ? 1 : 0 },
    cloudCover: { value: desert ? 0.3 : night ? 0.5 : 0.68 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false, uniforms,
    vertexShader: `varying vec3 direction;
      void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 zenith,horizon,cloudLight,cloudShade,celestial,sunDirection;
      uniform float time,night,cloudCover; varying vec3 direction;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
      float cloud(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.01)*.15;}
      void main(){
        vec3 d=normalize(direction); float h=max(0.,d.y);
        vec3 color=mix(horizon,zenith,pow(h,.52));
        float sun=max(0.,dot(d,sunDirection));
        float halo=pow(sun,48.)*.22+pow(sun,8.)*.055;
        color+=celestial*halo*mix(1.,.38,night);
        float disk=smoothstep(.99915,.9996,sun);
        color=mix(color,celestial,disk*.95);
        // The night disk has a mottled, softly lit lunar surface.
        color-=vec3(disk*night*noise(d.xz*310.)*.16);
        vec2 cp=d.xz/(max(d.y,.04)+.24)*2.6+vec2(time*.004,time*.0015);
        float field=cloud(cp);
        float density=smoothstep(.6-cloudCover*.17,.79-cloudCover*.2,field);
        density*=smoothstep(.015,.16,h)*(1.-smoothstep(.8,1.,h))*.88;
        vec3 clouds=mix(cloudShade,cloudLight,smoothstep(.35,.68,field));
        clouds+=celestial*pow(sun,12.)*.08;
        color=mix(color,clouds,density);
        if(night>.5){
          vec2 stars=d.xz/(h+.35)*360.; vec2 cell=floor(stars); vec2 local=fract(stars)-.5;
          float star=(1.-smoothstep(.035,.12,length(local)))*step(.994,hash(cell));
          color+=vec3(.72,.83,1.)*star*smoothstep(.08,.3,h)*(1.-density)*(.7+.3*sin(time*.4+hash(cell)*60.));
        }
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`,
  }));
  sky.name = 'Layered painted sky, drifting clouds and sun or moon';
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  sky.onBeforeRender = (_renderer, _scene, camera) => {
    sky.position.copy(camera.position);
    sky.updateMatrixWorld();
  };
  scene.add(sky);
  return { mesh: sky, update(time) { uniforms.time.value = time; } };
}

// One bounded weather draw, with small flakes/dust/motes and a clear road center.
// No sprite downloads or per-particle materials; the point shape is analytic.
export function addAmbientWeather(scene, theme = {}) {
  const snow = theme.terrain === 'snow', dust = theme.terrain === 'sand';
  const city = theme.terrain === 'concrete';
  const count = snow ? 140 : dust ? 72 : city ? 44 : 50;
  let seed = 8041;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const source = Array.from({ length: count }, () => ({
    x: random() * 90 - 45, z: random() * 90 - 45, y: random() * 24,
    phase: random() * Math.PI * 2, scale: .6 + random() * .8,
  }));
  const positions = new Float32Array(count * 3), sizes = new Float32Array(count);
  source.forEach((p,i) => { sizes[i] = p.scale; });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('flakeSize', new THREE.BufferAttribute(sizes,1));
  const uniforms = {
    tint: { value: new THREE.Color(snow ? '#effaff' : dust ? '#ffe3b1' : city ? '#9dc7df' : '#dff6a0') },
    opacity: { value: snow ? .64 : dust ? .24 : city ? .18 : .6 },
    size: { value: snow ? 100 : dust ? 72 : 45 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `attribute float flakeSize; uniform float size; varying float fade;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(size*flakeSize/max(1.,-p.z),1.,6.);fade=1.-smoothstep(18.,55.,-p.z);}`,
    fragmentShader: `uniform vec3 tint;uniform float opacity;varying float fade;
      void main(){float a=(1.-smoothstep(.08,.5,length(gl_PointCoord-.5)))*fade*opacity;
        if(a<.015)discard;gl_FragColor=vec4(tint,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.name = snow ? 'Mountain snow flurries' : dust ? 'Sunlit drifting sand' : city ? 'Harbor sea spray' : 'Forest fireflies';
  points.frustumCulled = false; points.visible = false; scene.add(points);
  return {
    object: points,
    update(time, position, forest = false) {
      points.visible = snow || dust || city || forest;
      if (!points.visible) return;
      source.forEach((p, i) => {
        const drift = time * (snow ? .5 : dust ? .9 : .3);
        const x = p.x + drift + Math.sin(time * .35 + p.phase) * 1.7;
        const z = p.z + Math.cos(time * .27 + p.phase) * 1.5;
        positions[i * 3] = x + Math.round((position.x - x) / 90) * 90;
        positions[i * 3 + 2] = z + Math.round((position.z - z) / 90) * 90;
        const y = ((p.y - time * (snow ? .8 : city ? .12 : -.09)) % 24 + 24) % 24;
        positions[i * 3 + 1] = position.y - 3 + y;
      });
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

// A light finishing pass avoids blur and keeps the middle of the road untouched.
// It is rendered directly in the main scene rather than allocating render targets.
export function addRaceFinish(scene) {
  const uniforms = { time: { value: 0 }, speed: { value: 0 }, boost: { value: 0 }, aspect: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
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
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material);
  mesh.name = 'Restrained edge turbo streaks and display finish'; mesh.frustumCulled = false;
  mesh.renderOrder = 10000; scene.add(mesh);
  return {
    update(time, speed, boosting, aspect) {
      uniforms.time.value = time;
      uniforms.speed.value = THREE.MathUtils.smoothstep(speed, 32, 70);
      uniforms.boost.value = boosting ? 1 : 0;
      uniforms.aspect.value = aspect;
    },
  };
}
