/**
 * ZIP Engine
 * Đóng gói nhiều file thành ZIP bằng JSZip
 */
import JSZip from 'jszip';

/**
 * Create a ZIP file from compressed results
 * @param {Array<{outputName: string, compressedBlob: Blob}>} results
 * @returns {Promise<Blob>}
 */
export async function createZipFromResults(results) {
  const zip = new JSZip();

  const nameCount = {};

  for (const result of results) {
    if (!result.compressedBlob) continue;

    let name = result.outputName;

    // Handle duplicate names
    if (nameCount[name]) {
      nameCount[name]++;
      const ext = name.match(/\.[^/.]+$/)?.[0] || '';
      const base = name.replace(/\.[^/.]+$/, '');
      name = `${base}_${nameCount[name]}${ext}`;
    } else {
      nameCount[name] = 1;
    }

    zip.file(name, result.compressedBlob);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 }, // Fast compression, images already compressed
  });

  return zipBlob;
}

/**
 * Trigger download of a Blob
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
