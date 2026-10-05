import * as THREE from "../../vendor/three/three.module.js";

/** Generate deterministic light probes once at load, then prefilter for PBR roughness. */
export function createReflectionPixels(theme = {}, enclosed = false, width = 256, height = 128) {
  const night = theme.terrain === "concrete";
  const sky = new THREE.Color(theme.sky || "#73c4ec");
  const horizon = new THREE.Color(theme.fog || "#b9dbe7");
  const ground = new THREE.Color(theme.ground || "#6f9052");
  const sun = new THREE.Color(theme.sun || "#fff1cc");
  const data = new Float32Array(width * height * 4);
  const color = new THREE.Color();
  const accent = new THREE.Color();
  const neonColors = [
    new THREE.Color("#16dded"),
    new THREE.Color("#fa55af"),
    new THREE.Color("#ffbd64"),
  ];
  for (let y = 0; y < height; y++) {
    const elevation = Math.cos((y / (height - 1)) * Math.PI);
    for (let x = 0; x < width; x++) {
      const longitude = (x / width) * Math.PI * 2;
      if (elevation >= 0) color.copy(horizon).lerp(sky, Math.sqrt(elevation));
      else color.copy(horizon).lerp(ground, Math.min(1, -elevation * 2.5));
      const sunDot = Math.sin(longitude) * Math.sqrt(1 - elevation ** 2) * 0.58 + elevation * 0.82;
      color.add(
        accent.copy(sun).multiplyScalar(Math.pow(Math.max(0, sunDot), 110) * (night ? 0.38 : 4)),
      );
      if (night && Math.abs(elevation) < 0.42) {
        const band = Math.max(0, Math.sin(longitude * 11 + 0.3)) ** 18;
        color.add(
          accent
            .copy(neonColors[Math.floor((x / width) * 9) % 3])
            .multiplyScalar(band * (1 - Math.abs(elevation) / 0.42) * 1.5),
        );
      }
      if (enclosed) color.multiplyScalar(0.42 + Math.max(0, Math.cos(longitude * 3)) ** 8 * 0.24);
      const i = (y * width + x) * 4;
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 1;
    }
  }
  return data;
}

export function createCourseEnvironments(renderer, theme) {
  const generator = new THREE.PMREMGenerator(renderer);
  const targets = [];
  try {
    for (const enclosed of [false, true]) {
      const texture = new THREE.DataTexture(
        createReflectionPixels(theme, enclosed),
        256,
        128,
        THREE.RGBAFormat,
        THREE.FloatType,
      );
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.needsUpdate = true;
      targets.push(generator.fromEquirectangular(texture));
      texture.dispose();
    }
  } finally {
    generator.dispose();
  }
  return {
    exterior: targets[0].texture,
    interior: targets[1].texture,
    dispose: () => targets.forEach((target) => target.dispose()),
  };
}
