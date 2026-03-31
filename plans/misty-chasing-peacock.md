# Plan: 文章ツール追加

## Context

Quick Tools に新しいタブ「文章ツール」を追加する。
既存の画像ツール・PDF ツールと同じ tab/panel パターンで実装する。

機能:

1. **文字数カウント** — 入力に連動してリアルタイム表示（全体・空白除く・行数・単語数）
2. **全空白削除** — スペース・タブ・全角スペース・改行をすべて除去
3. **コメント行削除** — 先頭が指定記号（%, #, //, ;, --）の行を除去（複数選択可）

---

## 変更ファイル

| ファイル     | 変更内容                                         |
| ------------ | ------------------------------------------------ |
| `index.html` | タブボタン追加 + 文章ツールセクション追加        |
| `style.css`  | テキストエリア・2 カラムレイアウト用スタイル追加 |
| `js/text.js` | 新規：文章ツールロジック                         |
| `js/app.js`  | `import './text.js'` 追加                        |

---

## HTML 構造 (index.html)

### タブボタン（ヘッダーに追記）

```html
<button class="tab-btn" data-tab="text">文章ツール</button>
```

### セクション（`#tab-pdf` の後に追加）

```html
<section id="tab-text" class="tab-content">
  <div class="panel-layout">
    <!-- Sidebar -->
    <aside class="panel-sidebar">
      <!-- 文字数カウント -->
      <div class="sidebar-section">
        <h3>文字数カウント</h3>
        <div class="text-stats">
          <div class="text-stat-row">
            <span>文字数（全体）</span><span id="stat-total">0</span>
          </div>
          <div class="text-stat-row">
            <span>文字数（空白除く）</span><span id="stat-nospace">0</span>
          </div>
          <div class="text-stat-row">
            <span>行数</span><span id="stat-lines">0</span>
          </div>
          <div class="text-stat-row">
            <span>単語数</span><span id="stat-words">0</span>
          </div>
        </div>
      </div>

      <!-- 空白除去 -->
      <div class="sidebar-section">
        <h3>空白除去</h3>
        <div class="sidebar-btn-group">
          <button class="btn" id="remove-whitespace">全空白を削除</button>
        </div>
      </div>

      <!-- コメント除去 -->
      <div class="sidebar-section">
        <h3>コメント行除去</h3>
        <div class="sidebar-group" style="margin-bottom:10px">
          <!-- checkboxes for %, #, //, ;, -- -->
          <label style="flex-direction:row;align-items:center;gap:6px;">
            <input type="checkbox" class="comment-marker" value="%" /> %
          </label>
          ...（同様に #, //, ;, --）
        </div>
        <div class="sidebar-btn-group">
          <button class="btn" id="remove-comments">コメント行を削除</button>
        </div>
      </div>

      <!-- 操作 -->
      <div class="sidebar-section">
        <h3>操作</h3>
        <div class="sidebar-btn-group">
          <button class="btn btn-outline" id="text-copy-output">
            出力をコピー
          </button>
          <button class="btn btn-outline" id="text-apply-to-input">
            出力を入力に反映
          </button>
          <button class="btn btn-danger btn-outline" id="text-clear">
            クリア
          </button>
        </div>
      </div>
    </aside>

    <!-- Main: input / output -->
    <div class="panel-main text-main">
      <div class="text-panels">
        <div class="text-panel">
          <div class="text-panel-label">入力</div>
          <textarea
            id="text-input"
            class="text-area"
            placeholder="テキストを入力またはペーストしてください..."
          ></textarea>
        </div>
        <div class="text-panel">
          <div class="text-panel-label">出力</div>
          <textarea
            id="text-output"
            class="text-area"
            readonly
            placeholder="変換結果がここに表示されます..."
          ></textarea>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## CSS 追加スタイル (style.css)

```css
/* ── Text Tool ── */
.text-main {
  padding: 16px !important;
  align-items: stretch !important;
}
.text-panels {
  display: flex;
  gap: 12px;
  width: 100%;
  flex: 1;
  min-height: 0;
}
.text-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.text-panel-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text2);
  margin-bottom: 6px;
}
.text-area {
  flex: 1;
  min-height: 400px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  font-family: monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  resize: none;
}
.text-area:focus {
  outline: none;
  border-color: var(--accent);
}
.text-area[readonly] {
  background: var(--surface2);
  color: var(--text2);
}
.text-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.text-stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text2);
}
.text-stat-row span:last-child {
  color: var(--text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
/* レスポンシブ */
@media (max-width: 768px) {
  .text-panels {
    flex-direction: column;
  }
}
```

---

## JS ロジック (js/text.js)

```javascript
import { toast } from "./utils.js";

const inputEl = document.getElementById("text-input");
const outputEl = document.getElementById("text-output");

// --- 文字数カウント（リアルタイム）---
function updateStats() {
  const text = inputEl.value;
  document.getElementById("stat-total").textContent =
    text.length.toLocaleString();
  document.getElementById("stat-nospace").textContent = text
    .replace(/\s/g, "")
    .length.toLocaleString();
  document.getElementById("stat-lines").textContent =
    text === "" ? 0 : text.split("\n").length.toLocaleString();
  document.getElementById("stat-words").textContent =
    text.trim() === "" ? 0 : text.trim().split(/\s+/).length.toLocaleString();
}
inputEl.addEventListener("input", updateStats);

// --- 全空白削除 ---
document.getElementById("remove-whitespace").addEventListener("click", () => {
  const result = inputEl.value.replace(/[\s\u3000]/g, "");
  outputEl.value = result;
  toast("全空白を削除しました");
});

// --- コメント行削除 ---
document.getElementById("remove-comments").addEventListener("click", () => {
  const markers = [...document.querySelectorAll(".comment-marker:checked")].map(
    (cb) => cb.value
  );
  if (markers.length === 0) {
    toast("コメント記号を選択してください", true);
    return;
  }
  const escaped = markers.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`^[ \t]*(${escaped.join("|")}).*$`, "gm");
  // 空行も削除
  const result = inputEl.value
    .replace(pattern, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  outputEl.value = result;
  toast("コメント行を削除しました");
});

// --- 出力をコピー ---
document
  .getElementById("text-copy-output")
  .addEventListener("click", async () => {
    if (!outputEl.value) {
      toast("出力が空です", true);
      return;
    }
    await navigator.clipboard.writeText(outputEl.value);
    toast("コピーしました");
  });

// --- 出力を入力に反映 ---
document.getElementById("text-apply-to-input").addEventListener("click", () => {
  if (!outputEl.value) {
    toast("出力が空です", true);
    return;
  }
  inputEl.value = outputEl.value;
  outputEl.value = "";
  updateStats();
  toast("出力を入力に反映しました");
});

// --- クリア ---
document.getElementById("text-clear").addEventListener("click", () => {
  inputEl.value = "";
  outputEl.value = "";
  updateStats();
});
```

---

## 検証方法

ブラウザで `index.html` を開いて：

1. 「文章ツール」タブが表示されることを確認
2. テキストをペースト → 文字数がリアルタイム更新される
3. 「全空白を削除」→ 出力エリアにスペース・改行除去済みテキストが表示される
4. コメント記号をチェックして「コメント行を削除」→ 対象行が除去される
5. 「出力をコピー」→ クリップボードにコピーされる
6. 「出力を入力に反映」→ 入力に反映され、文字数が更新される
