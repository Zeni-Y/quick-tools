# Plan: PDF トリム機能の実装

## Context

PDF ツールに「トリム（余白カット）」機能を追加する。
画像ラスタライズなしに埋め込み文字を維持したまま、pdf-lib の `setCropBox` を使用して
ページの表示領域を絞る。CropBox は「エクスポート時にのみ適用」される非破壊設計。

---

## 変更対象ファイル

| ファイル     | 変更内容                                                               |
| ------------ | ---------------------------------------------------------------------- |
| `index.html` | サイドバーにトリムセクション追加、プレビューにオーバーレイ canvas 追加 |
| `style.css`  | オーバーレイ・トリムバッジ用スタイル追加                               |
| `js/pdf.js`  | トリムモード・座標変換・CropBox 適用ロジック追加                       |

---

## 実装詳細

### 1. `index.html`

**A. サイドバーにトリムセクション追加**
`#pdf-sidebar-tools` 内の「編集」セクション（削除ボタン）と「書き出し」セクションの間に挿入：

```html
<div class="sidebar-section">
  <h3>トリム</h3>
  <div class="sidebar-btn-group">
    <button class="btn btn-outline btn-sm" id="trim-mode-btn">
      トリムモード ON
    </button>
    <label
      style="font-size:0.8rem; color:var(--text2); display:flex; flex-direction:column; gap:4px; margin-top:4px;"
    >
      適用対象
      <select
        id="trim-target"
        style="background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:6px 8px;border-radius:var(--radius);font-size:0.85rem;cursor:pointer;width:100%;"
      >
        <option value="selected">選択ページ</option>
        <option value="all">全ページ</option>
      </select>
    </label>
    <button class="btn btn-sm" id="apply-trim" disabled>トリムを適用</button>
    <button class="btn btn-outline btn-sm" id="reset-trim">
      トリムをリセット
    </button>
    <div
      id="trim-dims"
      style="font-size:0.75rem;color:var(--text2);text-align:center;padding-top:2px;"
    ></div>
  </div>
</div>
```

**B. プレビューエリアをラップしてオーバーレイ追加**
既存の `.pdf-preview-inner` 内を変更：

```html
<div class="pdf-preview-inner">
  <div class="pdf-preview-canvas-wrap" id="pdf-preview-canvas-wrap">
    <canvas id="pdf-preview-canvas"></canvas>
    <canvas id="pdf-crop-overlay"></canvas>
  </div>
  <p class="pdf-preview-label" id="pdf-preview-label"></p>
</div>
```

---

### 2. `style.css`

`.pdf-preview-label` ルールの後に追加：

```css
/* ── PDF Trim overlay ── */
.pdf-preview-canvas-wrap {
  position: relative;
  display: inline-block;
  line-height: 0;
}
#pdf-crop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  display: none;
  pointer-events: none;
  border-radius: var(--radius);
}
#pdf-crop-overlay.active {
  display: block;
  pointer-events: auto;
}
.thumb .trim-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  background: #e67e22;
  color: #fff;
  font-size: 0.7rem;
  padding: 2px 5px;
  border-radius: 10px;
  display: none;
}
.thumb .trim-badge.show {
  display: block;
}
#trim-mode-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
```

---

### 3. `js/pdf.js`

#### 新規ステート変数（既存変数の後に追加）

```javascript
let pageTrimBoxes = {}; // { origPage: {relX, relY, relW, relH} } PDF points
let trimMode = false;
let trimDragging = false;
let trimDragStart = { x: 0, y: 0 };
let trimRect = null; // {x,y,w,h} in CSS pixels on overlay
let trimPreviewInfo = null; // { origPage, pageWidthPts, pageHeightPts }
```

#### `showPreview(origPage, idx)` の修正

- `trimMode` が true の場合、常に `rotation: 0` でレンダリング
- `trimPreviewInfo` に元ページのサイズ（PDF points）を格納
- 既存トリムがあれば再描画（`requestAnimationFrame` で CSS layout 確定後）
- ラベルを "トリムプレビュー: ページ N / M (元の向き)" に変更

```javascript
async function showPreview(origPage, idx) {
  const panel = document.getElementById("pdf-preview-panel");
  const cv = document.getElementById("pdf-preview-canvas");
  const label = document.getElementById("pdf-preview-label");
  const overlay = document.getElementById("pdf-crop-overlay");
  const page = await pdfDoc.getPage(origPage);
  const rot = trimMode ? 0 : pageRotations[origPage] || 0;
  const scale = 2;
  const vp = page.getViewport({ scale, rotation: rot });
  cv.width = vp.width;
  cv.height = vp.height;
  await page.render({ canvasContext: cv.getContext("2d"), viewport: vp })
    .promise;
  if (trimMode) {
    const vpNative = page.getViewport({ scale: 1, rotation: 0 });
    trimPreviewInfo = {
      origPage,
      pageWidthPts: vpNative.width,
      pageHeightPts: vpNative.height,
    };
    overlay.width = vp.width;
    overlay.height = vp.height;
    trimRect = null;
    const existing = pageTrimBoxes[origPage];
    requestAnimationFrame(() => {
      if (existing) trimRect = pdfPtsToOverlayCssRect(existing, overlay);
      drawTrimOverlay();
    });
    label.textContent =
      "トリムプレビュー: ページ " +
      (idx + 1) +
      " / " +
      activePages.length +
      " (元の向き)";
  } else {
    label.textContent = "ページ " + (idx + 1) + " / " + activePages.length;
  }
  panel.classList.add("active");
}
```

#### 新規ヘルパー: `getOverlayCssCoords(e)`

```javascript
function getOverlayCssCoords(e) {
  const rect = document
    .getElementById("pdf-crop-overlay")
    .getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
```

#### 新規ヘルパー: `pdfPtsToOverlayCssRect(trim, overlay)`

PDF points から CSS pixel rect への逆変換（既存トリムの再表示用）：

```javascript
function pdfPtsToOverlayCssRect(trim, overlay) {
  const sx = overlay.width / overlay.offsetWidth;
  const sy = overlay.height / overlay.offsetHeight;
  const x = (trim.relX * 2) / sx;
  const w = (trim.relW * 2) / sx;
  const h = (trim.relH * 2) / sy;
  const y = overlay.height / sy - (trim.relY * 2) / sy - h;
  return { x, y, w, h };
}
```

#### 新規関数: `drawTrimOverlay()`

```javascript
function drawTrimOverlay() {
  const overlay = document.getElementById("pdf-crop-overlay");
  const ctx = overlay.getContext("2d");
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const dimsEl = document.getElementById("trim-dims");
  if (!trimRect || trimRect.w < 2 || trimRect.h < 2) {
    dimsEl.textContent = "";
    return;
  }
  const sx = overlay.width / overlay.offsetWidth;
  const sy = overlay.height / overlay.offsetHeight;
  const cx = trimRect.x * sx,
    cy = trimRect.y * sy;
  const cw = trimRect.w * sx,
    ch = trimRect.h * sy;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, overlay.width, overlay.height);
  ctx.clearRect(cx, cy, cw, ch);
  ctx.strokeStyle = "rgba(108,99,255,0.9)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(cx, cy, cw, ch);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + (cw * i) / 3, cy);
    ctx.lineTo(cx + (cw * i) / 3, cy + ch);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + (ch * i) / 3);
    ctx.lineTo(cx + cw, cy + (ch * i) / 3);
    ctx.stroke();
  }
  dimsEl.textContent = `W: ${Math.round(
    (trimRect.w * sx) / 2
  )} pt  H: ${Math.round((trimRect.h * sy) / 2)} pt`;
}
```

#### 新規関数: `enterTrimMode()` / `exitTrimMode()`

```javascript
function enterTrimMode() {
  trimMode = true;
  trimRect = null;
  document.getElementById("pdf-crop-overlay").classList.add("active");
  document.getElementById("trim-mode-btn").textContent = "トリムモード OFF";
  document.getElementById("trim-mode-btn").classList.add("active");
  document.getElementById("apply-trim").disabled = false;
  toast("トリムモード: ページをクリックして選択してください");
}

function exitTrimMode() {
  trimMode = false;
  trimRect = null;
  trimPreviewInfo = null;
  const overlay = document.getElementById("pdf-crop-overlay");
  overlay.classList.remove("active");
  overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
  document.getElementById("trim-mode-btn").textContent = "トリムモード ON";
  document.getElementById("trim-mode-btn").classList.remove("active");
  document.getElementById("apply-trim").disabled = true;
  document.getElementById("trim-dims").textContent = "";
}
```

#### 新規関数: `getTargetPages(currentOrigPage)`

```javascript
function getTargetPages(currentOrigPage) {
  if (document.getElementById("trim-target").value === "all")
    return [...activePages];
  if (selectedPages.size > 0)
    return [...selectedPages].map((idx) => activePages[idx]);
  return [currentOrigPage];
}
```

#### 新規関数: `applyTrim()`

座標変換（CSS px → canvas px → PDF points）：

```javascript
async function applyTrim() {
  if (!trimPreviewInfo || !trimRect || trimRect.w < 4 || trimRect.h < 4) {
    toast("トリム範囲をドラッグで選択してください", true);
    return;
  }
  const overlay = document.getElementById("pdf-crop-overlay");
  const sx = overlay.width / overlay.offsetWidth;
  const sy = overlay.height / overlay.offsetHeight;
  // CSS px → canvas px (×sx/sy) → PDF pts (÷2 for renderScale=2)
  const relX = (trimRect.x * sx) / 2;
  const relW = (trimRect.w * sx) / 2;
  const relH = (trimRect.h * sy) / 2;
  const relY = (overlay.height - trimRect.y * sy - trimRect.h * sy) / 2; // flip Y
  const targetPages = getTargetPages(trimPreviewInfo.origPage);
  for (const pg of targetPages) {
    pageTrimBoxes[pg] = { relX, relY, relW, relH };
    updateTrimBadge(pg, true);
  }
  toast(targetPages.length + "ページにトリムを適用しました");
}
```

#### 新規関数: `resetTrim()`

```javascript
function resetTrim() {
  const targetPages = trimPreviewInfo
    ? getTargetPages(trimPreviewInfo.origPage)
    : [...activePages];
  for (const pg of targetPages) {
    delete pageTrimBoxes[pg];
    updateTrimBadge(pg, false);
  }
  trimRect = null;
  drawTrimOverlay();
  toast("トリムをリセットしました");
}
```

#### 新規ヘルパー: `updateTrimBadge(origPage, show)`

```javascript
function updateTrimBadge(origPage, show) {
  const thumb = container.querySelector(`.thumb[data-orig-page="${origPage}"]`);
  if (!thumb) return;
  let badge = thumb.querySelector(".trim-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "trim-badge";
    badge.textContent = "✂";
    thumb.appendChild(badge);
  }
  badge.classList.toggle("show", show);
}
```

#### オーバーレイのドラッグイベント

```javascript
const cropOverlay = document.getElementById("pdf-crop-overlay");
cropOverlay.addEventListener("mousedown", (e) => {
  if (!trimMode || !trimPreviewInfo) return;
  trimDragging = true;
  trimDragStart = getOverlayCssCoords(e);
  trimRect = null;
  drawTrimOverlay();
});
cropOverlay.addEventListener("mousemove", (e) => {
  if (!trimDragging || !trimMode) return;
  const pos = getOverlayCssCoords(e);
  const overlay = document.getElementById("pdf-crop-overlay");
  const x = Math.max(0, Math.min(trimDragStart.x, pos.x));
  const y = Math.max(0, Math.min(trimDragStart.y, pos.y));
  const w = Math.min(
    Math.abs(pos.x - trimDragStart.x),
    overlay.offsetWidth - x
  );
  const h = Math.min(
    Math.abs(pos.y - trimDragStart.y),
    overlay.offsetHeight - y
  );
  trimRect = { x, y, w, h };
  drawTrimOverlay();
});
cropOverlay.addEventListener("mouseup", () => {
  if (!trimDragging || !trimMode) return;
  trimDragging = false;
  if (!trimRect || trimRect.w < 4 || trimRect.h < 4) trimRect = null;
  drawTrimOverlay();
});
cropOverlay.addEventListener("mouseleave", () => {
  trimDragging = false;
});
```

#### ボタンイベントリスナー

```javascript
document.getElementById("trim-mode-btn").addEventListener("click", () => {
  if (trimMode) exitTrimMode();
  else enterTrimMode();
});
document.getElementById("apply-trim").addEventListener("click", applyTrim);
document.getElementById("reset-trim").addEventListener("click", resetTrim);
```

#### `exportPDF()` の修正

既存の `outDoc.addPage(page)` の直前に挿入：

```javascript
const trim = pageTrimBoxes[activePages[i]];
if (trim) {
  const srcPage = srcDoc.getPages()[activePages[i] - 1];
  const cropBox = srcPage.getCropBox() ?? srcPage.getMediaBox();
  page.setCropBox(
    cropBox.x + trim.relX,
    cropBox.y + trim.relY,
    trim.relW,
    trim.relH
  );
}
```

#### `loadPDF()` と `pdf-reset` ハンドラの修正

`pageRotations = {}` の直後に追加：

```javascript
pageTrimBoxes = {};
if (trimMode) exitTrimMode();
```

---

## 設計上の制約・注意事項

- **座標系**: トリムプレビューは常に `rotation: 0` でレンダリング。ユーザーには "元の向き" と表示。`pageTrimBoxes` は `origPage` をキーとするため、ページ並び替え・削除後も正しく動作する。
- **既存 CropBox の扱い**: エクスポート時に `srcPage.getCropBox()` から既存 CropBox のオフセットを取得し、絶対座標を計算して `setCropBox` を設定する。
- **Canvas 座標変換**: オーバーレイは CSS サイズとキャンバス intrinsic サイズが異なる場合がある。`overlay.width / overlay.offsetWidth` で scale factor を計算して補正する。
- **renderScale = 2**: `showPreview` は `scale: 2` でレンダリングするため、PDF points への変換は canvas px を 2 で割る。

---

## 検証方法

1. PDF を読み込む → サイドバーに「トリム」セクションが表示されることを確認
2. ページサムネイルをクリック → プレビューに表示される
3. 「トリムモード ON」ボタンをクリック → オーバーレイが有効になる
4. プレビュー上でドラッグ → 暗転＋破線矩形が表示され、pt サイズが sidebar に表示される
5. 「トリムを適用」→ サムネイルに ✂ バッジが表示される
6. 「PDF 書き出し」→ エクスポートした PDF をビューアで開き、選択した範囲のみが表示されること・テキスト選択が可能なことを確認
7. 「トリムをリセット」→ バッジが消え、再エクスポートで全ページ表示されることを確認
