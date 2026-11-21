// Голосовий ввід: поле з data-voice отримує кнопку 🎤. Розпізнає браузер (Web Speech API, на Android — Chrome);
// де його нема — кнопки просто не з'являється. Одна фраза за натиск: пауза — кінець, ще натиск — зупинити
import { h, toast } from './ui.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const ERRORS = {
  'not-allowed': 'Разреши микрофон для Радовалки в настройках браузера',
  'service-not-allowed': 'Разреши микрофон для Радовалки в настройках браузера',
  'audio-capture': 'Микрофон не найден',
  network: 'Голосом — только с интернетом',
  'no-speech': 'Ничего не слышно. Нажми 🎤 и говори',
};

let active = null;
export const canDictate = !!SR;

function stop() {
  if (!active) return;
  const { rec } = active;
  active = null;
  try { rec.stop(); } catch { /* уже зупинено */ }
}

// onEnd — після кінця запису (рядок вводу міняє 🎤 на ➤, коли в полі з'явився текст)
export function listen(field, btn, onEnd = null) {
  const same = active?.field === field;
  stop();
  if (same) return;

  const rec = new SR();
  rec.lang = 'ru-RU';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  // Сказане дописуємо після вже набраного; після крапки чи в порожньому полі — з великої літери
  const base = field.value;
  const sep = base && !/\s$/.test(base) ? ' ' : '';
  const capital = !base.trim() || /[.!?…]\s*$/.test(base);
  const max = field.maxLength > 0 ? field.maxLength : Infinity;
  const me = { rec, field };
  active = me;

  const paint = (on) => {
    btn.classList.toggle('is-listening', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Остановить запись' : 'Сказать голосом');
  };

  rec.onresult = (e) => {
    // Поле закрили разом зі шторкою — далі не пишемо
    if (!field.isConnected) { stop(); return; }
    let said = Array.from(e.results, (r) => r[0].transcript).join(' ').replace(/\s+/g, ' ').trim();
    if (!said) return;
    if (capital) said = said[0].toUpperCase() + said.slice(1);
    field.value = (base + sep + said).slice(0, max);
    // Чернетки, лічильники й прев'ю слухають input
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  rec.onerror = (e) => {
    if (e.error !== 'aborted') toast(ERRORS[e.error] || 'Голосом не вышло — попробуй ещё');
  };
  rec.onend = () => {
    if (active === me) active = null;
    paint(false);
    onEnd?.();
  };

  try {
    rec.start();
    paint(true);
  } catch {
    active = null;
    toast('Голосом не вышло — попробуй ещё');
  }
}

// Обгортка: поле + кнопка в кутку; фокус і курсор переживають переміщення поля
function wrap(field) {
  const focused = document.activeElement === field;
  const sel = focused ? [field.selectionStart, field.selectionEnd] : null;
  const box = h('span', { class: `voice-wrap${field.tagName === 'TEXTAREA' ? ' is-area' : ''}` });
  const btn = h('button', {
    type: 'button', class: 'voice-btn', 'aria-label': 'Сказать голосом', 'aria-pressed': 'false', html: MIC,
    onclick: () => listen(field, btn),
  });
  field.replaceWith(box);
  box.append(field, btn);
  if (focused) {
    field.focus();
    try { field.setSelectionRange(...sel); } catch { /* не всі поля вміють */ }
  }
}

function scan(root) {
  if (root.nodeType !== 1) return;
  const found = root.matches('[data-voice]') ? [root] : [...root.querySelectorAll('[data-voice]')];
  for (const f of found) if (!f.parentElement?.classList.contains('voice-wrap')) wrap(f);
}

export function initVoice() {
  if (!SR) return;
  new MutationObserver((list) => {
    for (const m of list) m.addedNodes.forEach(scan);
  }).observe(document.body, { childList: true, subtree: true });
  scan(document.body);
  // Сховали застосунок посеред запису — мікрофон відпускаємо
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
}
