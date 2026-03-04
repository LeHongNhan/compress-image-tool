/**
 * Watermark Engine
 * Dán logo / watermark lên ảnh bằng Canvas API
 *
 * 3 chế độ:
 *   - corner:  Logo góc cố định (top-left, top-right, bottom-left, bottom-right)
 *   - center:  Logo giữa ảnh với opacity thấp
 *   - tile:    Lặp logo toàn bộ ảnh (tile watermark)
 */

/**
 * @typedef {Object} WatermarkConfig
 * @property {boolean} enabled
 * @property {'corner' | 'center' | 'tile'} mode
 * @property {'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'} position - for corner mode
 * @property {number} opacity  - 0–1
 * @property {number} scale    - logo size as % of image shorter side (1–80)
 * @property {number} margin   - margin in px from edge (corner mode)
 * @property {number} tileGap  - gap between tiles in px (tile mode)
 * @property {number} rotation - tile rotation in degrees (tile mode)
 */

/** Default config */
export const DEFAULT_WATERMARK_CONFIG = {
  enabled: false,
  mode: 'corner',
  position: 'bottom-right',
  opacity: 0.6,
  scale: 20,       // 20% of image shorter side
  margin: 20,      // 20px margin
  tileGap: 60,     // 60px gap between tiles
  rotation: -30,   // -30° for tile mode
};

/**
 * Load an image element from a File/Blob
 * @param {File|Blob|string} source - File, Blob, or URL
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(img.src);
      }
      resolve(img);
    };
    img.onerror = () => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(img.src);
      }
      reject(new Error('Failed to load image'));
    };

    img.src = typeof source === 'string' ? source : URL.createObjectURL(source);
  });
}

/**
 * Calculate logo draw size based on scale percentage relative to image shorter side
 */
function calcLogoSize(imgW, imgH, logoW, logoH, scalePercent) {
  const shorterSide = Math.min(imgW, imgH);
  const targetW = Math.round((scalePercent / 100) * shorterSide);
  const aspect = logoW / logoH;
  return {
    w: targetW,
    h: Math.round(targetW / aspect),
  };
}

/**
 * Apply watermark to an image file
 *
 * @param {File|Blob} imageFile - The source image
 * @param {HTMLImageElement} logoImg - Pre-loaded logo image element
 * @param {WatermarkConfig} config
 * @returns {Promise<File>} - Watermarked image as File (PNG to preserve quality before compression)
 */
export async function applyWatermark(imageFile, logoImg, config) {
  if (!config.enabled || !logoImg) {
    return imageFile; // pass through
  }

  const sourceImg = await loadImage(imageFile);

  const canvas = document.createElement('canvas');
  canvas.width = sourceImg.naturalWidth;
  canvas.height = sourceImg.naturalHeight;
  const ctx = canvas.getContext('2d');

  // Draw original image
  ctx.drawImage(sourceImg, 0, 0);

  const imgW = canvas.width;
  const imgH = canvas.height;
  const { w: logoW, h: logoH } = calcLogoSize(
    imgW, imgH,
    logoImg.naturalWidth, logoImg.naturalHeight,
    config.scale
  );

  // Apply watermark based on mode
  switch (config.mode) {
    case 'corner':
      drawCornerWatermark(ctx, logoImg, imgW, imgH, logoW, logoH, config);
      break;
    case 'center':
      drawCenterWatermark(ctx, logoImg, imgW, imgH, logoW, logoH, config);
      break;
    case 'tile':
      drawTileWatermark(ctx, logoImg, imgW, imgH, logoW, logoH, config);
      break;
    default:
      drawCornerWatermark(ctx, logoImg, imgW, imgH, logoW, logoH, config);
  }

  // Convert canvas to blob -> File
  const blob = await canvasToBlob(canvas, 'image/png', 1);
  const watermarkedFile = new File([blob], imageFile.name || 'watermarked.png', {
    type: 'image/png',
    lastModified: Date.now(),
  });

  return watermarkedFile;
}

/**
 * Mode 1: Corner watermark
 */
function drawCornerWatermark(ctx, logoImg, imgW, imgH, logoW, logoH, config) {
  const { position, opacity, margin } = config;

  ctx.save();
  ctx.globalAlpha = opacity;

  let x, y;
  switch (position) {
    case 'top-left':
      x = margin;
      y = margin;
      break;
    case 'top-right':
      x = imgW - logoW - margin;
      y = margin;
      break;
    case 'bottom-left':
      x = margin;
      y = imgH - logoH - margin;
      break;
    case 'bottom-right':
    default:
      x = imgW - logoW - margin;
      y = imgH - logoH - margin;
      break;
  }

  ctx.drawImage(logoImg, x, y, logoW, logoH);
  ctx.restore();
}

/**
 * Mode 2: Center watermark (with lower opacity)
 */
function drawCenterWatermark(ctx, logoImg, imgW, imgH, logoW, logoH, config) {
  const { opacity } = config;

  // Center logo is typically larger
  const centerScale = 1.5;
  const cW = Math.round(logoW * centerScale);
  const cH = Math.round(logoH * centerScale);

  ctx.save();
  ctx.globalAlpha = Math.min(opacity, 0.4); // center mode is typically lower opacity
  const x = (imgW - cW) / 2;
  const y = (imgH - cH) / 2;
  ctx.drawImage(logoImg, x, y, cW, cH);
  ctx.restore();
}

/**
 * Mode 3: Tile watermark (repeat across entire image)
 */
function drawTileWatermark(ctx, logoImg, imgW, imgH, logoW, logoH, config) {
  const { opacity, tileGap, rotation } = config;

  // Smaller logo for tile mode
  const tileScale = 0.6;
  const tW = Math.round(logoW * tileScale);
  const tH = Math.round(logoH * tileScale);

  ctx.save();
  ctx.globalAlpha = Math.min(opacity, 0.3); // tile is subtle

  const rad = (rotation * Math.PI) / 180;

  // We need to cover the entire image even when rotated
  // Expand the area to ensure full coverage
  const diagonal = Math.sqrt(imgW * imgW + imgH * imgH);
  const stepX = tW + tileGap;
  const stepY = tH + tileGap;

  ctx.translate(imgW / 2, imgH / 2);
  ctx.rotate(rad);

  const startX = -diagonal / 2;
  const startY = -diagonal / 2;

  for (let y = startY; y < diagonal / 2; y += stepY) {
    for (let x = startX; x < diagonal / 2; x += stepX) {
      ctx.drawImage(logoImg, x, y, tW, tH);
    }
  }

  ctx.restore();
}

/**
 * Helper: Canvas to Blob
 */
function canvasToBlob(canvas, mime = 'image/png', quality = 1) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      mime,
      quality
    );
  });
}

/**
 * Generate a small preview of the watermark on a thumbnail
 * @param {HTMLCanvasElement} previewCanvas
 * @param {File|Blob} imageFile
 * @param {HTMLImageElement} logoImg
 * @param {WatermarkConfig} config
 */
export async function renderWatermarkPreview(previewCanvas, imageFile, logoImg, config) {
  if (!imageFile || !logoImg) return;

  const sourceImg = await loadImage(imageFile);

  // Scale down for preview
  const maxPreviewSize = 400;
  let pW = sourceImg.naturalWidth;
  let pH = sourceImg.naturalHeight;

  if (pW > maxPreviewSize || pH > maxPreviewSize) {
    const ratio = Math.min(maxPreviewSize / pW, maxPreviewSize / pH);
    pW = Math.round(pW * ratio);
    pH = Math.round(pH * ratio);
  }

  previewCanvas.width = pW;
  previewCanvas.height = pH;
  const ctx = previewCanvas.getContext('2d');

  ctx.drawImage(sourceImg, 0, 0, pW, pH);

  const { w: logoW, h: logoH } = calcLogoSize(
    pW, pH,
    logoImg.naturalWidth, logoImg.naturalHeight,
    config.scale
  );

  switch (config.mode) {
    case 'corner':
      drawCornerWatermark(ctx, logoImg, pW, pH, logoW, logoH, {
        ...config,
        margin: Math.max(5, Math.round(config.margin * (pW / sourceImg.naturalWidth))),
      });
      break;
    case 'center':
      drawCenterWatermark(ctx, logoImg, pW, pH, logoW, logoH, config);
      break;
    case 'tile':
      drawTileWatermark(ctx, logoImg, pW, pH, logoW, logoH, {
        ...config,
        tileGap: Math.max(10, Math.round(config.tileGap * (pW / sourceImg.naturalWidth))),
      });
      break;
  }
}
