/** Shared Gerstner spectrum: metres, seconds, deep-water dispersion. */
export const STORM_SEA_LEVEL = -10;
export const STORM_WAVES = [
  [0.6, -0.8, 151, 3.8, 0.26, 0.4],
  [0.91, -0.415, 87, 1.55, 0.2, 2.1],
  [0.12, -0.993, 43, 0.75, 0.16, 4.5],
  [-0.72, -0.694, 25, 0.38, 0.12, 1.3],
].map(([x, z, wavelength, amplitude, steepness, phase]) => {
  const length = Math.hypot(x, z),
    k = (2 * Math.PI) / wavelength;
  return Object.freeze({
    x: x / length,
    z: z / length,
    k,
    amplitude,
    steepness,
    phase,
    omega: Math.sqrt(9.81 * k),
  });
});
Object.freeze(STORM_WAVES);

/** Parametric surface and its exact derivatives; reusable output for buoyancy. */
export function stormWaveSurface(x, z, time, out = {}) {
  let px = x,
    pz = z,
    height = STORM_SEA_LEVEL;
  let xx = 1,
    xz = 0,
    zz = 1,
    yx = 0,
    yz = 0;
  for (const w of STORM_WAVES) {
    const phase = w.k * (w.x * x + w.z * z) - w.omega * time + w.phase;
    const s = Math.sin(phase),
      c = Math.cos(phase),
      q = w.steepness;
    px += ((w.x * q) / w.k) * c;
    pz += ((w.z * q) / w.k) * c;
    height += w.amplitude * s;
    xx -= q * w.x * w.x * s;
    xz -= q * w.x * w.z * s;
    zz -= q * w.z * w.z * s;
    yx += w.amplitude * w.k * w.x * c;
    yz += w.amplitude * w.k * w.z * c;
  }
  const jacobian = xx * zz - xz * xz;
  const nx = yz * xz - zz * yx,
    nz = xz * yx - xx * yz;
  const length = Math.hypot(nx, jacobian, nz);
  Object.assign(out, {
    x: px,
    z: pz,
    height,
    xx,
    xz,
    zz,
    jacobian,
    nx: nx / length,
    ny: jacobian / length,
    nz: nz / length,
  });
  return out;
}

/** Invert horizontal displacement so floating props sample the rendered world X/Z. */
export function sampleStormSea(x, z, time, out = {}) {
  let u = x,
    v = z;
  for (let i = 0; i < 6; i++) {
    stormWaveSurface(u, v, time, out);
    const dx = out.x - x,
      dz = out.z - z;
    if (Math.abs(dx) + Math.abs(dz) < 1e-7) return out;
    u -= (out.zz * dx - out.xz * dz) / out.jacobian;
    v -= (out.xx * dz - out.xz * dx) / out.jacobian;
  }
  return stormWaveSurface(u, v, time, out);
}

export function stormSeaHeight(x, z, time) {
  return sampleStormSea(x, z, time).height;
}

/** Generate GLSL from the same spectrum rather than maintaining a second model. */
export function stormWaveGLSL() {
  const gl = (n) => n.toFixed(9);
  return `
    uniform float stormTime;
    void stormWave(vec2 p, vec2 d, float k, float a, float q, float omega, float phase,
      inout vec3 displacement, inout vec3 tx, inout vec3 tz, inout vec3 oldDerivative) {
      float f=k*dot(d,p)-omega*stormTime+phase;
      float s=sin(f), c=cos(f);
      displacement+=vec3(d.x*q/k*c,a*s,d.y*q/k*c);
      tx+=vec3(-q*d.x*d.x*s,a*k*d.x*c,-q*d.x*d.y*s);
      tz+=vec3(-q*d.x*d.y*s,a*k*d.y*c,-q*d.y*d.y*s);
      // A short crest history leaves a decaying foam trail, evaluated from race time.
      float oldS=sin(f+omega*1.8);
      oldDerivative-=q*oldS*vec3(d.x*d.x,d.x*d.y,d.y*d.y);
    }
    void stormSurface(vec2 p, out vec3 displacement, out vec3 tx, out vec3 tz,
      out vec2 compression) {
      displacement=vec3(0.); tx=vec3(1.,0.,0.); tz=vec3(0.,0.,1.);
      vec3 oldDerivative=vec3(1.,0.,1.);
      ${STORM_WAVES.map((w) => `stormWave(p,vec2(${gl(w.x)},${gl(w.z)}),${gl(w.k)},${gl(w.amplitude)},${gl(w.steepness)},${gl(w.omega)},${gl(w.phase)},displacement,tx,tz,oldDerivative);`).join("\n")}
      compression=vec2(tx.x*tz.z-tx.z*tz.x,
        oldDerivative.x*oldDerivative.z-oldDerivative.y*oldDerivative.y);
    }`;
}
