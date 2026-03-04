/**
 * Main Application
 * Compress Image Tool — Client-side only
 */
import './styles.css';
import { compressBatch } from './compressor.js';
import { createZipFromResults, downloadBlob } from './zip.js';
import { formatBytes, getReductionClass, el, show, hide } from './utils.js';
import { ImageEditor } from './editor.js';
import { CompareSlider } from './compare.js';
import { applyWatermark, loadImage, renderWatermarkPreview, DEFAULT_WATERMARK_CONFIG } from './watermark.js';

// ============================================
// State
// ============================================
const state = {
  files: [],           // File[]
  results: [],         // CompressResult[]
  settings: {
    quality: 80,
    format: 'webp',
    maxWidth: 1920,
    renamePattern: '',
  },
  watermark: { ...DEFAULT_WATERMARK_CONFIG },
  logoFile: null,      // File (logo PNG)
  logoImg: null,       // HTMLImageElement (pre-loaded)
  status: 'IDLE',     // IDLE | COMPRESSING | COMPLETED
};

// ============================================
// DOM References
// ============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dropZone = $('#dropZone');
const fileInput = $('#fileInput');
const previewSection = $('#previewSection');
const previewGrid = $('#previewGrid');
const imageCount = $('#imageCount');
const clearAllBtn = $('#clearAllBtn');
const addMoreBtn = $('#addMoreBtn');
const settingsSection = $('#settingsSection');
const qualitySlider = $('#qualitySlider');
const qualityValue = $('#qualityValue');
const maxWidthInput = $('#maxWidthInput');
const renamePattern = $('#renamePattern');
const compressBtn = $('#compressBtn');
const progressSection = $('#progressSection');
const progressFill = $('#progressFill');
const progressText = $('#progressText');
const progressDetail = $('#progressDetail');
const resultsSection = $('#resultsSection');
const resultsSummary = $('#resultsSummary');
const resultsGrid = $('#resultsGrid');
const downloadAllBtn = $('#downloadAllBtn');

// Watermark DOM
const watermarkEnabled = $('#watermarkEnabled');
const watermarkConfig = $('#watermarkConfig');
const logoDropZone = $('#logoDropZone');
const logoInput = $('#logoInput');
const logoPlaceholder = $('#logoPlaceholder');
const logoPreviewWrap = $('#logoPreviewWrap');
const logoPreviewImg = $('#logoPreviewImg');
const logoRemoveBtn = $('#logoRemoveBtn');
const wmOpacitySlider = $('#wmOpacitySlider');
const wmOpacityValue = $('#wmOpacityValue');
const wmScaleSlider = $('#wmScaleSlider');
const wmScaleValue = $('#wmScaleValue');
const wmMarginSlider = $('#wmMarginSlider');
const wmMarginValue = $('#wmMarginValue');
const wmTileGapSlider = $('#wmTileGapSlider');
const wmTileGapValue = $('#wmTileGapValue');
const wmTileRotSlider = $('#wmTileRotSlider');
const wmTileRotValue = $('#wmTileRotValue');
const wmPositionCard = $('#wmPositionCard');
const wmTileCard = $('#wmTileCard');
const wmPreviewCanvas = $('#wmPreviewCanvas');
const wmPreviewHint = $('#wmPreviewHint');

// Modules
const editor = new ImageEditor();
const compare = new CompareSlider();

// ============================================
// Drop Zone & File Input
// ============================================
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drop-zone--active');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drop-zone--active');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drop-zone--active');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  addFiles(files);
});

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  addFiles(files);
  fileInput.value = '';
});

addMoreBtn.addEventListener('click', () => {
  fileInput.click();
});

clearAllBtn.addEventListener('click', () => {
  state.files = [];
  state.results = [];
  state.status = 'IDLE';
  renderPreview();
  hide(previewSection);
  hide(settingsSection);
  hide(resultsSection);
  hide(progressSection);
});

// ============================================
// Add Files
// ============================================
function addFiles(newFiles) {
  const maxFiles = 50;
  const remaining = maxFiles - state.files.length;
  const toAdd = newFiles.slice(0, remaining);

  if (toAdd.length === 0) {
    alert('Đã đạt giới hạn 50 ảnh!');
    return;
  }

  state.files.push(...toAdd);
  state.status = 'IDLE';
  state.results = [];

  renderPreview();
  show(previewSection);
  show(settingsSection);
  hide(resultsSection);
  hide(progressSection);

  // Scroll to preview
  previewSection.scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// Preview Rendering
// ============================================
function renderPreview() {
  previewGrid.innerHTML = '';
  imageCount.textContent = state.files.length;

  if (state.files.length === 0) {
    hide(previewSection);
    hide(settingsSection);
    return;
  }

  state.files.forEach((file, index) => {
    const url = URL.createObjectURL(file);

    const card = el('div', { className: 'preview-card fade-in' }, [
      el('img', { className: 'preview-card__img', src: url, alt: file.name }),
      el('button', {
        className: 'preview-card__remove',
        textContent: '×',
        title: 'Xóa ảnh này',
        onClick: () => removeFile(index),
      }),
      el('div', { className: 'preview-card__info' }, [
        el('div', { className: 'preview-card__name', textContent: file.name, title: file.name }),
        el('div', { className: 'preview-card__size', textContent: formatBytes(file.size) }),
      ]),
      el('div', { className: 'preview-card__actions' }, [
        el('button', {
          className: 'preview-card__btn',
          textContent: '✏️ Sửa',
          onClick: () => openEditor(index),
        }),
      ]),
    ]);

    previewGrid.appendChild(card);
  });
}

function removeFile(index) {
  state.files.splice(index, 1);
  renderPreview();
  if (state.files.length === 0) {
    hide(previewSection);
    hide(settingsSection);
  }
}

function openEditor(index) {
  editor.open(state.files[index], index, (editedFile, idx) => {
    // Replace file with edited version
    state.files[idx] = editedFile;
    renderPreview();
  });
}

// ============================================
// Settings
// ============================================
qualitySlider.addEventListener('input', () => {
  state.settings.quality = parseInt(qualitySlider.value);
  qualityValue.textContent = qualitySlider.value;
});

maxWidthInput.addEventListener('change', () => {
  state.settings.maxWidth = parseInt(maxWidthInput.value) || 1920;
});

renamePattern.addEventListener('input', () => {
  state.settings.renamePattern = renamePattern.value;
});

// Width presets
$$('.btn--tag[data-width]').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.btn--tag[data-width]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const width = parseInt(btn.dataset.width);
    maxWidthInput.value = width;
    state.settings.maxWidth = width;
  });
});

// Format buttons
$$('.btn--format[data-format]').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.btn--format[data-format]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.settings.format = btn.dataset.format;
  });
});

// ============================================
// Watermark Controls
// ============================================

// Toggle watermark panel
watermarkEnabled.addEventListener('change', () => {
  state.watermark.enabled = watermarkEnabled.checked;
  if (watermarkEnabled.checked) {
    show(watermarkConfig);
  } else {
    hide(watermarkConfig);
  }
});

// Logo upload
logoDropZone.addEventListener('click', () => logoInput.click());
logoDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  logoDropZone.style.borderColor = 'var(--primary)';
});
logoDropZone.addEventListener('dragleave', () => {
  logoDropZone.style.borderColor = '';
});
logoDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  logoDropZone.style.borderColor = '';
  const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
  if (file) setLogo(file);
});
logoInput.addEventListener('change', () => {
  if (logoInput.files[0]) setLogo(logoInput.files[0]);
  logoInput.value = '';
});
logoRemoveBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearLogo();
});

async function setLogo(file) {
  state.logoFile = file;
  try {
    state.logoImg = await loadImage(file);
    logoPreviewImg.src = URL.createObjectURL(file);
    show(logoPreviewWrap);
    hide(logoPlaceholder);
    updateWatermarkPreview();
  } catch (err) {
    console.error('Failed to load logo:', err);
    alert('Không thể tải logo. Vui lòng chọn file ảnh hợp lệ.');
  }
}

function clearLogo() {
  state.logoFile = null;
  state.logoImg = null;
  if (logoPreviewImg.src) URL.revokeObjectURL(logoPreviewImg.src);
  logoPreviewImg.src = '';
  hide(logoPreviewWrap);
  show(logoPlaceholder);
  wmPreviewCanvas.classList.remove('visible');
  show(wmPreviewHint);
}

// Mode selection
$$('.wm-mode-card[data-wm-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.wm-mode-card[data-wm-mode]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.watermark.mode = btn.dataset.wmMode;
    updateWatermarkModeUI();
    updateWatermarkPreview();
  });
});

function updateWatermarkModeUI() {
  const mode = state.watermark.mode;
  // Show/hide position card (corner only)
  if (mode === 'corner') {
    show(wmPositionCard);
    show($('#wmMarginCard'));
    hide(wmTileCard);
  } else if (mode === 'tile') {
    hide(wmPositionCard);
    hide($('#wmMarginCard'));
    show(wmTileCard);
  } else {
    hide(wmPositionCard);
    hide($('#wmMarginCard'));
    hide(wmTileCard);
  }
}

// Position buttons (corner mode)
$$('.wm-pos-btn[data-wm-pos]').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.wm-pos-btn[data-wm-pos]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.watermark.position = btn.dataset.wmPos;
    updateWatermarkPreview();
  });
});

// Sliders
wmOpacitySlider.addEventListener('input', () => {
  const v = parseInt(wmOpacitySlider.value);
  state.watermark.opacity = v / 100;
  wmOpacityValue.textContent = v;
  updateWatermarkPreview();
});

wmScaleSlider.addEventListener('input', () => {
  const v = parseInt(wmScaleSlider.value);
  state.watermark.scale = v;
  wmScaleValue.textContent = v;
  updateWatermarkPreview();
});

wmMarginSlider.addEventListener('input', () => {
  const v = parseInt(wmMarginSlider.value);
  state.watermark.margin = v;
  wmMarginValue.textContent = v;
  updateWatermarkPreview();
});

wmTileGapSlider.addEventListener('input', () => {
  const v = parseInt(wmTileGapSlider.value);
  state.watermark.tileGap = v;
  wmTileGapValue.textContent = v;
  updateWatermarkPreview();
});

wmTileRotSlider.addEventListener('input', () => {
  const v = parseInt(wmTileRotSlider.value);
  state.watermark.rotation = v;
  wmTileRotValue.textContent = v;
  updateWatermarkPreview();
});

// Debounced preview update
let wmPreviewTimer = null;
function updateWatermarkPreview() {
  clearTimeout(wmPreviewTimer);
  wmPreviewTimer = setTimeout(doWatermarkPreview, 200);
}

async function doWatermarkPreview() {
  if (!state.logoImg || state.files.length === 0) {
    wmPreviewCanvas.classList.remove('visible');
    show(wmPreviewHint);
    return;
  }
  try {
    await renderWatermarkPreview(wmPreviewCanvas, state.files[0], state.logoImg, state.watermark);
    wmPreviewCanvas.classList.add('visible');
    hide(wmPreviewHint);
  } catch (err) {
    console.error('Preview error:', err);
  }
}

// ============================================
// Compress
// ============================================
compressBtn.addEventListener('click', startCompression);

async function startCompression() {
  if (state.files.length === 0) return;
  if (state.status === 'COMPRESSING') return;

  state.status = 'COMPRESSING';
  state.results = [];

  // Show progress
  show(progressSection);
  hide(resultsSection);
  progressFill.style.width = '0%';
  progressText.textContent = '0';
  progressDetail.textContent = `0/${state.files.length}`;

  // Disable compress button
  compressBtn.disabled = true;
  compressBtn.textContent = '⏳ Đang nén...';

  // Scroll to progress
  progressSection.scrollIntoView({ behavior: 'smooth' });

  // Prepare watermark config for pipeline
  const wmConfig = state.watermark.enabled && state.logoImg
    ? { ...state.watermark, logoImg: state.logoImg }
    : null;

  try {
    const results = await compressBatch(
      state.files,
      state.settings,
      state.settings.renamePattern,
      (progress, current, total) => {
        progressFill.style.width = progress + '%';
        progressText.textContent = progress;
        progressDetail.textContent = `${current}/${total}`;
      },
      wmConfig
    );

    state.results = results;
    state.status = 'COMPLETED';

    hide(progressSection);
    renderResults();
    show(resultsSection);

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Compression error:', err);
    alert('Có lỗi xảy ra khi nén ảnh: ' + err.message);
    state.status = 'IDLE';
    hide(progressSection);
  } finally {
    compressBtn.disabled = false;
    compressBtn.textContent = '🚀 Bắt đầu nén';
  }
}

// ============================================
// Results Rendering
// ============================================
function renderResults() {
  // Summary
  const totalOriginal = state.results.reduce((s, r) => s + r.originalSize, 0);
  const totalCompressed = state.results.reduce((s, r) => s + r.compressedSize, 0);
  const totalReduction = totalOriginal > 0
    ? Math.round((1 - totalCompressed / totalOriginal) * 100)
    : 0;
  const successCount = state.results.filter(r => r.compressedBlob).length;

  resultsSummary.innerHTML = '';
  resultsSummary.appendChild(createSummaryCard(state.results.length, 'Tổng ảnh'));
  resultsSummary.appendChild(createSummaryCard(successCount + '/' + state.results.length, 'Thành công'));
  resultsSummary.appendChild(createSummaryCard(formatBytes(totalOriginal), 'Dung lượng gốc'));
  resultsSummary.appendChild(createSummaryCard(formatBytes(totalCompressed), 'Sau khi nén'));
  resultsSummary.appendChild(createSummaryCard(totalReduction + '%', 'Giảm được', true));

  // Grid
  resultsGrid.innerHTML = '';

  state.results.forEach((result, index) => {
    const reductionClass = getReductionClass(result.reduction);
    const reductionText = result.reduction >= 0
      ? `↓ ${result.reduction}% nhỏ hơn`
      : `↑ ${Math.abs(result.reduction)}% lớn hơn`;

    const hasError = !!result.error;
    const imgSrc = result.compressedUrl || result.originalUrl;

    const card = el('div', { className: 'result-card fade-in' }, [
      el('img', { className: 'result-card__img', src: imgSrc, alt: result.outputName }),
      el('div', { className: 'result-card__body' }, [
        el('div', { className: 'result-card__name', textContent: result.outputName, title: result.outputName }),
        el('div', { className: 'result-card__stats' }, [
          el('span', { textContent: `Gốc: ${formatBytes(result.originalSize)}` }),
          el('span', { textContent: `Nén: ${formatBytes(result.compressedSize)}` }),
        ]),
        el('div', {
          className: `result-card__reduction ${reductionClass}`,
          textContent: hasError ? '❌ Lỗi: ' + result.error : reductionText,
        }),
      ]),
      el('div', { className: 'result-card__actions' }, [
        ...(result.compressedBlob ? [
          el('button', {
            className: 'btn btn--success btn--sm',
            textContent: '⬇️ Tải về',
            onClick: () => downloadBlob(result.compressedBlob, result.outputName),
          }),
          el('button', {
            className: 'btn btn--outline btn--sm',
            textContent: '🔍 So sánh',
            onClick: () => compare.open(
              result.originalUrl,
              result.compressedUrl,
              result.originalSize,
              result.compressedSize
            ),
          }),
        ] : []),
      ]),
    ]);

    resultsGrid.appendChild(card);
  });
}

function createSummaryCard(value, label, isSuccess = false) {
  return el('div', { className: 'summary-card' }, [
    el('div', {
      className: `summary-card__value ${isSuccess ? 'summary-card__value--success' : ''}`,
      textContent: value,
    }),
    el('div', { className: 'summary-card__label', textContent: label }),
  ]);
}

// ============================================
// Download All (ZIP)
// ============================================
downloadAllBtn.addEventListener('click', async () => {
  if (state.results.length === 0) return;

  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = '⏳ Đang tạo ZIP...';

  try {
    const validResults = state.results.filter(r => r.compressedBlob);
    const zipBlob = await createZipFromResults(validResults);
    downloadBlob(zipBlob, 'compressed-images.zip');
  } catch (err) {
    console.error('ZIP error:', err);
    alert('Có lỗi khi tạo file ZIP: ' + err.message);
  } finally {
    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = '📦 Tải tất cả (ZIP)';
  }
});

// ============================================
// Initialize
// ============================================
console.log('🖼️ Compress Image Tool — Ready!');
