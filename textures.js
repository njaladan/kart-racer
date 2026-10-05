import * as THREE from './vendor/three/three.module.js';

// Small, repeatable painted textures: broad color variation plus fine surface detail.
// Shared across racers and instanced scenery to keep GPU memory bounded.
export function surfaceTexture(kind, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  let seed = 1729;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const palettes = {
    grass: ['#78af45', '#a2c65c', '#528c35'],
    snow: ['#eef6fa', '#ffffff', '#cddde8'],
    sand: ['#eee1c2', '#fff5d8', '#c5b58f'],
    concrete: ['#ccd0d4', '#eef0f1', '#a1a6af'],
    asphalt: ['#65717c', '#a1aab1', '#394754'],
    bark: ['#986945', '#c49363', '#5a3b29'],
    leaves: ['#83b965', '#bdd58c', '#528a45'],
    fabric: ['#d8e0e4', '#ffffff', '#8899a4'],
    tire: ['#343b40', '#5a6369', '#11171d'],
    paint: ['#eeeeee', '#ffffff', '#c5cbd0'],
    brick: ['#f2e3c4', '#fff8e4', '#bca688'],
    roof: ['#ce7258', '#efaa7d', '#934e43'],
    water: ['#4bbdce', '#aaedf0', '#238baf'],
  };
  const [base, light, dark] = palettes[kind];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  // Wrapped soft patches avoid a visible edge when the texture repeats.
  for (let i = 0; i < 85; i++) {
    const x = random() * 512, y = random() * 512, r = 15 + random() * 65;
    for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, i % 2 ? light : dark);
      g.addColorStop(1, base);
      ctx.globalAlpha = kind === 'paint' ? 0.06 : 0.12;
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  for (let i = 0; i < 13000; i++) {
    ctx.globalAlpha = 0.08 + random() * 0.18;
    ctx.fillStyle = i % 2 ? light : dark;
    const x = random() * 512, y = random() * 512;
    if (kind === 'grass' || kind === 'leaves') {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 3 - random() * 7);
      ctx.lineWidth = 1; ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
    } else ctx.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
  }
  ctx.globalAlpha = 1;
  if (kind === 'bark') {
    for (let i = 0; i < 70; i++) {
      const x = random() * 512;
      ctx.strokeStyle = i % 2 ? '#bb895c' : '#68472f'; ctx.lineWidth = 1 + random() * 3;
      ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 16) ctx.lineTo(x + Math.sin(y / 35 + i) * 5, y);
      ctx.stroke();
    }
  }
  if (kind === 'fabric') {
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 512; i += 4) {
      ctx.fillStyle = light; ctx.fillRect(i, 0, 1, 512);
      ctx.fillStyle = dark; ctx.fillRect(0, i, 512, 1);
    }
  }
  if (kind === 'tire') {
    for (let y = 0; y < 512; y += 32) for (let x = -64; x < 512; x += 64) {
      ctx.strokeStyle = '#151b21'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 25, y + 16);
      ctx.lineTo(x + 50, y); ctx.stroke();
    }
  }
  if (kind === 'brick' || kind === 'roof') {
    const h = kind === 'brick' ? 64 : 32;
    ctx.strokeStyle = kind === 'brick' ? '#bba98a' : '#934e43'; ctx.lineWidth = 3;
    for (let y = 0; y <= 512; y += h) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      for (let x = (y / h % 2) * 64; x <= 512; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke();
      }
    }
  }
  if (kind === 'water') {
    ctx.globalAlpha = 0.3; ctx.strokeStyle = light; ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 16) {
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 4) ctx.lineTo(x, y + Math.sin(x * Math.PI / 64 + y) * 4);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
