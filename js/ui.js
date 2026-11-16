// Спільні дрібниці інтерфейсу
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.filter((c) => c != null && c !== false));
  return el;
}

const toastEl = document.getElementById('toast');
let toastTimer;
export function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-shown'), 2400);
}

export const cap = (s) => s[0].toUpperCase() + s.slice(1);

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Стріла Стрільця — малюнком, бо символ ♐ телефони показують емодзі
export const SAGITTARIUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 19 5"/><path d="M11 5h8v8"/><path d="M7 11l6 6"/></svg>`;

export const ARROW = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 19 5"/><path d="M12 5h7v7"/><path d="M4 20l1.5-4.5M4 20l4.5-1.5"/></svg>`;
