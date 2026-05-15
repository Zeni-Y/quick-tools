/**
 * PDF コメント抽出機能の E2E テスト
 * - cMapUrl が正しく設定されていること（CJK テキスト抽出）
 * - ハイライト対象テキストが抽出されること
 * - バージョンバッジが表示されること
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PDF_PATH = resolve(ROOT, 'samples/jnlp_zenimoto_question_guiding_v11-rh-comments.pdf');

const TARGET_COMMENT = '分かりにくいです．実環境における有効性とは何かが分からない．前段と後段は分けたほうがよい．';
const TARGET_MARKED  = '音声対話による実環境での実証実験を通して';

test.use({ baseURL: 'http://localhost:8080' });

test.describe('PDF コメント抽出', () => {

  test('バージョンバッジが表示される', async ({ page }) => {
    await page.goto('/');
    const badge = page.locator('.version-badge');
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(text).toMatch(/^v\d+\.\d+\.\d+$/);
    console.log('バージョン:', text);
  });

  test('PDFを読み込んでコメントとハイライトテキストを抽出できる', async ({ page }) => {
    await page.goto('/');

    // PDF タブへ切り替え
    await page.click('.tab-btn[data-tab="pdf"]');
    await expect(page.locator('#tab-pdf')).toHaveClass(/active/);

    // コメントサブタブへ切り替え
    await page.locator('#tab-pdf .sub-nav-btn[data-subtab="comments"]').click();
    await expect(page.locator('#tab-pdf aside[data-sidebar="comments"]')).toBeVisible();

    // PDF をファイル入力でロード
    const pdfBytes = readFileSync(PDF_PATH);
    await page.locator('#pdf-comment-input').setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBytes,
    });

    // 読み込み完了を待つ
    await expect(page.locator('#comment-file-info')).toBeVisible({ timeout: 30000 });
    console.log('PDF 読み込み完了');

    // 「コメントを抽出」ボタンをクリック
    await page.click('#extract-comments-btn');

    // ローディング終了を待つ（最大90秒 — 40ページ分の処理）
    await expect(page.locator('.loading')).not.toHaveClass(/active/, { timeout: 90000 });
    console.log('抽出処理完了');

    // コメントリストが表示される
    const list = page.locator('#comment-list');
    await expect(list).toBeVisible({ timeout: 10000 });

    // 全コメント件数を確認
    const items = list.locator('.comment-item');
    const count = await items.count();
    console.log('抽出件数:', count);
    expect(count).toBeGreaterThan(50);

    // ハイライト対象テキスト（markedText）を全件取得
    const markedTexts = await list.locator('.comment-marked-text').allTextContents();
    console.log('markedText 件数:', markedTexts.length);
    if (markedTexts.length > 0) {
      console.log('最初の markedText:', markedTexts[0].slice(0, 60));
    }

    // ターゲットの markedText が含まれているか
    const hasTargetMarked = markedTexts.some(t => t.includes(TARGET_MARKED));
    if (!hasTargetMarked) {
      console.error('ターゲット markedText が見つかりません。取得サンプル:');
      markedTexts.slice(0, 5).forEach(t => console.log(' -', t.slice(0, 60)));
    }
    expect(hasTargetMarked, `"${TARGET_MARKED}" が markedText に含まれること`).toBe(true);

    // ターゲットコメント本文の確認
    const commentBodies = await list.locator('.comment-body').allTextContents();
    const hasTargetComment = commentBodies.some(t => t.includes(TARGET_COMMENT.slice(0, 20)));
    expect(hasTargetComment, `ターゲットコメントが含まれること`).toBe(true);

    // コピー・Markdown保存ボタンが有効
    await expect(page.locator('#copy-comments-btn')).toBeEnabled();
    await expect(page.locator('#save-markdown-btn')).toBeEnabled();
  });

});
