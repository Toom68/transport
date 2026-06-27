import * as THREE from 'three';

// Generates a realistic cumulus cloud sprite texture using layered radial
// gradients with noise. Returns a CanvasTexture with transparency.
function makeCumulusTexture(size: number = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Build the cloud shape from multiple overlapping "puffs" — each is a
  // soft radial gradient blob. The arrangement mimics cumulus structure.
  const puffs: { x: number; y: number; r: number; opacity: number }[] = [];

  // Central cluster
  const cx = size / 2;
  const cy = size * 0.55;
  const baseR = size * 0.28;

  // Main body — large puffs in the center
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = baseR * 0.3;
    puffs.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist * 0.4,
      r: baseR * (0.7 + Math.random() * 0.3),
      opacity: 0.7 + Math.random() * 0.2,
    });
  }

  // Upper bulges — the classic cumulus "cauliflower" tops
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + (i - 3.5) * 0.35;
    const dist = baseR * (0.4 + Math.random() * 0.3);
    puffs.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist * 0.7 - size * 0.05,
      r: baseR * (0.4 + Math.random() * 0.35),
      opacity: 0.5 + Math.random() * 0.3,
    });
  }

  // Smaller detail puffs around edges
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = baseR * (0.6 + Math.random() * 0.5);
    puffs.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist * 0.5,
      r: baseR * (0.2 + Math.random() * 0.25),
      opacity: 0.3 + Math.random() * 0.3,
    });
  }

  // Sort puffs by y (back to front) for better layering
  puffs.sort((a, b) => a.y - b.y);

  // Draw each puff as a soft radial gradient
  for (const p of puffs) {
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    grad.addColorStop(0, `rgba(255, 255, 255, ${p.opacity})`);
    grad.addColorStop(0.4, `rgba(245, 248, 255, ${p.opacity * 0.6})`);
    grad.addColorStop(0.7, `rgba(220, 230, 245, ${p.opacity * 0.2})`);
    grad.addColorStop(1, 'rgba(200, 215, 240, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Add subtle noise for texture detail
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 10) {
      const noise = (Math.random() - 0.5) * 20;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Add a soft shadow at the bottom of the cloud for depth
  const shadowGrad = ctx.createRadialGradient(cx, cy + baseR * 0.3, 0, cx, cy + baseR * 0.3, baseR * 1.2);
  shadowGrad.addColorStop(0, 'rgba(40, 50, 70, 0.15)');
  shadowGrad.addColorStop(0.5, 'rgba(40, 50, 70, 0.05)');
  shadowGrad.addColorStop(1, 'rgba(40, 50, 70, 0)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Generates a thin wispy cirrus cloud texture (high-altitude streaks).
function makeCirrusTexture(size: number = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Wispy streaks — elongated horizontal gradients
  for (let i = 0; i < 15; i++) {
    const y = cy + (Math.random() - 0.5) * size * 0.5;
    const x = cx + (Math.random() - 0.5) * size * 0.3;
    const w = size * (0.15 + Math.random() * 0.35);
    const h = size * (0.02 + Math.random() * 0.04);
    const angle = (Math.random() - 0.5) * 0.3;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
    grad.addColorStop(0, `rgba(230, 235, 245, ${0.15 + Math.random() * 0.2})`);
    grad.addColorStop(0.5, `rgba(220, 228, 240, ${0.08 + Math.random() * 0.1})`);
    grad.addColorStop(1, 'rgba(200, 210, 230, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Generates a flat overcast stratus texture — a large, even grey-white sheet.
function makeStratusTexture(size: number = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Base layer — soft even coverage
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(200, 210, 225, 0.5)');
  grad.addColorStop(0.5, 'rgba(220, 228, 240, 0.7)');
  grad.addColorStop(1, 'rgba(190, 200, 215, 0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Add some subtle variation blobs
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.1 + Math.random() * 0.2);
    const blobGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const opacity = 0.1 + Math.random() * 0.15;
    blobGrad.addColorStop(0, `rgba(230, 238, 250, ${opacity})`);
    blobGrad.addColorStop(1, 'rgba(200, 210, 225, 0)');
    ctx.fillStyle = blobGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export interface CloudTextureSet {
  cumulus: THREE.Texture;
  cirrus: THREE.Texture;
  stratus: THREE.Texture;
}

let cachedTextures: CloudTextureSet | null = null;

export function getCloudTextures(): CloudTextureSet {
  if (cachedTextures) return cachedTextures;
  cachedTextures = {
    cumulus: makeCumulusTexture(256),
    cirrus: makeCirrusTexture(256),
    stratus: makeStratusTexture(256),
  };
  return cachedTextures;
}
