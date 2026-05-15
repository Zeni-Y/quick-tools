# PDF コメント抽出機能

## Context

PDF ファイルに付けられたアノテーション（コメント、ハイライト等）を一覧で確認したいというニーズに応える。現在の PDF タブはページ編集（回転・並べ替え・トリム）のみ対応しており、コメント抽出機能がない。pdf.js の `page.getAnnotations()` API を使いブラウザ完結で実装する。

---

## 修正対象ファイル

- `index.html`
- `js/app.js`
- `js/pdf.js`
- `style.css`

---

## 実装方針

PDF タブに画像ツールと同様のサブナビゲーションを追加し、**「編集」**（既存機能）と**「コメント」**（新機能）の 2 サブタブで切り替える。コメントタブはサイドバー＋専用メインエリアを持つ。

`pdfDoc` はモジュール変数として共有されるため、編集タブで読み込んだ PDF をコメントタブでもそのまま利用できる。コメントタブ固有のドロップゾーンも用意し独立に読み込める（`commentsPdfDoc` 変数を別途確保）。

---

## Step 1 — `index.html`

`#tab-pdf` の `<div class="panel-layout">` 内を以下の構成に変更：

```
panel-layout
├── <nav class="sub-nav">          ← NEW: 2ボタン（編集 / コメント）
├── <aside data-sidebar="edit">    ← 既存サイドバーに data-sidebar="edit" を追加
├── <aside data-sidebar="comments" style="display:none">  ← NEW
├── <div class="panel-main pdf-main" data-view="edit">    ← 既存に data-view="edit" を追加
└── <div class="pdf-comments-main" data-view="comments" style="display:none">  ← NEW
```

**新規コメントサイドバー (`data-sidebar="comments"`)：**

```html
<aside class="panel-sidebar" data-sidebar="comments" style="display:none">
  <div class="sidebar-section">
    <h3>PDFを読み込む</h3>
    <div
      class="drop-zone"
      id="pdf-comment-drop"
      style="padding:20px 12px;max-width:none;"
    >
      <input type="file" accept="application/pdf" id="pdf-comment-input" />
      <p class="label">ドロップ or クリック</p>
      <p>編集タブで読み込み済みのPDFも利用可</p>
    </div>
  </div>
  <div class="sidebar-section" id="comment-file-info" style="display:none">
    <p style="font-size:0.8rem;color:var(--text2);" id="comment-file-label"></p>
  </div>
  <div class="sidebar-section">
    <div class="sidebar-btn-group">
      <button class="btn" id="extract-comments-btn">コメントを抽出</button>
      <button class="btn btn-outline" id="copy-comments-btn" disabled>
        コピー
      </button>
    </div>
  </div>
</aside>
```

**新規コメントメインエリア (`data-view="comments"`)：**

```html
<div
  class="panel-main pdf-comments-main"
  data-view="comments"
  style="display:none"
>
  <div id="comment-results-wrap">
    <p class="comment-empty-hint" id="comment-empty-hint">
      「コメントを抽出」ボタンを押すと、注釈の一覧がここに表示されます。
    </p>
    <ul class="comment-list" id="comment-list" style="display:none"></ul>
  </div>
</div>
```

**サブナビ：**

```html
<nav class="sub-nav">
  <button class="sub-nav-btn active" data-subtab="edit" title="編集">
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path d="M3 12.5V15h2.5l7.4-7.4-2.5-2.5L3 12.5z" />
      <path
        d="M13.8 4.7l-1-1a1 1 0 0 0-1.4 0l-1 1 2.5 2.5 1-1a1 1 0 0 0 0-1.5z"
      />
    </svg>
    <span>編集</span>
  </button>
  <button class="sub-nav-btn" data-subtab="comments" title="コメント抽出">
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path d="M2 3h14v10H9l-4 3v-3H2z" />
    </svg>
    <span>コメント</span>
  </button>
</nav>
```

---

## Step 2 — `js/app.js`

現在の画像専用ハンドラをスコープ付き汎用版に置き換える（11 行 →13 行）。
`data-view` の切り替えも追加（PDF タブのみ効果あり、画像タブには `[data-view]` 要素がないため no-op）。
アクティブボタン更新を `btn.closest('.sub-nav')` にスコープして複数サブナビ間の干渉を排除。

```javascript
// ── Sub-tab switching (image + pdf 共通) ──
document.querySelectorAll(".sub-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const subtab = btn.dataset.subtab;
    const parentTab = btn.closest(".tab-content");
    btn
      .closest(".sub-nav")
      .querySelectorAll(".sub-nav-btn")
      .forEach((b) => b.classList.toggle("active", b === btn));
    parentTab.querySelectorAll(".panel-sidebar").forEach((sb) => {
      sb.style.display = sb.dataset.sidebar === subtab ? "" : "none";
    });
    parentTab.querySelectorAll("[data-view]").forEach((v) => {
      v.style.display = v.dataset.view === subtab ? "" : "none";
    });
  });
});
```

---

## Step 3 — `js/pdf.js`

### 追加する変数（先頭の let 群の直後）

```javascript
let commentsPdfDoc = null;
```

### 追加する関数（ファイル末尾に追記）

**型ラベル変換：**

```javascript
const ANN_TYPE_JA = {
  Text: "テキスト",
  Highlight: "ハイライト",
  Underline: "アンダーライン",
  StrikeOut: "取り消し線",
  FreeText: "フリーテキスト",
  Ink: "インク",
  Stamp: "スタンプ",
};
function annTypeJa(subtype) {
  return ANN_TYPE_JA[subtype] || subtype || "不明";
}
```

**マークされたテキストの抽出（ベストエフォート）：**

```javascript
async function extractMarkedText(page, ann) {
  const markupTypes = new Set([
    "Highlight",
    "Underline",
    "StrikeOut",
    "Squiggly",
  ]);
  if (!markupTypes.has(ann.subtype) || !ann.rect) return null;
  const [rx1, ry1, rx2, ry2] = ann.rect;
  const content = await page.getTextContent();
  const TOL = 2;
  const matched = content.items
    .filter((item) => {
      if (!item.str || !item.transform) return false;
      const tx = item.transform[4],
        ty = item.transform[5];
      const iw = item.width ?? 0,
        ih = item.height ?? 0;
      return (
        tx + iw > rx1 - TOL &&
        tx < rx2 + TOL &&
        ty + ih > ry1 - TOL &&
        ty < ry2 + TOL
      );
    })
    .map((i) => i.str);
  return matched.length ? matched.join("") : null;
}
```

**メイン抽出関数：**

```javascript
async function extractComments() {
  const doc = pdfDoc ?? commentsPdfDoc;
  if (!doc) {
    toast("PDFを読み込んでください", true);
    return;
  }
  showLoading();
  const results = [];
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const annotations = await page.getAnnotations();
      for (const ann of annotations) {
        const hasContent = ann.contents && ann.contents.trim();
        if (!hasContent) continue;
        let markedText = null;
        try {
          markedText = await extractMarkedText(page, ann);
        } catch (_) {}
        results.push({
          page: pageNum,
          subtype: ann.subtype,
          author: ann.title ? ann.title.trim() : "",
          contents: ann.contents.trim(),
          markedText,
        });
      }
    }
    renderComments(results);
    toast(
      results.length === 0
        ? "コメントが見つかりませんでした"
        : results.length + "件のコメントを抽出しました"
    );
  } catch (err) {
    toast("コメント抽出エラー: " + err.message, true);
    console.error(err);
  } finally {
    hideLoading();
  }
}
```

**レンダリング関数：**

```javascript
function buildPlainText(results) {
  return results
    .map((r) => {
      const lines = [
        `[P${r.page}] [${annTypeJa(r.subtype)}]${
          r.author ? " [" + r.author + "]" : ""
        }`,
      ];
      if (r.markedText) lines.push("対象: " + r.markedText);
      if (r.contents) lines.push("コメント: " + r.contents);
      return lines.join("\n");
    })
    .join("\n\n");
}

function renderComments(results) {
  const list = document.getElementById("comment-list");
  const hint = document.getElementById("comment-empty-hint");
  const copyBtn = document.getElementById("copy-comments-btn");
  list.innerHTML = "";
  if (results.length === 0) {
    list.style.display = "none";
    hint.style.display = "";
    hint.textContent = "コメントが見つかりませんでした。";
    copyBtn.disabled = true;
    return;
  }
  hint.style.display = "none";
  list.style.display = "";
  for (const r of results) {
    const li = document.createElement("li");
    li.className = "comment-item";
    const badges = document.createElement("div");
    badges.className = "comment-badges";
    const mkBadge = (cls, text) => {
      const s = document.createElement("span");
      s.className = "comment-badge " + cls;
      s.textContent = text;
      return s;
    };
    badges.appendChild(mkBadge("comment-badge--page", "P" + r.page));
    badges.appendChild(mkBadge("comment-badge--type", annTypeJa(r.subtype)));
    if (r.author)
      badges.appendChild(mkBadge("comment-badge--author", r.author));
    li.appendChild(badges);
    if (r.markedText) {
      const p = document.createElement("p");
      p.className = "comment-marked-text";
      p.textContent = r.markedText;
      li.appendChild(p);
    }
    if (r.contents) {
      const p = document.createElement("p");
      p.className = "comment-body";
      p.textContent = r.contents;
      li.appendChild(p);
    }
    list.appendChild(li);
  }
  copyBtn.disabled = false;
  list.dataset.plain = buildPlainText(results);
}
```

**イベント配線（ファイル末尾）：**

```javascript
setupDrop("pdf-comment-drop", "pdf-comment-input", async (file) => {
  if (file.type !== "application/pdf") {
    toast("PDFファイルを選択してください", true);
    return;
  }
  showLoading();
  try {
    const pdfjsLib = await loadPdfJs();
    const buf = await file.arrayBuffer();
    commentsPdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
    document.getElementById(
      "comment-file-label"
    ).textContent = `読み込み済み: ${file.name} (${commentsPdfDoc.numPages}ページ)`;
    document.getElementById("comment-file-info").style.display = "";
    toast(commentsPdfDoc.numPages + "ページ読み込みました");
  } catch (err) {
    toast("PDF読み込みエラー: " + err.message, true);
  } finally {
    hideLoading();
  }
});

document
  .getElementById("extract-comments-btn")
  .addEventListener("click", extractComments);

document.getElementById("copy-comments-btn").addEventListener("click", () => {
  const plain = document.getElementById("comment-list").dataset.plain ?? "";
  if (!plain) return;
  navigator.clipboard
    .writeText(plain)
    .then(() => toast("クリップボードにコピーしました"))
    .catch(() => toast("コピーに失敗しました", true));
});
```

---

## Step 4 — `style.css`（末尾に追記）

```css
/* ── PDF Comments main view ── */
.pdf-comments-main {
  padding: 20px;
  align-items: flex-start;
  overflow-y: auto;
}
#comment-results-wrap {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}
.comment-empty-hint {
  color: var(--text2);
  font-size: 0.9rem;
  text-align: center;
  margin-top: 40px;
}
.comment-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.comment-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s;
}
.comment-item:hover {
  border-color: var(--accent);
}
.comment-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.comment-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}
.comment-badge--page {
  background: var(--accent);
  color: #fff;
}
.comment-badge--type {
  background: var(--surface2);
  color: var(--text2);
  border: 1px solid var(--border);
}
.comment-badge--author {
  background: transparent;
  color: var(--text2);
  border: 1px solid var(--border);
  font-weight: 400;
  font-style: italic;
}
.comment-marked-text {
  font-size: 0.85rem;
  color: var(--text2);
  background: rgba(108, 99, 255, 0.08);
  border-left: 3px solid var(--accent);
  padding: 6px 10px;
  border-radius: 0 var(--radius) var(--radius) 0;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.comment-body {
  font-size: 0.9rem;
  color: var(--text);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
```

---

## Verification

1. ブラウザで `index.html` を開く
2. PDF タブをクリック → サブナビ「編集」「コメント」が表示されることを確認
3. 編集サブタブが既存機能と同様に動作することを確認
4. コメントサブタブに切り替え → ドロップゾーンが表示される
5. コメント付き PDF をドロップ → 「コメントを抽出」ボタンを押す
6. 作成者・ページ番号・種類・コメント内容が一覧表示されることを確認
7. ハイライトにコメントがある場合、ハイライト対象テキストも表示されることを確認
8. 「コピー」ボタンでクリップボードにプレーンテキストとしてコピーできることを確認
9. 編集タブで PDF を読み込んだ後、コメントタブに切り替えて抽出できることを確認（ファイル再読み込み不要）
