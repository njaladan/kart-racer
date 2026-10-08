import * as THREE from "../../../vendor/three/three.module.js";

const clamp = (v) => Math.max(0, Math.min(1, v));
function hash(x, y, seed) {
  let h = Math.imul(x + seed, 374761393) ^ Math.imul(y - seed, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y, period, seed) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy,
    u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = hash(ix % period, iy % period, seed),
    b = hash((ix + 1) % period, iy % period, seed);
  const c = hash(ix % period, (iy + 1) % period, seed),
    d = hash((ix + 1) % period, (iy + 1) % period, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/** Original periodic slope / patch / cellular foam atlas, generated once on load. */
export function createStormDetailTexture() {
  const size = 256,
    height = new Float32Array(size * size),
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      height[y * size + x] =
        noise(u * 8, v * 8, 8, 19) * 0.48 +
        noise(u * 16, v * 16, 16, 37) * 0.3 +
        noise(u * 32, v * 32, 32, 73) * 0.15 +
        noise(u * 64, v * 64, 64, 131) * 0.07;
      // Periodic Voronoi edges make irregular bubble walls, not sine stripes.
      const px = u * 32,
        py = v * 32,
        ix = Math.floor(px),
        iy = Math.floor(py);
      let first = 100,
        second = 100;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx,
            cy = iy + dy,
            hx = (cx + 32) % 32,
            hy = (cy + 32) % 32;
          const distance = Math.hypot(cx + hash(hx, hy, 173) - px, cy + hash(hx, hy, 239) - py);
          if (distance < first) {
            second = first;
            first = distance;
          } else second = Math.min(second, distance);
        }
      const i = (y * size + x) * 4;
      data[i + 2] = Math.round(clamp(height[y * size + x]) * 255);
      data[i + 3] = Math.round(clamp(1 - (second - first) * 4.5) * 255);
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const sx =
        (height[y * size + ((x + 1) % size)] - height[y * size + ((x + size - 1) % size)]) * 7;
      const sz =
        (height[((y + 1) % size) * size + x] - height[((y + size - 1) % size) * size + x]) * 7;
      data[i] = Math.round(clamp(0.5 + sx) * 255);
      data[i + 1] = Math.round(clamp(0.5 + sz) * 255);
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.name = "Tempest slope, foam patches and bubbles";
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Coast footprints rasterized once; one lookup replaces a per-pixel obstacle loop. */
export function createStormCoastTexture(size = 1700) {
  const resolution = 512,
    data = new Uint8Array(resolution * resolution);
  const shapes = [];
  const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RedFormat);
  texture.name = "Tempest signed distance to coastal rock and piers";
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  let dirty = true;
  function addShore(x, z, radius, endX = x, endZ = z) {
    shapes.push({ x, z, radius, endX, endZ });
    dirty = true;
  }
  function update() {
    if (!dirty) return;
    const distances = new Float32Array(data.length).fill(32),
      step = size / resolution;
    const pixel = (v) =>
      Math.max(0, Math.min(resolution - 1, Math.floor((v / size + 0.5) * resolution)));
    for (const s of shapes) {
      const margin = s.radius + 32,
        dx = s.endX - s.x,
        dz = s.endZ - s.z,
        length2 = dx * dx + dz * dz;
      const x0 = pixel(Math.min(s.x, s.endX) - margin),
        x1 = pixel(Math.max(s.x, s.endX) + margin);
      const y0 = pixel(Math.min(s.z, s.endZ) - margin),
        y1 = pixel(Math.max(s.z, s.endZ) + margin);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const wx = (x + 0.5) * step - size / 2,
            wz = (y + 0.5) * step - size / 2;
          const t = length2 ? clamp(((wx - s.x) * dx + (wz - s.z) * dz) / length2) : 0;
          const distance = Math.hypot(wx - s.x - dx * t, wz - s.z - dz * t) - s.radius;
          const i = y * resolution + x;
          distances[i] = Math.min(distances[i], distance);
        }
    }
    for (let i = 0; i < data.length; i++)
      data[i] = Math.round(clamp((distances[i] + 16) / 48) * 255);
    texture.needsUpdate = true;
    dirty = false;
  }
  return { texture, addShore, update };
}
