import { toast, setupDrop } from './utils.js';

const mainCanvas = document.getElementById('main-canvas');
const mainCtx = mainCanvas.getContext('2d');
const overlayCanvas = document.getElementById('overlay-canvas');
const overlayCtx = overlayCanvas.getContext('2d');
const canvasWrap = document.getElementById('img-canvas-wrap');
const aspectSelect = document.getElementById('crop-aspect');
const applyBtn = document.getElementById('apply-crop');
const hint = document.getElementById('img-hint');

let cropImg = null;
let cropFileName = '';
let cropSelection = null;
let isDragging = false;
let dragStart = null;

function loadCropImage(file) {
  if (!file.type.startsWith('image/')) { toast('画像ファイルを選択してください', true); return; }
  cropFileName = file.name.replace(/\.[^.]+$/, '');
  const img = new Image();
  img.onload = () => {
    cropImg = img;
    mainCanvas.width = img.naturalWidth;
    mainCanvas.height = img.naturalHeight;
    overlayCanvas.width = img.naturalWidth;
    overlayCanvas.height = img.naturalHeight;
    mainCtx.drawImage(img, 0, 0);
    canvasWrap.style.display = 'block';
    cropSelection = null;
    applyBtn.disabled = true;
    clearOverlay();
    hint.textContent = '画像上でドラッグして切り抜き範囲を選択してください。';
    toast('画像を読み込みました');
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}

setupDrop('crop-drop', 'crop-input', loadCropImage);

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

function drawCropSelection(x, y, w, h) {
  clearOverlay();
  // Dim area outside selection
  overlayCtx.fillStyle = 'rgba(0,0,0,0.5)';
  overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayCtx.clearRect(x, y, w, h);
  // Selection border
  overlayCtx.strokeStyle = 'rgba(108,99,255,0.9)';
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([6, 4]);
  overlayCtx.strokeRect(x, y, w, h);
  overlayCtx.setLineDash([]);
}

function constrainToAspect(startX, startY, endX, endY) {
  const aspect = aspectSelect.value;
  let w = endX - startX;
  let h = endY - startY;
  if (aspect === 'free') return { x: Math.min(startX, endX), y: Math.min(startY, endY), w: Math.abs(w), h: Math.abs(h) };

  const [aw, ah] = aspect.split(':').map(Number);
  const ratio = aw / ah;
  const absW = Math.abs(w);
  const absH = Math.abs(h);
  let finalW, finalH;
  if (absW / ratio > absH) {
    finalH = absH;
    finalW = Math.round(absH * ratio);
  } else {
    finalW = absW;
    finalH = Math.round(absW / ratio);
  }
  const fx = w < 0 ? startX - finalW : startX;
  const fy = h < 0 ? startY - finalH : startY;
  return { x: fx, y: fy, w: finalW, h: finalH };
}

// These listeners only apply when crop tool is active—we check cropImg
overlayCanvas.addEventListener('mousedown', e => {
  if (!cropImg || !isCropActive()) return;
  isDragging = true;
  dragStart = canvasCoords(e);
  cropSelection = null;
  applyBtn.disabled = true;
});

overlayCanvas.addEventListener('mousemove', e => {
  if (!isDragging || !cropImg || !isCropActive()) return;
  const pos = canvasCoords(e);
  const sel = constrainToAspect(dragStart.x, dragStart.y, pos.x, pos.y);
  drawCropSelection(sel.x, sel.y, sel.w, sel.h);
});

overlayCanvas.addEventListener('mouseup', e => {
  if (!isDragging || !cropImg || !isCropActive()) return;
  isDragging = false;
  const pos = canvasCoords(e);
  const sel = constrainToAspect(dragStart.x, dragStart.y, pos.x, pos.y);
  if (sel.w > 4 && sel.h > 4) {
    cropSelection = sel;
    applyBtn.disabled = false;
  }
});

function isCropActive() {
  return document.querySelector('.sub-nav-btn[data-subtab="crop"]').classList.contains('active');
}

applyBtn.addEventListener('click', () => {
  if (!cropSelection || !cropImg) return;
  const { x, y, w, h } = cropSelection;
  const imgData = mainCtx.getImageData(x, y, w, h);
  mainCanvas.width = w;
  mainCanvas.height = h;
  overlayCanvas.width = w;
  overlayCanvas.height = h;
  mainCtx.putImageData(imgData, 0, 0);
  clearOverlay();
  cropSelection = null;
  applyBtn.disabled = true;
  hint.textContent = `切り抜き後: ${w} × ${h}px`;
  toast('切り抜きました');
});

document.getElementById('crop-reset').addEventListener('click', () => {
  if (!cropImg) return;
  mainCanvas.width = cropImg.naturalWidth;
  mainCanvas.height = cropImg.naturalHeight;
  overlayCanvas.width = cropImg.naturalWidth;
  overlayCanvas.height = cropImg.naturalHeight;
  mainCtx.drawImage(cropImg, 0, 0);
  cropSelection = null;
  applyBtn.disabled = true;
  clearOverlay();
  hint.textContent = '画像上でドラッグして切り抜き範囲を選択してください。';
  toast('リセットしました');
});

function downloadCrop(format) {
  const link = document.createElement('a');
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpg' ? '.jpg' : '.png';
  link.download = (cropFileName || 'image') + '_cropped' + ext;
  link.href = mainCanvas.toDataURL(mime, 0.92);
  link.click();
  toast(ext.toUpperCase().slice(1) + ' を保存しました');
}
document.getElementById('crop-dl-png').addEventListener('click', () => downloadCrop('png'));
document.getElementById('crop-dl-jpg').addEventListener('click', () => downloadCrop('jpg'));
