import * as THREE from "../../vendor/three/three.module.js";

// One bounded weather draw, with small flakes/dust/motes and a clear road center.
// No sprite downloads or per-particle materials; the point shape is analytic.
export function addAmbientWeather(scene, theme = {}) {
  const snow = theme.terrain === "snow",
    dust = theme.terrain === "sand";
  const city = theme.terrain === "concrete";
  const count = snow ? 140 : dust ? 72 : city ? 44 : 50;
  let seed = 8041;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const source = Array.from({ length: count }, () => ({
    x: random() * 90 - 45,
    z: random() * 90 - 45,
    y: random() * 24,
    phase: random() * Math.PI * 2,
    scale: 0.6 + random() * 0.8,
  }));
  const positions = new Float32Array(count * 3),
    sizes = new Float32Array(count);
  source.forEach((p, i) => {
    sizes[i] = p.scale;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute("flakeSize", new THREE.BufferAttribute(sizes, 1));
  const uniforms = {
    tint: {
      value: new THREE.Color(snow ? "#effaff" : dust ? "#ffe3b1" : city ? "#9dc7df" : "#dff6a0"),
    },
    opacity: { value: snow ? 0.64 : dust ? 0.24 : city ? 0.18 : 0.6 },
    size: { value: snow ? 100 : dust ? 72 : 45 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
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
  points.name = snow
    ? "Mountain snow flurries"
    : dust
      ? "Sunlit drifting sand"
      : city
        ? "Harbor sea spray"
        : "Forest fireflies";
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  return {
    object: points,
    setQuality(tier) {
      geometry.setDrawRange(0, Math.ceil(count * [0.45, 0.65, 0.85, 1][tier]));
    },
    update(time, position, forest = false) {
      points.visible = snow || dust || city || forest;
      if (!points.visible) return;
      source.forEach((p, i) => {
        const drift = time * (snow ? 0.5 : dust ? 0.9 : 0.3);
        const x = p.x + drift + Math.sin(time * 0.35 + p.phase) * 1.7;
        const z = p.z + Math.cos(time * 0.27 + p.phase) * 1.5;
        positions[i * 3] = x + Math.round((position.x - x) / 90) * 90;
        positions[i * 3 + 2] = z + Math.round((position.z - z) / 90) * 90;
        const y = (((p.y - time * (snow ? 0.8 : city ? 0.12 : -0.09)) % 24) + 24) % 24;
        positions[i * 3 + 1] = position.y - 3 + y;
      });
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
