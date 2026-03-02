/**
 * Compression Engine
 * Xử lý nén, resize, chuyển đổi định dạng ảnh bằng browser-image-compression + Canvas
 */
import imageCompression from 'browser-image-compression';

/**
 * @typedef {Object} CompressOptions
 * @property {number} quality - 1–100
 * @property {string} format - 'jpeg' | 'webp' | 'png' | 'original'
 * @property {number} maxWidth - Max width in px
 */

/**
 * @typedef {Object} CompressResult
 * @property {File} originalFile
 * @property {Blob} compressedBlob
 * @property {string} outputName
 * @property {number} originalSize
 * @property {number} compressedSize
 * @property {number} reduction - percentage reduction
 * @property {string} originalUrl
 * @property {string} compressedUrl
 */

const MIME_MAP = {
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  png: 'image/png',
};

const EXT_MAP = {
  jpeg: '.jpg',
  webp: '.webp',
  png: '.png',
};

/**
 * Get output MIME type
 */
function getOutputMime(format, originalType) {
  if (format === 'original') {
    if (originalType === 'image/png') return 'image/png';
    if (originalType === 'image/webp') return 'image/webp';
    return 'image/jpeg';
  }
  return MIME_MAP[format] || 'image/jpeg';
}

/**
 * Get output extension
 */
function getOutputExt(format, originalType) {
  if (format === 'original') {
    if (originalType === 'image/png') return '.png';
    if (originalType === 'image/webp') return '.webp';
    return '.jpg';
  }
  return EXT_MAP[format] || '.jpg';
}

/**
 * Remove extension from filename
 */
function removeExtension(filename) {
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Generate output filename based on rename pattern
 */
function generateOutputName(originalName, index, pattern, ext) {
  const baseName = removeExtension(originalName);
  if (!pattern || pattern.trim() === '') {
    return baseName + ext;
  }
  return pattern
    .replace(/\{n\}/g, String(index + 1))
    .replace(/\{name\}/g, baseName) + ext;
}

/**
 * Compress a single image file
 * @param {File} file
 * @param {CompressOptions} options
 * @param {number} index
 * @param {string} renamePattern
 * @returns {Promise<CompressResult>}
 */
export async function compressSingleImage(file, options, index = 0, renamePattern = '') {
  const { quality, format, maxWidth } = options;

  const outputMime = getOutputMime(format, file.type);
  const outputExt = getOutputExt(format, file.type);
  const outputName = generateOutputName(file.name, index, renamePattern, outputExt);

  // browser-image-compression options
  const compressionOptions = {
    maxSizeMB: 50, // no real size limit, we use quality
    maxWidthOrHeight: maxWidth,
    useWebWorker: true,
    fileType: outputMime,
    initialQuality: quality / 100,
    preserveExif: false,
  };

  // For PNG with lossless, we skip quality
  if (outputMime === 'image/png') {
    compressionOptions.initialQuality = 1;
    // PNG is lossless, resize still applies
  }

  const compressedFile = await imageCompression(file, compressionOptions);

  // Convert to correct format if needed (browser-image-compression might not handle all conversions)
  let finalBlob = compressedFile;

  // If format conversion is needed, use Canvas as fallback
  if (compressedFile.type !== outputMime) {
    finalBlob = await convertBlobFormat(compressedFile, outputMime, quality / 100, maxWidth);
  }

  const originalUrl = URL.createObjectURL(file);
  const compressedUrl = URL.createObjectURL(finalBlob);

  const originalSize = file.size;
  const compressedSize = finalBlob.size;
  const reduction = originalSize > 0
    ? Math.round((1 - compressedSize / originalSize) * 100)
    : 0;

  return {
    originalFile: file,
    compressedBlob: finalBlob,
    outputName,
    originalSize,
    compressedSize,
    reduction,
    originalUrl,
    compressedUrl,
  };
}

/**
 * Convert blob to different format using Canvas
 */
async function convertBlobFormat(blob, mime, quality, maxWidth) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > maxWidth) {
        const ratio = maxWidth / w;
        w = maxWidth;
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (resultBlob) => {
          if (resultBlob) resolve(resultBlob);
          else reject(new Error('Canvas toBlob failed'));
        },
        mime,
        mime === 'image/png' ? undefined : quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed for format conversion'));
    };

    img.src = url;
  });
}

/**
 * Batch compress images sequentially (to avoid memory issues with large images)
 * @param {File[]} files
 * @param {CompressOptions} options
 * @param {string} renamePattern
 * @param {(progress: number, current: number, total: number) => void} onProgress
 * @returns {Promise<CompressResult[]>}
 */
export async function compressBatch(files, options, renamePattern = '', onProgress) {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    try {
      const result = await compressSingleImage(files[i], options, i, renamePattern);
      results.push(result);
    } catch (err) {
      console.error(`Error compressing ${files[i].name}:`, err);
      // Push a failed result
      results.push({
        originalFile: files[i],
        compressedBlob: null,
        outputName: files[i].name,
        originalSize: files[i].size,
        compressedSize: files[i].size,
        reduction: 0,
        originalUrl: URL.createObjectURL(files[i]),
        compressedUrl: null,
        error: err.message,
      });
    }

    const progress = Math.round(((i + 1) / total) * 100);
    if (onProgress) onProgress(progress, i + 1, total);
  }

  return results;
}

/**
 * Rotate an image file by degrees
 * @param {File|Blob} file
 * @param {number} degrees - 90, 180, 270, -90
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export function rotateImage(file, degrees) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const rad = (degrees * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));

      const w = img.naturalWidth;
      const h = img.naturalHeight;

      const newW = Math.round(w * cos + h * sin);
      const newH = Math.round(w * sin + h * cos);

      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;

      const ctx = canvas.getContext('2d');
      ctx.translate(newW / 2, newH / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2);

      canvas.toBlob((blob) => {
        if (blob) resolve({ blob, width: newW, height: newH });
        else reject(new Error('Rotate failed'));
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}

/**
 * Crop an image
 * @param {File|Blob} file
 * @param {{x: number, y: number, width: number, height: number}} cropRect - normalized to actual pixel values
 * @returns {Promise<Blob>}
 */
export function cropImage(file, cropRect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = cropRect.width;
      canvas.height = cropRect.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        cropRect.x, cropRect.y, cropRect.width, cropRect.height,
        0, 0, cropRect.width, cropRect.height
      );

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Crop failed'));
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}
