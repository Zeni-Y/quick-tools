import { toast, setupDrop } from './utils.js';

const mainCanvas = document.getElementById('main-canvas');
const mainCtx = mainCanvas.getContext('2d');
const overlayCanvas = document.getElementById('overlay-canvas');
const overlayCtx = overlayCanvas.getContext('2d');
const canvasWrap = document.getElementById('img-canvas-wrap');
const brushSlider = document.getElementById('brush-size');
const brushVal = document.getElementById('brush-val');
const blockSlider = document.getElementById('block-size');
const blockVal = document.getElementById('block-val');
const blurSlider = document.getElementById('blur-radius');
const blurVal = document.getElementById('blur-val');
const featherSlider = document.getElementById('feather-radius');
const featherVal = document.getElementById('feather-val');
const mosaicMode = document.getElementById('mosaic-mode');
const undoBtn = document.getElementById('undo-mosaic');
const redoBtn = document.getElementById('redo-mosaic');
const applyBtn = document.getElementById('apply-mosaic');

let originalImageData = null;
let originalFileName = '';

// ── Undo / Redo stack ──
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 30;

function pushUndo() {
  undoStack.push(mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack = [];
  updateUndoRedoButtons();
}

function performUndo() {
  if (undoStack.length === 0) return;
  redoStack.push(mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height));
  mainCtx.putImageData(undoStack.pop(), 0, 0);
  updateUndoRedoButtons();
  toast('元に戻しました');
}

function performRedo() {
  if (redoStack.length === 0) return;
  undoStack.push(mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height));
  mainCtx.putImageData(redoStack.pop(), 0, 0);
  updateUndoRedoButtons();
  toast('やり直しました');
}

function updateUndoRedoButtons() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

// ── Tool state ──
let currentTool = 'brush'; // 'brush' | 'rect' | 'ellipse'

// Mask canvas — stores the painted / shaped region
let maskCanvas = null;
let maskCtx = null;
let hasMask = false;

let isInteracting = false;
let lastPoint = null;
let dragStart = null; // for rect/ellipse

function isMosaicActive() {
  const btn = document.querySelector('.sub-nav-btn[data-subtab="mosaic"]');
  return btn && btn.classList.contains('active');
}

// ── Tool switching ──
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    // Show brush size only for brush tool
    document.getElementById('brush-size-label').style.display = currentTool === 'brush' ? '' : 'none';
    clearOverlay();
    if (hasMask) drawMaskPreview();
  });
});

// ── Mode switching ──
mosaicMode.addEventListener('change', () => {
  const isBlock = mosaicMode.value === 'block';
  document.getElementById('block-size-label').style.display = isBlock ? '' : 'none';
  document.getElementById('blur-radius-label').style.display = isBlock ? 'none' : '';
});

brushSlider.addEventListener('input', () => { brushVal.textContent = brushSlider.value + 'px'; });
blockSlider.addEventListener('input', () => { blockVal.textContent = blockSlider.value + 'px'; });
blurSlider.addEventListener('input', () => { blurVal.textContent = blurSlider.value; });
featherSlider.addEventListener('input', () => { featherVal.textContent = featherSlider.value + 'px'; });

// ── Image loading ──
function loadImage(file) {
  if (!file.type.startsWith('image/')) { toast('画像ファイルを選択してください', true); return; }
  originalFileName = file.name.replace(/\.[^.]+$/, '');
  const img = new Image();
  img.onload = () => {
    mainCanvas.width = img.naturalWidth;
    mainCanvas.height = img.naturalHeight;
    overlayCanvas.width = img.naturalWidth;
    overlayCanvas.height = img.naturalHeight;
    mainCtx.drawImage(img, 0, 0);
    originalImageData = mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
    undoStack = [];
    redoStack = [];
    initMask();
    canvasWrap.style.display = 'block';
    applyBtn.disabled = true;
    updateUndoRedoButtons();
    clearOverlay();
    toast('画像を読み込みました');
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}

setupDrop('img-drop', 'img-input', loadImage);

function initMask() {
  maskCanvas = document.createElement('canvas');
  maskCanvas.width = mainCanvas.width;
  maskCanvas.height = mainCanvas.height;
  maskCtx = maskCanvas.getContext('2d');
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  hasMask = false;
}

// ── Coordinate helper ──
function canvasCoords(e) {
  const rect = overlayCanvas.getBoundingClientRect();
  const scaleX = overlayCanvas.width / rect.width;
  const scaleY = overlayCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function clearOverlay() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// ── Overlay drawing helpers ──
function drawMaskPreview() {
  overlayCtx.save();
  overlayCtx.globalAlpha = 0.3;
  overlayCtx.drawImage(maskCanvas, 0, 0);
  overlayCtx.restore();
}

function drawBrushCursor(x, y) {
  const r = parseInt(brushSlider.value) / 2;
  overlayCtx.save();
  overlayCtx.strokeStyle = 'rgba(108,99,255,0.8)';
  overlayCtx.lineWidth = 2;
  overlayCtx.beginPath();
  overlayCtx.arc(x, y, r, 0, Math.PI * 2);
  overlayCtx.stroke();
  overlayCtx.restore();
}

function drawShapePreview(x0, y0, x1, y1) {
  const sx = Math.min(x0, x1), sy = Math.min(y0, y1);
  const sw = Math.abs(x1 - x0), sh = Math.abs(y1 - y0);
  overlayCtx.save();
  overlayCtx.strokeStyle = 'rgba(108,99,255,0.9)';
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([6, 4]);
  overlayCtx.fillStyle = 'rgba(108,99,255,0.15)';
  if (currentTool === 'rect') {
    overlayCtx.strokeRect(sx, sy, sw, sh);
    overlayCtx.fillRect(sx, sy, sw, sh);
  } else {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const rx = sw / 2, ry = sh / 2;
    overlayCtx.beginPath();
    overlayCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    overlayCtx.stroke();
    overlayCtx.fill();
  }
  overlayCtx.setLineDash([]);
  overlayCtx.restore();
}

// ── Brush painting ──
function paintOnMask(x, y) {
  const r = parseInt(brushSlider.value) / 2;
  maskCtx.fillStyle = '#6c63ff';
  maskCtx.beginPath();
  maskCtx.arc(x, y, r, 0, Math.PI * 2);
  maskCtx.fill();
}

function paintLine(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = Math.max(2, parseInt(brushSlider.value) / 6);
  const steps = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    paintOnMask(x0 + dx * t, y0 + dy * t);
  }
}

// ── Shape stamping onto mask ──
function stampShape(x0, y0, x1, y1) {
  const sx = Math.min(x0, x1), sy = Math.min(y0, y1);
  const sw = Math.abs(x1 - x0), sh = Math.abs(y1 - y0);
  if (sw < 4 || sh < 4) return false;
  maskCtx.fillStyle = '#6c63ff';
  if (currentTool === 'rect') {
    maskCtx.fillRect(sx, sy, sw, sh);
  } else {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    maskCtx.beginPath();
    maskCtx.ellipse(cx, cy, sw / 2, sh / 2, 0, 0, Math.PI * 2);
    maskCtx.fill();
  }
  return true;
}

// ── Refresh overlay (mask preview + cursor/shape) ──
function refreshOverlay(cursorPos) {
  clearOverlay();
  if (hasMask) drawMaskPreview();
  if (cursorPos && currentTool === 'brush') drawBrushCursor(cursorPos.x, cursorPos.y);
  if (isInteracting && dragStart && currentTool !== 'brush' && cursorPos) {
    drawShapePreview(dragStart.x, dragStart.y, cursorPos.x, cursorPos.y);
  }
}

// ── Mouse events ──
overlayCanvas.addEventListener('mousedown', e => {
  if (!originalImageData || !isMosaicActive()) return;
  isInteracting = true;
  const pos = canvasCoords(e);
  dragStart = pos;
  lastPoint = pos;
  if (currentTool === 'brush') {
    paintOnMask(pos.x, pos.y);
    hasMask = true;
    applyBtn.disabled = false;
  }
  refreshOverlay(pos);
});

overlayCanvas.addEventListener('mousemove', e => {
  if (!originalImageData || !isMosaicActive()) return;
  const pos = canvasCoords(e);
  if (isInteracting) {
    if (currentTool === 'brush' && lastPoint) {
      paintLine(lastPoint.x, lastPoint.y, pos.x, pos.y);
      lastPoint = pos;
    }
  }
  refreshOverlay(pos);
});

overlayCanvas.addEventListener('mouseup', e => {
  if (!isInteracting) return;
  const pos = canvasCoords(e);
  if (currentTool !== 'brush' && dragStart) {
    if (stampShape(dragStart.x, dragStart.y, pos.x, pos.y)) {
      hasMask = true;
      applyBtn.disabled = false;
    }
  }
  isInteracting = false;
  lastPoint = null;
  dragStart = null;
  refreshOverlay(pos);
});

overlayCanvas.addEventListener('mouseleave', () => {
  isInteracting = false;
  lastPoint = null;
  dragStart = null;
  clearOverlay();
  if (hasMask) drawMaskPreview();
});

// ── Touch events ──
overlayCanvas.addEventListener('touchstart', e => {
  if (!originalImageData || !isMosaicActive()) return;
  e.preventDefault();
  isInteracting = true;
  const pos = canvasCoords(e.touches[0]);
  dragStart = pos;
  lastPoint = pos;
  if (currentTool === 'brush') {
    paintOnMask(pos.x, pos.y);
    hasMask = true;
    applyBtn.disabled = false;
  }
  refreshOverlay(pos);
}, { passive: false });

overlayCanvas.addEventListener('touchmove', e => {
  if (!originalImageData || !isMosaicActive()) return;
  e.preventDefault();
  const pos = canvasCoords(e.touches[0]);
  if (isInteracting) {
    if (currentTool === 'brush' && lastPoint) {
      paintLine(lastPoint.x, lastPoint.y, pos.x, pos.y);
      lastPoint = pos;
    }
  }
  refreshOverlay(pos);
}, { passive: false });

overlayCanvas.addEventListener('touchend', e => {
  if (!isInteracting) return;
  const pos = canvasCoords(e.changedTouches[0]);
  if (currentTool !== 'brush' && dragStart) {
    if (stampShape(dragStart.x, dragStart.y, pos.x, pos.y)) {
      hasMask = true;
      applyBtn.disabled = false;
    }
  }
  isInteracting = false;
  lastPoint = null;
  dragStart = null;
  clearOverlay();
  if (hasMask) drawMaskPreview();
});

// ── Feathered mask generation ──
function createFeatheredAlpha() {
  const w = maskCanvas.width, h = maskCanvas.height;
  const featherR = parseInt(featherSlider.value);
  const maskData = maskCtx.getImageData(0, 0, w, h).data;
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    alpha[i] = maskData[i * 4 + 3] > 0 ? 1.0 : 0.0;
  }
  if (featherR <= 0) return alpha;

  const temp = new Float32Array(w * h);
  const radius = Math.ceil(featherR);

  function boxBlurH(src, dst, r) {
    const iarr = 1 / (r + r + 1);
    for (let y = 0; y < h; y++) {
      let ti = y * w, li = ti, ri = ti + r;
      let val = src[ti] * (r + 1);
      for (let j = 0; j < r; j++) val += src[ti + Math.min(j, w - 1)];
      for (let x = 0; x <= r && x < w; x++) {
        val += src[Math.min(ri, y * w + w - 1)]; ri++;
        dst[ti++] = val * iarr;
      }
      for (let x = r + 1; x < w - r; x++) {
        val += src[ri] - src[li]; ri++; li++;
        dst[ti++] = val * iarr;
      }
      for (let x = Math.max(w - r, r + 1); x < w; x++) {
        val += src[y * w + w - 1] - src[li]; li++;
        dst[ti++] = val * iarr;
      }
    }
  }

  function boxBlurV(src, dst, r) {
    const iarr = 1 / (r + r + 1);
    for (let x = 0; x < w; x++) {
      let ti = x, li = ti, ri = ti + r * w;
      let val = src[ti] * (r + 1);
      for (let j = 0; j < r; j++) val += src[ti + Math.min(j, h - 1) * w];
      for (let y = 0; y <= r && y < h; y++) {
        val += src[Math.min(ri, x + (h - 1) * w)]; ri += w;
        dst[ti] = val * iarr; ti += w;
      }
      for (let y = r + 1; y < h - r; y++) {
        val += src[ri] - src[li]; ri += w; li += w;
        dst[ti] = val * iarr; ti += w;
      }
      for (let y = Math.max(h - r, r + 1); y < h; y++) {
        val += src[x + (h - 1) * w] - src[li]; li += w;
        dst[ti] = val * iarr; ti += w;
      }
    }
  }

  // 3-pass box blur ≈ gaussian
  boxBlurH(alpha, temp, radius);
  boxBlurV(temp, alpha, radius);
  boxBlurH(alpha, temp, radius);
  boxBlurV(temp, alpha, radius);
  boxBlurH(alpha, temp, radius);
  boxBlurV(temp, alpha, radius);

  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = Math.min(1.0, Math.max(0.0, alpha[i]));
  }
  return alpha;
}

// ── Apply mosaic/blur with feathered mask ──
function applyMosaicWithMask() {
  const w = mainCanvas.width, h = mainCanvas.height;

  // Generate effect canvas
  const effectCanvas = document.createElement('canvas');
  effectCanvas.width = w;
  effectCanvas.height = h;
  const effectCtx = effectCanvas.getContext('2d');
  effectCtx.drawImage(mainCanvas, 0, 0);

  if (mosaicMode.value === 'block') {
    const blockSize = parseInt(blockSlider.value);
    const imgData = effectCtx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let by = 0; by < h; by += blockSize) {
      for (let bx = 0; bx < w; bx += blockSize) {
        let r = 0, g = 0, b = 0, count = 0;
        const maxY = Math.min(by + blockSize, h);
        const maxX = Math.min(bx + blockSize, w);
        for (let y = by; y < maxY; y++) {
          for (let x = bx; x < maxX; x++) {
            const i = (y * w + x) * 4;
            r += d[i]; g += d[i + 1]; b += d[i + 2]; count++;
          }
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        for (let y = by; y < maxY; y++) {
          for (let x = bx; x < maxX; x++) {
            const i = (y * w + x) * 4;
            d[i] = r; d[i + 1] = g; d[i + 2] = b;
          }
        }
      }
    }
    effectCtx.putImageData(imgData, 0, 0);
  } else {
    const radius = parseInt(blurSlider.value);
    effectCtx.filter = `blur(${radius}px)`;
    effectCtx.drawImage(mainCanvas, 0, 0);
    effectCtx.filter = 'none';
  }

  const alphaMap = createFeatheredAlpha();
  const origData = mainCtx.getImageData(0, 0, w, h);
  const effectData = effectCtx.getImageData(0, 0, w, h);
  const od = origData.data, ed = effectData.data;

  for (let i = 0; i < w * h; i++) {
    const a = alphaMap[i];
    const j = i * 4;
    od[j]     = Math.round(od[j]     * (1 - a) + ed[j]     * a);
    od[j + 1] = Math.round(od[j + 1] * (1 - a) + ed[j + 1] * a);
    od[j + 2] = Math.round(od[j + 2] * (1 - a) + ed[j + 2] * a);
  }

  mainCtx.putImageData(origData, 0, 0);
}

// ── Apply button ──
applyBtn.addEventListener('click', () => {
  if (!hasMask) return;
  pushUndo();
  applyMosaicWithMask();
  clearOverlay();
  initMask();
  applyBtn.disabled = true;
  toast((mosaicMode.value === 'block' ? 'モザイク' : 'ブラー') + 'を適用しました');
});

// ── Undo / Redo buttons ──
undoBtn.addEventListener('click', performUndo);
redoBtn.addEventListener('click', performRedo);

// ── Reset ──
document.getElementById('img-reset').addEventListener('click', () => {
  if (!originalImageData) return;
  pushUndo();
  mainCtx.putImageData(originalImageData, 0, 0);
  initMask();
  clearOverlay();
  applyBtn.disabled = true;
  toast('リセットしました');
});

// ── Download ──
function downloadCanvas(format) {
  const link = document.createElement('a');
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpg' ? '.jpg' : '.png';
  const suffix = mosaicMode.value === 'block' ? '_mosaic' : '_blurred';
  link.download = (originalFileName || 'image') + suffix + ext;
  link.href = mainCanvas.toDataURL(mime, 0.92);
  link.click();
  toast(ext.toUpperCase().slice(1) + ' を保存しました');
}
document.getElementById('dl-png').addEventListener('click', () => downloadCanvas('png'));
document.getElementById('dl-jpg').addEventListener('click', () => downloadCanvas('jpg'));

// ── Keyboard shortcuts ──
document.addEventListener('keydown', e => {
  // Only when mosaic tab is active
  if (!isMosaicActive()) return;
  // Don't intercept when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

  // Ctrl+Z / Cmd+Z — undo
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
    e.preventDefault();
    performUndo();
    return;
  }
  // Ctrl+Y / Cmd+Y or Ctrl+Shift+Z — redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault();
    performRedo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
    e.preventDefault();
    performRedo();
    return;
  }

  // Tool switching keys (no modifiers)
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  switch (e.key.toLowerCase()) {
    case 'b':
      switchTool('brush');
      break;
    case 'r':
      switchTool('rect');
      break;
    case 'e':
      switchTool('ellipse');
      break;
  }
});

function switchTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('brush-size-label').style.display = tool === 'brush' ? '' : 'none';
  clearOverlay();
  if (hasMask) drawMaskPreview();
}
