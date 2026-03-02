/**
 * Image Editor Module
 * Handles rotate & crop functionality in a modal
 */
import { rotateImage, cropImage } from './compressor.js';

export class ImageEditor {
  constructor() {
    this.modal = document.getElementById('editorModal');
    this.canvas = document.getElementById('editorCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvasWrap = this.canvas.parentElement;

    this.currentFile = null;
    this.currentImg = null;
    this.rotation = 0;
    this.isCropping = false;
    this.cropRect = null;
    this.cropOverlay = null;
    this.onSave = null;
    this.fileIndex = -1;

    this._bindEvents();
  }

  _bindEvents() {
    document.getElementById('editorClose').addEventListener('click', () => this.close());
    document.getElementById('editorCancelBtn').addEventListener('click', () => this.close());
    document.getElementById('editorSaveBtn').addEventListener('click', () => this._save());

    this.modal.querySelector('.modal__backdrop').addEventListener('click', () => this.close());

    document.getElementById('rotateLeftBtn').addEventListener('click', () => this._rotate(-90));
    document.getElementById('rotateRightBtn').addEventListener('click', () => this._rotate(90));

    document.getElementById('cropToggleBtn').addEventListener('click', () => this._startCrop());
    document.getElementById('cropApplyBtn').addEventListener('click', () => this._applyCrop());
    document.getElementById('cropCancelBtn').addEventListener('click', () => this._cancelCrop());
  }

  /**
   * Open editor with a file
   * @param {File} file
   * @param {number} index
   * @param {(file: File, index: number) => void} onSave
   */
  open(file, index, onSave) {
    this.currentFile = file;
    this.fileIndex = index;
    this.onSave = onSave;
    this.rotation = 0;
    this.isCropping = false;

    document.getElementById('editorTitle').textContent = `Chỉnh sửa: ${file.name}`;
    this.modal.classList.remove('hidden');

    this._loadImage(file);
  }

  close() {
    this.modal.classList.add('hidden');
    this._cancelCrop();
    if (this.currentImg) {
      URL.revokeObjectURL(this.currentImg.src);
    }
  }

  _loadImage(fileOrBlob) {
    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);

    img.onload = () => {
      this.currentImg = img;

      // Scale to fit canvas area
      const maxW = Math.min(this.canvasWrap.clientWidth - 20, 850);
      const maxH = Math.min(window.innerHeight * 0.55, 550);

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > maxW) {
        const ratio = maxW / w;
        w = maxW;
        h = Math.round(h * ratio);
      }
      if (h > maxH) {
        const ratio = maxH / h;
        h = Math.round(h);
        w = Math.round(w * ratio);
        h = maxH;
      }

      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.clearRect(0, 0, w, h);
      this.ctx.drawImage(img, 0, 0, w, h);

      this._displayW = w;
      this._displayH = h;
      this._naturalW = img.naturalWidth;
      this._naturalH = img.naturalHeight;
    };

    img.src = url;
  }

  async _rotate(degrees) {
    if (!this.currentFile) return;

    try {
      const { blob } = await rotateImage(this.currentFile, degrees);
      // Create a new File from the blob
      const rotatedFile = new File([blob], this.currentFile.name, { type: 'image/png' });
      this.currentFile = rotatedFile;
      this.rotation += degrees;
      this._loadImage(rotatedFile);
    } catch (err) {
      console.error('Rotate error:', err);
    }
  }

  _startCrop() {
    if (this.isCropping) return;
    this.isCropping = true;

    document.getElementById('cropToggleBtn').classList.add('hidden');
    document.getElementById('cropApplyBtn').classList.remove('hidden');
    document.getElementById('cropCancelBtn').classList.remove('hidden');

    // Create crop overlay
    const overlay = document.createElement('div');
    overlay.className = 'crop-overlay';

    const startW = Math.round(this._displayW * 0.6);
    const startH = Math.round(this._displayH * 0.6);
    const startX = Math.round((this._displayW - startW) / 2);
    const startY = Math.round((this._displayH - startH) / 2);

    overlay.style.left = startX + 'px';
    overlay.style.top = startY + 'px';
    overlay.style.width = startW + 'px';
    overlay.style.height = startH + 'px';

    // Corner handles
    ['tl', 'tr', 'bl', 'br'].forEach(pos => {
      const handle = document.createElement('div');
      handle.className = `crop-handle crop-handle--${pos}`;
      handle.dataset.pos = pos;
      overlay.appendChild(handle);
    });

    this.canvasWrap.style.position = 'relative';
    this.canvasWrap.appendChild(overlay);
    this.cropOverlay = overlay;

    this._initCropDrag(overlay);
  }

  _initCropDrag(overlay) {
    let isDragging = false;
    let isResizing = false;
    let resizeHandle = '';
    let startMX, startMY, startL, startT, startW, startH;

    const onMouseDown = (e) => {
      e.preventDefault();
      const target = e.target;
      startMX = e.clientX;
      startMY = e.clientY;
      startL = parseInt(overlay.style.left);
      startT = parseInt(overlay.style.top);
      startW = parseInt(overlay.style.width);
      startH = parseInt(overlay.style.height);

      if (target.classList.contains('crop-handle')) {
        isResizing = true;
        resizeHandle = target.dataset.pos;
      } else {
        isDragging = true;
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      const dx = e.clientX - startMX;
      const dy = e.clientY - startMY;

      if (isDragging) {
        let newL = Math.max(0, Math.min(startL + dx, this._displayW - startW));
        let newT = Math.max(0, Math.min(startT + dy, this._displayH - startH));
        overlay.style.left = newL + 'px';
        overlay.style.top = newT + 'px';
      }

      if (isResizing) {
        let newL = startL, newT = startT, newW = startW, newH = startH;

        if (resizeHandle.includes('r')) newW = Math.max(30, startW + dx);
        if (resizeHandle.includes('l')) { newL = startL + dx; newW = Math.max(30, startW - dx); }
        if (resizeHandle.includes('b')) newH = Math.max(30, startH + dy);
        if (resizeHandle.includes('t')) { newT = startT + dy; newH = Math.max(30, startH - dy); }

        // Clamp
        newL = Math.max(0, newL);
        newT = Math.max(0, newT);
        newW = Math.min(newW, this._displayW - newL);
        newH = Math.min(newH, this._displayH - newT);

        overlay.style.left = newL + 'px';
        overlay.style.top = newT + 'px';
        overlay.style.width = newW + 'px';
        overlay.style.height = newH + 'px';
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    overlay.addEventListener('mousedown', onMouseDown);
  }

  async _applyCrop() {
    if (!this.cropOverlay || !this.currentFile) return;

    // Get crop rectangle in display coordinates
    const dL = parseInt(this.cropOverlay.style.left);
    const dT = parseInt(this.cropOverlay.style.top);
    const dW = parseInt(this.cropOverlay.style.width);
    const dH = parseInt(this.cropOverlay.style.height);

    // Convert to natural image coordinates
    const scaleX = this._naturalW / this._displayW;
    const scaleY = this._naturalH / this._displayH;

    const cropRect = {
      x: Math.round(dL * scaleX),
      y: Math.round(dT * scaleY),
      width: Math.round(dW * scaleX),
      height: Math.round(dH * scaleY),
    };

    try {
      const blob = await cropImage(this.currentFile, cropRect);
      const croppedFile = new File([blob], this.currentFile.name, { type: 'image/png' });
      this.currentFile = croppedFile;
      this._cancelCrop();
      this._loadImage(croppedFile);
    } catch (err) {
      console.error('Crop error:', err);
    }
  }

  _cancelCrop() {
    this.isCropping = false;
    if (this.cropOverlay) {
      this.cropOverlay.remove();
      this.cropOverlay = null;
    }
    document.getElementById('cropToggleBtn').classList.remove('hidden');
    document.getElementById('cropApplyBtn').classList.add('hidden');
    document.getElementById('cropCancelBtn').classList.add('hidden');
  }

  _save() {
    if (this.onSave && this.currentFile) {
      this.onSave(this.currentFile, this.fileIndex);
    }
    this.close();
  }
}
