import { toast, setupDrop } from './utils.js';

const mainCanvas = document.getElementById('main-canvas');
const mainCtx = mainCanvas.getContext('2d');
const overlayCanvas = document.getElementById('overlay-canvas');
const overlayCtx = overlayCanvas.getContext('2d');
const canvasWrap = document.getElementById('img-canvas-wrap');
const blockSlider = document.getElementById('block-size');
const blockVal = document.getElementById('block-val');
const blurSlider = document.getElementById('blur-radius');
const blurVal = document.getElementById('blur-val');
const mosaicMode = document.getElementById('mosaic-mode');

let originalImageData = null;
let beforeMosaicData = null;
let originalFileName = '';
let selection = null;
let isDragging = false;
let dragStart = null;

// Mode switching
mosaicMode.addEventListener('change', () => {
  const isBlock = mosaicMode.value === 'block';
  document.getElementById('block-size-label').style.display = isBlock ? '' : 'none';
  document.getElementById('blur-radius-label').style.display = isBlock ? 'none' : '';
});

blockSlider.addEventListener('input', () => { blockVal.textContent = blockSlider.value + 'px'; });
blurSlider.addEventListener('input', () => { blurVal.textContent = blurSlider.value; });

function loadImage(file) {
  if (!file.type.startsWith('image/')) { toast('画像ファイルを選択してください', true); return; }
  // 拡張子を除いた元ファイル名を保持
  originalFileName = file.name.replace(/\.[^.]+$/, '');
  const img = new Image();
  img.onload = () => {
    mainCanvas.width = img.naturalWidth;
    mainCanvas.height = img.naturalHeight;
    overlayCanvas.width = img.naturalWidth;
    overlayCanvas.height = img.naturalHeight;
    mainCtx.drawImage(img, 0, 0);
    originalImageData = mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
    beforeMosaicData = null;
    selection = null;
    canvasWrap.style.display = 'block';
    document.getElementById('apply-mosaic').disabled = true;
    document.getElementById('undo-mosaic').disabled = true;
    clearOverlay();
    toast('画像を読み込みました');
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}

setupDrop('img-drop', 'img-input', loadImage);

// Coordinate helper
function canvasCoords(e) {
  const rect = overlayCanvas.getBoundingClientRect();
  const scaleX = overlayCanvas.width / rect.width;
  const scaleY = overlayCanvas.height / rect.height;
  return {
    x: Math.round((e.clientX - rect.left) * scaleX),
    y: Math.round((e.clientY - rect.top) * scaleY)
  };
}

function clearOverlay() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

function drawSelection(x, y, w, h) {
  clearOverlay();
  overlayCtx.strokeStyle = 'rgba(108,99,255,0.9)';
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([6, 4]);
  overlayCtx.strokeRect(x, y, w, h);
  overlayCtx.fillStyle = 'rgba(108,99,255,0.15)';
  overlayCtx.fillRect(x, y, w, h);
  overlayCtx.setLineDash([]);
}

// Mouse events
overlayCanvas.addEventListener('mousedown', e => {
  isDragging = true;
  dragStart = canvasCoords(e);
  selection = null;
  document.getElementById('apply-mosaic').disabled = true;
});

overlayCanvas.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const pos = canvasCoords(e);
  drawSelection(
    Math.min(dragStart.x, pos.x), Math.min(dragStart.y, pos.y),
    Math.abs(pos.x - dragStart.x), Math.abs(pos.y - dragStart.y)
  );
});

overlayCanvas.addEventListener('mouseup', e => {
  if (!isDragging) return;
  isDragging = false;
  const pos = canvasCoords(e);
  const x = Math.min(dragStart.x, pos.x);
  const y = Math.min(dragStart.y, pos.y);
  const w = Math.abs(pos.x - dragStart.x);
  const h = Math.abs(pos.y - dragStart.y);
  if (w > 4 && h > 4) {
    selection = { x, y, w, h };
    document.getElementById('apply-mosaic').disabled = false;
  }
});

// Touch events
overlayCanvas.addEventListener('touchstart', e => {
  e.preventDefault();
  isDragging = true;
  dragStart = canvasCoords(e.touches[0]);
  selection = null;
  document.getElementById('apply-mosaic').disabled = true;
}, { passive: false });

overlayCanvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!isDragging) return;
  const pos = canvasCoords(e.touches[0]);
  drawSelection(
    Math.min(dragStart.x, pos.x), Math.min(dragStart.y, pos.y),
    Math.abs(pos.x - dragStart.x), Math.abs(pos.y - dragStart.y)
  );
}, { passive: false });

overlayCanvas.addEventListener('touchend', e => {
  if (!isDragging) return;
  isDragging = false;
  const pos = canvasCoords(e.changedTouches[0]);
  const x = Math.min(dragStart.x, pos.x);
  const y = Math.min(dragStart.y, pos.y);
  const w = Math.abs(pos.x - dragStart.x);
  const h = Math.abs(pos.y - dragStart.y);
  if (w > 4 && h > 4) {
    selection = { x, y, w, h };
    document.getElementById('apply-mosaic').disabled = false;
  }
});

// Apply mosaic/blur
function applyBlockMosaic(sx, sy, sw, sh, blockSize) {
  const imgData = mainCtx.getImageData(sx, sy, sw, sh);
  const d = imgData.data;
  for (let by = 0; by < sh; by += blockSize) {
    for (let bx = 0; bx < sw; bx += blockSize) {
      let r = 0, g = 0, b = 0, count = 0;
      const maxY = Math.min(by + blockSize, sh);
      const maxX = Math.min(bx + blockSize, sw);
      for (let y = by; y < maxY; y++) {
        for (let x = bx; x < maxX; x++) {
          const i = (y * sw + x) * 4;
          r += d[i]; g += d[i+1]; b += d[i+2]; count++;
        }
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      for (let y = by; y < maxY; y++) {
        for (let x = bx; x < maxX; x++) {
          const i = (y * sw + x) * 4;
          d[i] = r; d[i+1] = g; d[i+2] = b;
        }
      }
    }
  }
  mainCtx.putImageData(imgData, sx, sy);
}

function applyBlur(sx, sy, sw, sh, radius) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sw;
  tempCanvas.height = sh;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(mainCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = sw;
  blurCanvas.height = sh;
  const blurCtx = blurCanvas.getContext('2d');
  blurCtx.filter = `blur(${radius}px)`;
  blurCtx.drawImage(tempCanvas, -radius, -radius, sw + radius * 2, sh + radius * 2);
  blurCtx.filter = 'none';
  mainCtx.drawImage(blurCanvas, 0, 0, sw, sh, sx, sy, sw, sh);
}

document.getElementById('apply-mosaic').addEventListener('click', () => {
  if (!selection) return;
  beforeMosaicData = mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
  if (mosaicMode.value === 'block') {
    applyBlockMosaic(selection.x, selection.y, selection.w, selection.h, parseInt(blockSlider.value));
  } else {
    applyBlur(selection.x, selection.y, selection.w, selection.h, parseInt(blurSlider.value));
  }
  clearOverlay();
  selection = null;
  document.getElementById('apply-mosaic').disabled = true;
  document.getElementById('undo-mosaic').disabled = false;
  toast((mosaicMode.value === 'block' ? 'モザイク' : 'ブラー') + 'を適用しました');
});

document.getElementById('undo-mosaic').addEventListener('click', () => {
  if (!beforeMosaicData) return;
  mainCtx.putImageData(beforeMosaicData, 0, 0);
  beforeMosaicData = null;
  document.getElementById('undo-mosaic').disabled = true;
  toast('元に戻しました');
});

document.getElementById('img-reset').addEventListener('click', () => {
  if (!originalImageData) return;
  mainCtx.putImageData(originalImageData, 0, 0);
  beforeMosaicData = null;
  selection = null;
  clearOverlay();
  document.getElementById('apply-mosaic').disabled = true;
  document.getElementById('undo-mosaic').disabled = true;
  toast('リセットしました');
});

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
