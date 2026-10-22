// ==========================================================================
// QR kod generatori (ISO/IEC 18004) — tashqi kutubxonasiz. Byte (UTF-8), daraja M, versiyalar 1–9 (≤ 180 bayt).
// Laboratoriya varag‘idagi sayt havolasi uchun. (assets/js/certificates/qr.js bilan bir xil algoritm.)
//   qrMatrix("https://...") → boolean[][];  drawQr(ctx, matrix, x, y, size, {quiet}) → canvas’ga chizadi
// ==========================================================================

// Versiya bo'yicha: [ma'lumot kodslovlari soni, blok boshiga ECC, [[bloklar soni, blokdagi ma'lumot]...]] (daraja M)
const M_TABLE = [
  null,
  [16, 10, [[1, 16]]],
  [28, 16, [[1, 28]]],
  [44, 26, [[1, 44]]],
  [64, 18, [[2, 32]]],
  [86, 24, [[2, 43]]],
  [108, 16, [[4, 27]]],
  [124, 18, [[4, 31]]],
  [154, 22, [[2, 38], [2, 39]]],
  [182, 22, [[3, 36], [2, 37]]],
];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// ---- GF(256), polinom 0x11D
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gmul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data, degree) {
  const gen = rsGenerator(degree);
  const rem = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= gmul(gen[i + 1], factor);
  }
  return rem;
}

function utf8(text) {
  return Array.from(new TextEncoder().encode(text));
}

function pickVersion(len) {
  for (let v = 1; v <= 9; v++) {
    const bits = 4 + 8 + len * 8; // rejim + uzunlik (v1–9: 8 bit; v10: 16 bit) + ma'lumot
    const lenBits = v < 10 ? 8 : 16;
    if (bits - 8 + lenBits <= M_TABLE[v][0] * 8) return v;
  }
  throw new Error("QR: matn juda uzun");
}

function buildCodewords(bytes, version) {
  const [total, eccLen, groups] = M_TABLE[version];
  const bits = [];
  const put = (value, count) => { for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const capacity = total * 8;
  put(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < total; pad ^= 0xec ^ 0x11) data.push(pad);

  const blocks = [];
  let offset = 0;
  groups.forEach(([count, size]) => {
    for (let i = 0; i < count; i++) {
      const chunk = data.slice(offset, offset + size);
      offset += size;
      blocks.push({ data: chunk, ecc: rsRemainder(chunk, eccLen) });
    }
  });
  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) blocks.forEach((b) => { if (i < b.data.length) out.push(b.data[i]); });
  for (let i = 0; i < eccLen; i++) blocks.forEach((b) => out.push(b.ecc[i]));
  return out;
}

function bchFormat(data) {
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function bchVersion(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function penalty(m) {
  const n = m.length;
  let score = 0;
  const runScore = (line) => {
    let s = 0;
    let run = 1;
    for (let i = 1; i < n; i++) {
      if (line[i] === line[i - 1]) run++;
      else { if (run >= 5) s += run - 2; run = 1; }
    }
    if (run >= 5) s += run - 2;
    return s;
  };
  for (let i = 0; i < n; i++) {
    score += runScore(m[i]);
    score += runScore(m.map((row) => row[i]));
  }
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }
  const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const rev = [...pat].reverse();
  const match = (get, p) => { for (let k = 0; k < 11; k++) if ((get(k) ? 1 : 0) !== p[k]) return false; return true; };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= n - 11; j++) {
      if (match((k) => m[i][j + k], pat) || match((k) => m[i][j + k], rev)) score += 40;
      if (match((k) => m[j + k][i], pat) || match((k) => m[j + k][i], rev)) score += 40;
    }
  }
  let dark = 0;
  m.forEach((row) => row.forEach((v) => { if (v) dark++; }));
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

export function qrMatrix(text) {
  const bytes = utf8(String(text));
  const version = pickVersion(bytes.length);
  const n = 17 + 4 * version;
  const modules = Array.from({ length: n }, () => new Array(n).fill(false));
  const reserved = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r, c, v) => { modules[r][c] = v; reserved[r][c] = true; };

  // Qidiruv (finder) naqshlari + ajratgichlar
  const finder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const dark = inside && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        set(r, c, dark);
      }
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);

  // Vaqt (timing) chiziqlari
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

  // Tekislash (alignment) naqshlari
  const pos = ALIGN[version];
  const last = pos[pos.length - 1];
  pos.forEach((r) => pos.forEach((c) => {
    if ((r === 6 && c === 6) || (r === 6 && c === last) || (r === last && c === 6)) return; // finder bilan to'qnashadi
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }));

  // Format/versiya hududlarini band qilish, "qorong'i modul"
  for (let i = 0; i < 9; i++) { reserved[8][i] = true; reserved[i][8] = true; }
  for (let i = 0; i < 8; i++) { reserved[8][n - 1 - i] = true; reserved[n - 1 - i][8] = true; }
  set(n - 8, 8, true);
  if (version >= 7) {
    for (let i = 0; i < 18; i++) { reserved[Math.floor(i / 3)][n - 11 + (i % 3)] = true; reserved[n - 11 + (i % 3)][Math.floor(i / 3)] = true; }
  }

  // Ma'lumotni zigzag tartibida joylash
  const codewords = buildCodewords(bytes, version);
  const stream = [];
  codewords.forEach((cw) => { for (let i = 7; i >= 0; i--) stream.push((cw >>> i) & 1); });
  const remainder = version >= 2 && version <= 6 ? 7 : 0;
  for (let i = 0; i < remainder; i++) stream.push(0);

  const place = (maskFn) => {
    const grid = modules.map((row) => row.slice());
    let k = 0;
    let up = true;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let i = 0; i < n; i++) {
        const r = up ? n - 1 - i : i;
        for (let dc = 0; dc < 2; dc++) {
          const c = col - dc;
          if (reserved[r][c]) continue;
          let bit = stream[k++] === 1;
          if (maskFn(r, c)) bit = !bit;
          grid[r][c] = bit;
        }
      }
      up = !up;
    }
    return grid;
  };

  const writeInfo = (grid, mask) => {
    const fmt = bchFormat((0b00 << 3) | mask); // daraja M = 00
    for (let i = 0; i < 15; i++) {
      const bit = ((fmt >>> i) & 1) === 1;
      // 1-nusxa: yuqori-chap atrofida
      if (i < 6) grid[i][8] = bit;
      else if (i < 8) grid[i + 1][8] = bit;
      else if (i === 8) grid[8][7] = bit;
      else grid[8][14 - i] = bit;
      // 2-nusxa: yuqori-o'ng va quyi-chap
      if (i < 8) grid[8][n - 1 - i] = bit;
      else grid[n - 15 + i][8] = bit;
    }
    grid[n - 8][8] = true;
    if (version >= 7) {
      const info = bchVersion(version);
      for (let i = 0; i < 18; i++) {
        const bit = ((info >>> i) & 1) === 1;
        grid[Math.floor(i / 3)][n - 11 + (i % 3)] = bit;
        grid[n - 11 + (i % 3)][Math.floor(i / 3)] = bit;
      }
    }
  };

  let best = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid = place(MASKS[mask]);
    writeInfo(grid, mask);
    const score = penalty(grid);
    if (score < bestScore) { bestScore = score; best = grid; }
  }
  return best;
}

/** Matritsani canvas'ga chizadi (oq fon + jim hudud). `size` — jim hududsiz kvadrat o'lchami (piksel). */
export function drawQr(ctx, matrix, x, y, size, { quiet = 4, dark = "#0b1220", light = "#ffffff" } = {}) {
  const n = matrix.length;
  const cell = size / (n + quiet * 2);
  ctx.fillStyle = light;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = dark;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) ctx.fillRect(x + (c + quiet) * cell, y + (r + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}
