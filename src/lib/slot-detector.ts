import { PhotoSlot } from "@/types/photobooth";

interface DetectedBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
}

function findConnectedBoxes(
  cw: number,
  ch: number,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
  data: Uint8ClampedArray,
  matcher: (r: number, g: number, b: number, a: number) => boolean
): DetectedBox[] {
  const visited = new Uint8Array(cw * ch);
  const boxes: DetectedBox[] = [];
  const minHoleArea = Math.round(fw * fh * 0.025);

  const matches = (x: number, y: number) => {
    const idx = (y * cw + x) * 4;
    return matcher(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
  };

  for (let y = fy + 2; y < fy + fh - 2; y++) {
    for (let x = fx + 2; x < fx + fw - 2; x++) {
      const pos = y * cw + x;
      if (visited[pos] || !matches(x, y)) continue;

      const queue: number[] = [pos];
      visited[pos] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      let touchesOuterBorder = false;

      let head = 0;
      while (head < queue.length) {
        const curr = queue[head++];
        const cx = curr % cw;
        const cy = Math.floor(curr / cw);
        area++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        if (cx <= fx + 1 || cx >= fx + fw - 2 || cy <= fy + 1 || cy >= fy + fh - 2) {
          touchesOuterBorder = true;
        }

        const neighbors = [
          cx > fx ? curr - 1 : -1,
          cx < fx + fw - 1 ? curr + 1 : -1,
          cy > fy ? curr - cw : -1,
          cy < fy + fh - 1 ? curr + cw : -1,
        ];

        for (const nPos of neighbors) {
          if (nPos !== -1 && !visited[nPos]) {
            const nx = nPos % cw;
            const ny = Math.floor(nPos / cw);
            if (matches(nx, ny)) {
              visited[nPos] = 1;
              queue.push(nPos);
            }
          }
        }
      }

      if (!touchesOuterBorder && area >= minHoleArea) {
        boxes.push({ minX, minY, maxX, maxY, area });
      }
    }
  }

  return boxes;
}

function boxesToSlots(
  boxes: DetectedBox[],
  cw: number,
  ch: number,
  startZIndex: number,
  count: 4 | 8
): PhotoSlot[] {
  const topN = boxes.sort((a, b) => b.area - a.area).slice(0, count);

  if (count === 8) {
    // Pisahkan kolom kiri & kolom kanan, lalu masing-masing urutkan dari atas ke bawah
    const midX = cw / 2;
    const leftCol = topN
      .filter((b) => (b.minX + b.maxX) / 2 < midX)
      .sort((a, b) => a.minY - b.minY);
    const rightCol = topN
      .filter((b) => (b.minX + b.maxX) / 2 >= midX)
      .sort((a, b) => a.minY - b.minY);
    const ordered = [...leftCol, ...rightCol];

    return ordered.map((b, idx) => {
      const x = Math.max(0, ((b.minX - 0.5) / cw) * 100);
      const y = Math.max(0, ((b.minY - 0.5) / ch) * 100);
      const w = Math.min(100 - x, ((b.maxX - b.minX + 2) / cw) * 100);
      const h = Math.min(100 - y, ((b.maxY - b.minY + 2) / ch) * 100);
      return {
        id: idx + 1,
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        width: Number(w.toFixed(1)),
        height: Number(h.toFixed(1)),
        zIndex: startZIndex + idx,
      };
    });
  }

  const ordered = topN.sort((a, b) => a.minY - b.minY);
  return ordered.map((b, idx) => {
    const x = Math.max(0, ((b.minX - 0.5) / cw) * 100);
    const y = Math.max(0, ((b.minY - 0.5) / ch) * 100);
    const w = Math.min(100 - x, ((b.maxX - b.minX + 2) / cw) * 100);
    const h = Math.min(100 - y, ((b.maxY - b.minY + 2) / ch) * 100);
    return {
      id: idx + 1,
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      width: Number(w.toFixed(1)),
      height: Number(h.toFixed(1)),
      zIndex: startZIndex + idx,
    };
  });
}

function isChromaGreen(r: number, g: number, b: number, a: number): boolean {
  return a >= 180 && g >= 150 && g - r >= 35 && g - b >= 85;
}

/**
 * Mengubah piksel hijau chroma-key pada PNG resolusi penuh menjadi transparan
 * sehingga ornamen/stiker di pinggir kotak foto tetap berada di atas foto.
 */
async function stripChromaGreenToTransparentPng(
  img: HTMLImageElement,
  originalFileName: string
): Promise<File> {
  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = img.width;
  fullCanvas.height = img.height;
  const ctx = fullCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");

  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const px = imgData.data;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const a = px[i + 3];
    if (isChromaGreen(r, g, b, a)) {
      px[i + 3] = 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    fullCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Gagal membuat PNG transparan"))),
      "image/png"
    );
  });

  const cleanName = originalFileName.replace(/\.[^.]+$/, "") + "-transparent.png";
  return new File([blob], cleanName, { type: "image/png" });
}

/**
 * Menggandakan 1 frame strip (4 kotak) menjadi 2 kolom berdampingan di kanvas 9:16 (1080x1920)
 * sehingga admin cukup upload 1 desain strip saja untuk menghasilkan 8 kotak (4 pose acak).
 */
export async function duplicateFrameToDouble916(
  frameUrl: string,
  slots: PhotoSlot[],
  backgroundColor: string
): Promise<{
  file: File;
  slots: PhotoSlot[];
  canvasWidth: number;
  canvasHeight: number;
}> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = frameUrl;
  });

  const canvasWidth = 1080;
  const canvasHeight = 1920;
  const halfW = canvasWidth / 2;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");

  // Gambar strip kiri dan kanan (mengisi penuh 540x1920 masing-masing agar full 9:16)
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  if (backgroundColor && backgroundColor !== "transparent") {
    // Biarkan transparan di area lubang foto; hanya gambar PNG-nya langsung
  }
  ctx.drawImage(img, 0, 0, halfW, canvasHeight);
  ctx.drawImage(img, halfW, 0, halfW, canvasHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Gagal menggandakan frame"))),
      "image/png"
    );
  });

  const file = new File([blob], `double-916-${Date.now()}.png`, { type: "image/png" });

  const base4 = slots.slice(0, 4);
  const leftSlots: PhotoSlot[] = base4.map((s, idx) => ({
    id: idx + 1,
    x: Number((s.x * 0.5).toFixed(1)),
    y: s.y,
    width: Number((s.width * 0.5).toFixed(1)),
    height: s.height,
    zIndex: idx + 1,
  }));

  const rightSlots: PhotoSlot[] = base4.map((s, idx) => ({
    id: idx + 5,
    x: Number((50 + s.x * 0.5).toFixed(1)),
    y: s.y,
    width: Number((s.width * 0.5).toFixed(1)),
    height: s.height,
    zIndex: idx + 5,
  }));

  return {
    file,
    slots: [...leftSlots, ...rightSlots],
    canvasWidth,
    canvasHeight,
  };
}

/**
 * Menganalisis PNG frame yang di-upload di panel Admin:
 * 1. Menempatkan gambar secara proporsional (contain) di canvas 9:16.
 * 2. Mendeteksi 4 lubang transparan (alpha < 40), ATAU 4 kotak hijau chroma-key (#9eff1f / #00ff00)
 *    lalu otomatis melubangi warna hijau menjadi transparan.
 * 3. Jika tidak ada keduanya, menyusun 4 kotak foto rapi di dalam area gambar.
 */
export async function detectSlotsFromFramePng(file: File): Promise<{
  slots: PhotoSlot[];
  recommendedFrameZIndex: number;
  mode: "transparent" | "chroma-green" | "fallback";
  processedFile?: File;
  canvasWidth: number;
  canvasHeight: number;
}> {
  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imgUrl;
    });

    // Sesuaikan ukuran kanvas HD dengan rasio asli gambar PNG (tanpa pinggiran kosong)
    const canvasHeight = 1920;
    const canvasWidth = Math.max(400, Math.round(canvasHeight * (img.width / img.height)));

    const ch = 320;
    const cw = Math.max(80, Math.round(ch * (img.width / img.height)));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia");

    const fx = 0;
    const fy = 0;
    const fw = cw;
    const fh = ch;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    const { data } = ctx.getImageData(0, 0, cw, ch);

    // 1. Cek lubang transparan
    const transparentBoxes = findConnectedBoxes(
      cw,
      ch,
      fx,
      fy,
      fw,
      fh,
      data,
      (_r, _g, _b, a) => a < 40
    );

    if (transparentBoxes.length >= 8) {
      return {
        slots: boxesToSlots(transparentBoxes, cw, ch, 1, 8),
        recommendedFrameZIndex: 10,
        mode: "transparent",
        canvasWidth,
        canvasHeight,
      };
    }

    if (transparentBoxes.length >= 4) {
      return {
        slots: boxesToSlots(transparentBoxes, cw, ch, 1, 4),
        recommendedFrameZIndex: 6,
        mode: "transparent",
        canvasWidth,
        canvasHeight,
      };
    }

    // 2. Cek kotak hijau terang / chroma-key (mis. #9eff1f atau #00ff00 dari Canva)
    const greenBoxes = findConnectedBoxes(
      cw,
      ch,
      fx,
      fy,
      fw,
      fh,
      data,
      isChromaGreen
    );

    if (greenBoxes.length >= 8) {
      const processedFile = await stripChromaGreenToTransparentPng(img, file.name);
      return {
        slots: boxesToSlots(greenBoxes, cw, ch, 1, 8),
        recommendedFrameZIndex: 10,
        mode: "chroma-green",
        processedFile,
        canvasWidth,
        canvasHeight,
      };
    }

    if (greenBoxes.length >= 4) {
      const processedFile = await stripChromaGreenToTransparentPng(img, file.name);
      return {
        slots: boxesToSlots(greenBoxes, cw, ch, 1, 4),
        recommendedFrameZIndex: 6,
        mode: "chroma-green",
        processedFile,
        canvasWidth,
        canvasHeight,
      };
    }

    // 3. Fallback proporsional penuh di dalam gambar
    const slots: PhotoSlot[] = [0, 1, 2, 3].map((idx) => ({
      id: idx + 1,
      x: 8,
      y: Number((7 + idx * 19.5).toFixed(1)),
      width: 84,
      height: 17.5,
      zIndex: idx + 2,
    }));

    return {
      slots,
      recommendedFrameZIndex: 1,
      mode: "fallback",
      canvasWidth,
      canvasHeight,
    };
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}
