// ── Utilities ──
export function showLoading() {
  document.getElementById('loading').classList.add('active');
}

export function hideLoading() {
  document.getElementById('loading').classList.remove('active');
}

export function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

export function setupDrop(zoneId, inputId, onFile) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });
  input.addEventListener('change', () => {
    if (input.files[0]) onFile(input.files[0]);
    input.value = '';
  });
}
