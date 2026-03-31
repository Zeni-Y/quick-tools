// ── Tab switching ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Image sub-tab switching ──
document.querySelectorAll('.sub-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const subtab = btn.dataset.subtab;
    // Update active button
    document.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Show matching sidebar, hide others
    document.querySelectorAll('#tab-image .panel-sidebar').forEach(sb => {
      sb.style.display = sb.dataset.sidebar === subtab ? '' : 'none';
    });
  });
});

// ── Load feature modules ──
import './mosaic.js';
import './resize.js';
import './crop.js';
import './pdf.js';
import './text.js';
