/* ═══════════════════════════════════════════════════════════
   UI — tiny shared UI helpers (toast).
   ═══════════════════════════════════════════════════════════ */

let toastEl = null;
let toastTimer = null;

function ensureToast() {
  if (toastEl) return toastEl;
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.id = 'toast';
  document.body.appendChild(toastEl);
  return toastEl;
}

export function toast(message) {
  const el = ensureToast();
  el.textContent = message;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2000);
}
