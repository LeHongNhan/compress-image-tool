/**
 * Before / After Compare Slider
 */

export class CompareSlider {
  constructor() {
    this.modal = document.getElementById('compareModal');
    this.container = document.getElementById('compareContainer');
    this.overlay = document.getElementById('compareOverlay');
    this.slider = document.getElementById('compareSlider');
    this.originalImg = document.getElementById('compareOriginal');
    this.compressedImg = document.getElementById('compareCompressed');

    this._isDragging = false;
    this._bindEvents();
  }

  _bindEvents() {
    document.getElementById('compareClose').addEventListener('click', () => this.close());
    this.modal.querySelector('.modal__backdrop').addEventListener('click', () => this.close());

    // Slider drag
    this.container.addEventListener('mousedown', (e) => this._startDrag(e));
    this.container.addEventListener('touchstart', (e) => this._startDrag(e), { passive: false });
    document.addEventListener('mousemove', (e) => this._onDrag(e));
    document.addEventListener('touchmove', (e) => this._onDrag(e), { passive: false });
    document.addEventListener('mouseup', () => this._endDrag());
    document.addEventListener('touchend', () => this._endDrag());
  }

  /**
   * Open compare modal
   * @param {string} originalUrl
   * @param {string} compressedUrl
   * @param {number} originalSize
   * @param {number} compressedSize
   */
  open(originalUrl, compressedUrl, originalSize, compressedSize) {
    this.originalImg.src = originalUrl;
    this.compressedImg.src = compressedUrl;

    // Reset slider to center
    this._setPosition(50);

    // Set info
    const formatB = (b) => {
      if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
      return (b / 1024).toFixed(1) + ' KB';
    };

    document.getElementById('compareOrigSize').textContent = formatB(originalSize);
    document.getElementById('compareCompSize').textContent = formatB(compressedSize);

    const reduction = originalSize > 0
      ? Math.round((1 - compressedSize / originalSize) * 100)
      : 0;
    document.getElementById('compareReduction').textContent = reduction + '%';

    this.modal.classList.remove('hidden');
  }

  close() {
    this.modal.classList.add('hidden');
  }

  _startDrag(e) {
    e.preventDefault();
    this._isDragging = true;
    this._updateFromEvent(e);
  }

  _onDrag(e) {
    if (!this._isDragging) return;
    e.preventDefault();
    this._updateFromEvent(e);
  }

  _endDrag() {
    this._isDragging = false;
  }

  _updateFromEvent(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = this.container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    this._setPosition(percent);
  }

  _setPosition(percent) {
    this.overlay.style.width = percent + '%';
    this.slider.style.left = percent + '%';
  }
}
