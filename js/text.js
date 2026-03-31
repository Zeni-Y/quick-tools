import { toast } from './utils.js';

const inputEl = document.getElementById('text-input');
const outputEl = document.getElementById('text-output');

// --- 文字数カウント（リアルタイム）---
function updateStats() {
  const text = inputEl.value;
  document.getElementById('stat-total').textContent = text.length.toLocaleString();
  document.getElementById('stat-nospace').textContent = text.replace(/[\s\u3000]/g, '').length.toLocaleString();
  document.getElementById('stat-lines').textContent = text === '' ? 0 : text.split('\n').length.toLocaleString();
  document.getElementById('stat-words').textContent = text.trim() === '' ? 0 : text.trim().split(/\s+/).length.toLocaleString();
}
inputEl.addEventListener('input', updateStats);

// --- 全空白削除 ---
document.getElementById('remove-whitespace').addEventListener('click', () => {
  outputEl.value = inputEl.value.replace(/[\s\u3000]/g, '');
  toast('全空白を削除しました');
});

// --- コメント行削除 ---
document.getElementById('remove-comments').addEventListener('click', () => {
  const markers = [...document.querySelectorAll('.comment-marker:checked')].map(cb => cb.value);
  if (markers.length === 0) { toast('コメント記号を選択してください', true); return; }
  const escaped = markers.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`^[ \\t]*(${escaped.join('|')}).*$`, 'gm');
  outputEl.value = inputEl.value
    .replace(pattern, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  toast('コメント行を削除しました');
});

// --- 出力をコピー ---
document.getElementById('text-copy-output').addEventListener('click', async () => {
  if (!outputEl.value) { toast('出力が空です', true); return; }
  await navigator.clipboard.writeText(outputEl.value);
  toast('コピーしました');
});

// --- 出力を入力に反映 ---
document.getElementById('text-apply-to-input').addEventListener('click', () => {
  if (!outputEl.value) { toast('出力が空です', true); return; }
  inputEl.value = outputEl.value;
  outputEl.value = '';
  updateStats();
  toast('出力を入力に反映しました');
});

// --- クリア ---
document.getElementById('text-clear').addEventListener('click', () => {
  inputEl.value = '';
  outputEl.value = '';
  updateStats();
});
