// ── Tab switching ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Sub-tab switching (image + pdf 共通) ──
document.querySelectorAll('.sub-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const subtab = btn.dataset.subtab;
    const parentTab = btn.closest('.tab-content');
    btn.closest('.sub-nav').querySelectorAll('.sub-nav-btn')
      .forEach(b => b.classList.toggle('active', b === btn));
    parentTab.querySelectorAll('.panel-sidebar').forEach(sb => {
      sb.style.display = sb.dataset.sidebar === subtab ? '' : 'none';
    });
    parentTab.querySelectorAll('[data-view]').forEach(v => {
      v.style.display = v.dataset.view === subtab ? '' : 'none';
    });
  });
});

// ── Load feature modules ──
import './mosaic.js';
import './resize.js';
import './crop.js';
import './pdf.js';
import './text.js';
