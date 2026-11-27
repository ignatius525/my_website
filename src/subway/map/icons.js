/*
 * Icons for the live map, rasterised in code (no image downloads).
 * The arrow, bracket and diamond are ported from fun-mta's web/app.js; the
 * sheep is new for the pasture skin.
 */

import { SPRITES } from '../../components/PixelArt.jsx';

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/**
 * A train as one of the site's pixel sheep, wool in the route's colour.
 *
 * Drawn from the same sprite as the navbar logo, with a one-pixel outline so a
 * sheep stays visible on top of its own (identically coloured) line. `facing`
 * 'left' mirrors it so sheep face their direction of travel. Each sprite pixel
 * becomes `scale` device pixels; registered at pixelRatio 2.
 */
export function makeSheepImage(color, outline, facing = 'right', scale = 2) {
  const grid = SPRITES.sheep;
  const h0 = grid.length;
  const w0 = grid[0].length;
  const wool = hexToRgb(color);
  const light = mix(wool, [255, 255, 255], 0.35);
  const face = [30, 30, 30];
  const line = hexToRgb(outline);
  const colours = { W: wool, L: light, K: face };

  // Sprite cells plus a 1-cell border for the outline.
  const W = w0 + 2;
  const H = h0 + 2;
  const cell = (x, y) => {
    if (x < 0 || y < 0 || x >= w0 || y >= h0) return '.';
    const sx = facing === 'left' ? w0 - 1 - x : x;
    return grid[y][sx];
  };
  const px = W * scale;
  const py = H * scale;
  const data = new Uint8Array(px * py * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = cell(x - 1, y - 1);
      let rgb = null;
      if (ch !== '.') {
        rgb = colours[ch] || wool;
      } else {
        // Outline: any transparent cell touching an opaque one.
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx || dy) && cell(x - 1 + dx, y - 1 + dy) !== '.') { near = true; break; }
          }
        }
        if (near) rgb = line;
      }
      if (!rgb) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const i = (((y * scale + sy) * px) + (x * scale + sx)) * 4;
          data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
        }
      }
    }
  }
  return { width: px, height: py, data };
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * A hollow square bracket: four corner ticks around an empty centre, for
 * stations. Drawn as an icon because MapLibre circles cannot be square.
 */
export function makeBracketImage(px, cfg) {
  const colour = hexToRgb(cfg.color);
  const t = Math.max(1, Math.round(cfg.thickness * px));
  const gap = cfg.gap ?? 0.34;
  const lo = t;
  const hi = px - t - 1;
  const arm = Math.max(t, Math.round(((hi - lo) * (1 - gap)) / 2));
  const data = new Uint8Array(px * px * 4);
  const paint = (x, y) => {
    if (x < 0 || y < 0 || x >= px || y >= px) return;
    const i = (y * px + x) * 4;
    data[i] = colour[0]; data[i + 1] = colour[1]; data[i + 2] = colour[2]; data[i + 3] = 255;
  };
  for (let k = 0; k < t; k++) {
    for (let d = 0; d < arm; d++) {
      paint(lo + d, lo + k); paint(hi - d, lo + k);
      paint(lo + d, hi - k); paint(hi - d, hi - k);
      paint(lo + k, lo + d); paint(lo + k, hi - d);
      paint(hi - k, lo + d); paint(hi - k, hi - d);
    }
  }
  return { width: px, height: px, data };
}

/**
 * An outlined arrowhead pointing north, drawn above the icon centre so that
 * rotating it by the train's bearing puts it just ahead of the sheep. The
 * concave notch is what makes it read as an arrow; a flat-based triangle
 * against a dot reads as a map pin.
 */
export function makeArrowImage(px, cfg) {
  const cx = px / 2;
  const baseY = px / 2 - (cfg.gap * px) / 2;
  const len = cfg.length * px;
  const halfW = (cfg.width * px) / 2;
  const notchY = baseY - len * (cfg.notch ?? 0.38);
  const poly = [[cx, baseY - len], [cx + halfW, baseY], [cx, notchY], [cx - halfW, baseY]];
  const fill = hexToRgb(cfg.color);
  const line = hexToRgb(cfg.outlineColor);
  const ow = cfg.outlineWidth * px;
  const data = new Uint8Array(px * px * 4);

  const inside = (x, y) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };

  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const sx = x + 0.5;
      const sy = y + 0.5;
      let edge = Infinity;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        edge = Math.min(edge, distToSegment(sx, sy, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
      }
      const d = inside(sx, sy) ? -edge : edge;
      const coreA = Math.max(0, Math.min(1, 0.5 - d));
      const totalA = Math.max(0, Math.min(1, 0.5 - (d - ow)));
      if (totalA <= 0) continue;
      const m = coreA / totalA;
      const i = (y * px + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(line[c] * (1 - m) + fill[c] * m);
      data[i + 3] = Math.round(255 * totalA);
    }
  }
  return { width: px, height: px, data };
}

/** A diamond outline as a signed distance field, tinted per tier, for landmarks. */
export function makeDiamondSDF(px, cfg) {
  const data = new Uint8Array(px * px * 4);
  const c = px / 2;
  const r = (cfg.radius ?? 0.32) * px;
  const half = ((cfg.thickness ?? 0.09) * px) / 2;
  const spread = (cfg.spread ?? 0.1) * px;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dx = Math.abs(x + 0.5 - c);
      const dy = Math.abs(y + 0.5 - c);
      const d = Math.abs((dx + dy - r) / Math.SQRT2) - half;
      const i = (y * px + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = Math.round(Math.max(0, Math.min(1, 0.5 - d / spread)) * 255);
    }
  }
  return { width: px, height: px, data };
}
