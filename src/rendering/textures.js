import * as THREE from "../../vendor/three/three.module.js";

// Small, repeatable painted textures: broad color variation plus fine surface detail.
// Shared across racers and instanced scenery to keep GPU memory bounded.
export function surfaceTexture(kind, renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  let seed = 1729;
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
  const palettes = {
    grass: ["#79bc43", "#a8d965", "#579638"],
    snow: ["#eef6fa", "#ffffff", "#cddde8"],
    sand: ["#eee1c2", "#fff5d8", "#c5b58f"],
    concrete: ["#ccd0d4", "#eef0f1", "#a1a6af"],
    asphalt: ["#858990", "#9699a0", "#757b83"],
    bark: ["#986945", "#c49363", "#5a3b29"],
    leaves: ["#83b965", "#bdd58c", "#528a45"],
    fabric: ["#d8e0e4", "#ffffff", "#8899a4"],
    tire: ["#343b40", "#5a6369", "#11171d"],
    paint: ["#eeeeee", "#ffffff", "#c5cbd0"],
    brick: ["#f2e3c4", "#fff8e4", "#bca688"],
    roof: ["#ce7258", "#efaa7d", "#934e43"],
    water: ["#4bbdce", "#aaedf0", "#238baf"],
    wood: ["#b89160", "#e4c798", "#79583b"],
    rock: ["#b8ad94", "#e0d5bd", "#786f60"],
    gravel: ["#b5b3a1", "#e3dac4", "#767d73"],
    needles: ["#7c8960", "#b6b179", "#475d41"],
    paving: ["#abb9bd", "#d7ddd4", "#74838a"],
    blossom: ["#f4c5cf", "#fff1e7", "#d78fba"],
  };
  const [base, light, dark] = palettes[kind] || palettes.rock;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  // Wrapped soft patches avoid a visible edge when the texture repeats.
  for (let i = 0; i < 85; i++) {
    const x = random() * 512,
      y = random() * 512,
      r = 15 + random() * 65;
    for (const dx of [-512, 0, 512])
      for (const dy of [-512, 0, 512]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, i % 2 ? light : dark);
        g.addColorStop(1, base);
        ctx.globalAlpha = kind === "paint" ? 0.06 : kind === "asphalt" ? 0.08 : 0.12;
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
  }
  for (let i = 0; i < 13000; i++) {
    ctx.globalAlpha = kind === "asphalt" ? 0.04 + random() * 0.06 : 0.08 + random() * 0.18;
    ctx.fillStyle = i % 2 ? light : dark;
    const x = random() * 512,
      y = random() * 512;
    if (kind === "grass" || kind === "leaves") {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2, y - 3 - random() * 7);
      ctx.lineWidth = 1;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();
    } else ctx.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
  }
  ctx.globalAlpha = 1;
  if (kind === "bark") {
    for (let i = 0; i < 70; i++) {
      const x = random() * 512;
      ctx.strokeStyle = i % 2 ? "#bb895c" : "#68472f";
      ctx.lineWidth = 1 + random() * 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 16) ctx.lineTo(x + Math.sin(y / 35 + i) * 5, y);
      ctx.stroke();
    }
  }
  if (kind === "fabric") {
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 512; i += 4) {
      ctx.fillStyle = light;
      ctx.fillRect(i, 0, 1, 512);
      ctx.fillStyle = dark;
      ctx.fillRect(0, i, 512, 1);
    }
  }
  if (kind === "tire") {
    for (let y = 0; y < 512; y += 32)
      for (let x = -64; x < 512; x += 64) {
        ctx.strokeStyle = "#151b21";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 25, y + 16);
        ctx.lineTo(x + 50, y);
        ctx.stroke();
      }
  }
  if (kind === "brick" || kind === "roof") {
    const h = kind === "brick" ? 64 : 32;
    ctx.strokeStyle = kind === "brick" ? "#bba98a" : "#934e43";
    ctx.lineWidth = 3;
    for (let y = 0; y <= 512; y += h) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
      for (let x = ((y / h) % 2) * 64; x <= 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + h);
        ctx.stroke();
      }
    }
  }
  if (kind === "water") {
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = light;
    ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 16) {
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 4) ctx.lineTo(x, y + Math.sin((x * Math.PI) / 64 + y) * 4);
      ctx.stroke();
    }
  }
  // Construction marks and large-scale variation stay visible from a moving camera.
  if (kind === "wood") {
    for (let x = 0; x < 512; x += 128) {
      ctx.fillStyle = dark;
      ctx.fillRect(x, 0, 3, 512);
      ctx.fillStyle = light;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x + 3, 0, 2, 512);
      ctx.globalAlpha = 0.22;
      for (let j = 0; j < 18; j++) {
        ctx.strokeStyle = j % 3 ? dark : light;
        ctx.lineWidth = 1 + random();
        ctx.beginPath();
        for (let y = 0; y <= 512; y += 8) ctx.lineTo(x + 8 + j * 6 + Math.sin(y / 55 + j) * 2.5, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.48;
      ctx.strokeStyle = dark;
      ctx.beginPath();
      ctx.ellipse(x + 63, 195 + (x % 93), 8, 23, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (const y of [14, 498]) {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(x + 12, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (kind === "sand" || kind === "snow" || kind === "rock") {
    ctx.globalAlpha = kind === "rock" ? 0.15 : 0.11;
    for (let y = -20; y < 540; y += kind === "rock" ? 42 : 13) {
      ctx.strokeStyle = y % 2 ? light : dark;
      ctx.lineWidth = kind === "rock" ? 5 : 2;
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 8)
        ctx.lineTo(x, y + Math.sin((x * Math.PI) / 128 + y * 0.015) * (kind === "rock" ? 8 : 5));
      ctx.stroke();
    }
  }
  if (kind === "gravel") {
    for (let i = 0; i < 2800; i++) {
      const x = random() * 512,
        y = random() * 512,
        r = 1 + random() * 3.5;
      ctx.globalAlpha = 0.3 + random() * 0.25;
      ctx.fillStyle = i % 3 ? light : dark;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.65, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (kind === "needles") {
    ctx.globalAlpha = 0.38;
    for (let i = 0; i < 3400; i++) {
      const x = random() * 512,
        y = random() * 512,
        angle = random() * Math.PI * 2;
      ctx.strokeStyle = i % 3 ? "#baa577" : "#52643c";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10);
      ctx.stroke();
    }
  }
  if (kind === "paving") {
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 4;
    ctx.strokeStyle = dark;
    for (let y = 0; y <= 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
      for (let x = ((y / 64) % 2) * 64; x <= 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 64);
        ctx.stroke();
      }
    }
  }
  if (kind === "blossom") {
    for (let i = 0; i < 700; i++) {
      const x = random() * 512,
        y = random() * 512,
        r = 3 + random() * 4;
      ctx.globalAlpha = 0.23;
      ctx.fillStyle = i % 2 ? light : dark;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.ellipse(
          x + Math.cos(k * 1.257) * r,
          y + Math.sin(k * 1.257) * r,
          r,
          r * 0.65,
          k * 1.257,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
