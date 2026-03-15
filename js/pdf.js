import { toast, setupDrop, showLoading, hideLoading } from './utils.js';

let pdfDoc = null;        // pdf.js用（プレビュー表示）
let pdfRawBytes = null;   // 元PDFのバイナリ（pdf-lib用、無劣化書き出し）
let activePages = [];
let pageRotations = {};
let selectedPages = new Set();
let dragSrcIdx = null;

const container = document.getElementById('thumbnails');

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.124/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.124/build/pdf.worker.min.mjs';
  window.pdfjsLib = pdfjsLib;
  return pdfjsLib;
}

async function loadPdfLib() {
  if (window.PDFLib) return window.PDFLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    s.onload = () => resolve(window.PDFLib);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── サムネイル1つ分のDOM要素を生成 ──
async function createThumbElement(origPage, idx) {
  const page = await pdfDoc.getPage(origPage);
  const scale = 0.3;
  const rot = pageRotations[origPage] || 0;
  const vp = page.getViewport({ scale, rotation: rot });
  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  thumb.dataset.idx = idx;
  thumb.dataset.origPage = origPage;
  const cv = document.createElement('canvas');
  cv.width = vp.width;
  cv.height = vp.height;
  const ctx = cv.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const badge = document.createElement('span');
  badge.className = 'rotation-badge' + (rot ? ' show' : '');
  badge.textContent = rot + '°';
  const label = document.createElement('div');
  label.className = 'page-num';
  label.textContent = (idx + 1) + ' / ' + activePages.length;
  thumb.appendChild(cv);
  thumb.appendChild(badge);
  thumb.appendChild(label);
  attachThumbEvents(thumb);
  return thumb;
}

// ── サムネイルにイベントを付与 ──
function attachThumbEvents(thumb) {
  // クリックで選択トグル＋プレビュー表示
  thumb.addEventListener('click', () => {
    if (thumb.dataset.wasDragged === 'true') { thumb.dataset.wasDragged = ''; return; }
    const idx = parseInt(thumb.dataset.idx);
    if (selectedPages.has(idx)) {
      selectedPages.delete(idx);
      thumb.classList.remove('selected');
    } else {
      selectedPages.add(idx);
      thumb.classList.add('selected');
    }
    updateSelectInfo();
    showPreview(activePages[idx], idx);
  });

  // ドラッグ＆ドロップ
  thumb.draggable = true;
  thumb.addEventListener('dragstart', (e) => {
    dragSrcIdx = parseInt(thumb.dataset.idx);
    thumb.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });
  thumb.addEventListener('dragend', () => {
    thumb.classList.remove('dragging');
    clearDragIndicators();
    dragSrcIdx = null;
  });
  thumb.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const idx = parseInt(thumb.dataset.idx);
    if (dragSrcIdx === null || dragSrcIdx === idx) return;
    clearDragIndicators();
    thumb.classList.add(dragSrcIdx < idx ? 'drag-over-right' : 'drag-over-left');
  });
  thumb.addEventListener('dragleave', () => {
    thumb.classList.remove('drag-over-left', 'drag-over-right');
  });
  thumb.addEventListener('drop', (e) => {
    e.preventDefault();
    clearDragIndicators();
    const fromIdx = dragSrcIdx;
    const toIdx = parseInt(thumb.dataset.idx);
    if (fromIdx === null || fromIdx === toIdx) return;
    dragSrcIdx = null;

    // activePages を並び替え
    const [moved] = activePages.splice(fromIdx, 1);
    activePages.splice(toIdx, 0, moved);

    // DOM要素を移動（再レンダリングなし）
    const thumbs = [...container.children];
    const movedEl = thumbs[fromIdx];
    movedEl.remove();
    if (toIdx >= container.children.length) {
      container.appendChild(movedEl);
    } else {
      container.insertBefore(movedEl, container.children[toIdx]);
    }

    // 選択状態リセット & インデックス更新
    selectedPages.clear();
    refreshIndices();
    updateSelectInfo();

    // ドラッグ直後のclickを抑制
    container.querySelectorAll('.thumb').forEach(t => t.dataset.wasDragged = 'true');
    setTimeout(() => container.querySelectorAll('.thumb').forEach(t => t.dataset.wasDragged = ''), 100);
    toast('ページを移動しました');
  });
}

// ── インデックスとラベルを再付番（再レンダリングなし） ──
function refreshIndices() {
  const thumbs = container.querySelectorAll('.thumb');
  const total = activePages.length;
  thumbs.forEach((t, i) => {
    t.dataset.idx = i;
    t.querySelector('.page-num').textContent = (i + 1) + ' / ' + total;
    if (!selectedPages.has(i)) t.classList.remove('selected');
  });
}

function clearDragIndicators() {
  container.querySelectorAll('.thumb').forEach(t => {
    t.classList.remove('drag-over-left', 'drag-over-right');
  });
}

// ── プレビュー表示 ──
async function showPreview(origPage, idx) {
  const panel = document.getElementById('pdf-preview-panel');
  const cv = document.getElementById('pdf-preview-canvas');
  const label = document.getElementById('pdf-preview-label');
  const page = await pdfDoc.getPage(origPage);
  const rot = pageRotations[origPage] || 0;
  const scale = 2;
  const vp = page.getViewport({ scale, rotation: rot });
  cv.width = vp.width;
  cv.height = vp.height;
  const ctx = cv.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  label.textContent = 'ページ ' + (idx + 1) + ' / ' + activePages.length;
  panel.classList.add('active');
}

function updateSelectInfo() {
  document.getElementById('select-info').textContent = selectedPages.size + 'ページ選択中';
}

// ── 初回読み込み時のみ全サムネイル描画 ──
async function renderAllThumbnails() {
  container.innerHTML = '';
  for (let idx = 0; idx < activePages.length; idx++) {
    const thumb = await createThumbElement(activePages[idx], idx);
    container.appendChild(thumb);
  }
}

// ── PDF読み込み ──
async function loadPDF(file) {
  if (file.type !== 'application/pdf') { toast('PDFファイルを選択してください', true); return; }
  showLoading();
  try {
    const pdfjsLib = await loadPdfJs();
    const buf = await file.arrayBuffer();
    pdfRawBytes = new Uint8Array(buf.slice(0));          // pdf-lib用に独立コピー
    pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;  // pdf.js用
    activePages = Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);
    pageRotations = {};
    for (let i = 1; i <= pdfDoc.numPages; i++) pageRotations[i] = 0;
    selectedPages.clear();
    await renderAllThumbnails();
    document.getElementById('pdf-sidebar-tools').style.display = '';
    updateSelectInfo();
    toast(pdfDoc.numPages + 'ページ読み込みました');
  } catch (err) {
    toast('PDF読み込みエラー: ' + err.message, true);
    console.error(err);
  } finally {
    hideLoading();
  }
}

setupDrop('pdf-drop', 'pdf-input', loadPDF);

// ── ページ選択 ──
document.getElementById('select-all').addEventListener('click', () => {
  container.querySelectorAll('.thumb').forEach(t => {
    const idx = parseInt(t.dataset.idx);
    selectedPages.add(idx);
    t.classList.add('selected');
  });
  updateSelectInfo();
});

document.getElementById('deselect-all').addEventListener('click', () => {
  selectedPages.clear();
  container.querySelectorAll('.thumb').forEach(t => t.classList.remove('selected'));
  updateSelectInfo();
});

// ── 回転（対象サムネイルだけ再描画） ──
async function rotateSelected(deg) {
  if (selectedPages.size === 0) { toast('ページを選択してください', true); return; }
  const thumbs = container.querySelectorAll('.thumb');
  for (const idx of selectedPages) {
    const origPage = activePages[idx];
    pageRotations[origPage] = ((pageRotations[origPage] || 0) + deg) % 360;
    // 該当サムネイルだけ再描画
    const oldThumb = thumbs[idx];
    const newThumb = await createThumbElement(origPage, idx);
    if (selectedPages.has(idx)) newThumb.classList.add('selected');
    container.replaceChild(newThumb, oldThumb);
  }
  toast(selectedPages.size + 'ページを' + deg + '°回転しました');
}

document.getElementById('rotate-90').addEventListener('click', () => rotateSelected(90));
document.getElementById('rotate-180').addEventListener('click', () => rotateSelected(180));
document.getElementById('rotate-270').addEventListener('click', () => rotateSelected(270));

// ── ページ削除（DOM除去のみ、再レンダリングなし） ──
document.getElementById('delete-pages').addEventListener('click', () => {
  if (selectedPages.size === 0) { toast('ページを選択してください', true); return; }
  if (selectedPages.size === activePages.length) { toast('すべてのページは削除できません', true); return; }
  const deleteCount = selectedPages.size;
  // 降順で削除（インデックスがずれないように）
  const sortedDesc = [...selectedPages].sort((a, b) => b - a);
  const thumbs = [...container.querySelectorAll('.thumb')];
  for (const idx of sortedDesc) {
    thumbs[idx].remove();
    activePages.splice(idx, 1);
  }
  selectedPages.clear();
  refreshIndices();
  updateSelectInfo();
  toast(deleteCount + 'ページを削除しました');
});

// ── PDF書き出し（pdf-lib で元データを直接コピー、無劣化） ──
document.getElementById('export-pdf').addEventListener('click', async () => {
  if (!pdfDoc || activePages.length === 0) return;
  showLoading();
  try {
    const PDFLib = await loadPdfLib();
    const srcDoc = await PDFLib.PDFDocument.load(pdfRawBytes, { ignoreEncryption: true });
    const outDoc = await PDFLib.PDFDocument.create();

    // activePages の順序でページをコピー
    const srcIndices = activePages.map(p => p - 1); // 0-indexed
    const copiedPages = await outDoc.copyPages(srcDoc, srcIndices);

    for (let i = 0; i < copiedPages.length; i++) {
      const page = copiedPages[i];
      const rot = pageRotations[activePages[i]] || 0;
      if (rot !== 0) {
        // 既存の回転に加算
        const currentRot = page.getRotation().angle;
        page.setRotation(PDFLib.degrees(currentRot + rot));
      }
      outDoc.addPage(page);
    }

    const pdfBytes = await outDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.pdf';
    a.click();
    URL.revokeObjectURL(url);
    toast('PDFを書き出しました');
  } catch (err) {
    toast('PDF書き出しエラー: ' + err.message, true);
    console.error(err);
  } finally {
    hideLoading();
  }
});

// ── JPG書き出し ──
document.getElementById('export-jpg').addEventListener('click', async () => {
  if (selectedPages.size === 0) { toast('ページを選択してください', true); return; }
  showLoading();
  try {
    const scale = 2;
    for (const idx of [...selectedPages].sort((a,b) => a-b)) {
      const origPage = activePages[idx];
      const page = await pdfDoc.getPage(origPage);
      const vp = page.getViewport({ scale, rotation: pageRotations[origPage] || 0 });
      const cv = document.createElement('canvas');
      cv.width = vp.width;
      cv.height = vp.height;
      const ctx = cv.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'page_' + (idx + 1) + '.jpg';
      a.click();
      URL.revokeObjectURL(url);
    }
    toast(selectedPages.size + 'ページをJPGで保存しました');
  } catch (err) {
    toast('JPG書き出しエラー: ' + err.message, true);
    console.error(err);
  } finally {
    hideLoading();
  }
});

// ── リセット ──
document.getElementById('pdf-reset').addEventListener('click', () => {
  pdfDoc = null;
  pdfRawBytes = null;
  activePages = [];
  pageRotations = {};
  selectedPages.clear();
  container.innerHTML = '';
  document.getElementById('pdf-sidebar-tools').style.display = 'none';
  document.getElementById('pdf-preview-panel').classList.remove('active');
  toast('リセットしました');
});
