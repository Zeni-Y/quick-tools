import { toast, setupDrop } from './utils.js';

const mainCanvas = document.getElementById('main-canvas');
const mainCtx = mainCanvas.getContext('2d');
const canvasWrap = document.getElementById('img-canvas-wrap');
const widthInput = document.getElementById('resize-width');
const heightInput = document.getElementById('resize-height');
const lockAspect = document.getElementById('resize-lock');
const applyBtn = document.getElementById('apply-resize');
const hint = document.getElementById('img-hint');

let resizeImg = null;
let resizeFileName = '';
let aspectRatio = 1;
let updatingSize = false;

function loadResizeImage(file) {
  if (!file.type.startsWith('image/')) { toast('画像ファイルを選択してください', true); return; }
  resizeFileName = file.name.replace(/\.[^.]+$/, '');
  const img = new Image();
  img.onload = () => {
    resizeImg = img;
    aspectRatio = img.naturalWidth / img.naturalHeight;
    widthInput.value = img.naturalWidth;
    heightInput.value = img.naturalHeight;
    // Draw on shared canvas
    mainCanvas.width = img.naturalWidth;
    mainCanvas.height = img.naturalHeight;
    mainCtx.drawImage(img, 0, 0);
    canvasWrap.style.display = 'block';
    applyBtn.disabled = false;
    hint.textContent = `元のサイズ: ${img.naturalWidth} × ${img.naturalHeight}px`;
    toast('画像を読み込みました');
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}

setupDrop('resize-drop', 'resize-input', loadResizeImage);

widthInput.addEventListener('input', () => {
  if (updatingSize || !lockAspect.checked || !resizeImg) return;
  updatingSize = true;
  const w = parseInt(widthInput.value) || 1;
  heightInput.value = Math.round(w / aspectRatio);
  updatingSize = false;
});

heightInput.addEventListener('input', () => {
  if (updatingSize || !lockAspect.checked || !resizeImg) return;
  updatingSize = true;
  const h = parseInt(heightInput.value) || 1;
  widthInput.value = Math.round(h * aspectRatio);
  updatingSize = false;
});

applyBtn.addEventListener('click', () => {
  if (!resizeImg) return;
  const w = parseInt(widthInput.value) || resizeImg.naturalWidth;
  const h = parseInt(heightInput.value) || resizeImg.naturalHeight;
  mainCanvas.width = w;
  mainCanvas.height = h;
  mainCtx.drawImage(resizeImg, 0, 0, w, h);
  canvasWrap.style.display = 'block';
  hint.textContent = `リサイズ後: ${w} × ${h}px`;
  toast('リサイズしました');
});

document.getElementById('resize-reset').addEventListener('click', () => {
  if (!resizeImg) return;
  mainCanvas.width = resizeImg.naturalWidth;
  mainCanvas.height = resizeImg.naturalHeight;
  mainCtx.drawImage(resizeImg, 0, 0);
  widthInput.value = resizeImg.naturalWidth;
  heightInput.value = resizeImg.naturalHeight;
  hint.textContent = `元のサイズ: ${resizeImg.naturalWidth} × ${resizeImg.naturalHeight}px`;
  toast('リセットしました');
});

function downloadResize(format) {
  const link = document.createElement('a');
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpg' ? '.jpg' : '.png';
  link.download = (resizeFileName || 'image') + '_resized' + ext;
  link.href = mainCanvas.toDataURL(mime, 0.92);
  link.click();
  toast(ext.toUpperCase().slice(1) + ' を保存しました');
}
document.getElementById('resize-dl-png').addEventListener('click', () => downloadResize('png'));
document.getElementById('resize-dl-jpg').addEventListener('click', () => downloadResize('jpg'));
