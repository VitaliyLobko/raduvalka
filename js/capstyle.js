// Налаштування підпису для фото й гифки: вкладки «Вид · Шрифт · Цвет», під ними — один рядок варіантів вибраної
import { h, ribbon } from './ui.js';
import { CAP_COLORS, CAP_COLOR_NAMES, CAP_FONTS } from './memes.js';
import { ownColor } from './colorpick.js';

// ↶ ↷ для обох редакторів
const svg = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const histButtons = (onUndo, onRedo) => [
  h('button', { type: 'button', class: 'ph-tool ph-hist', 'aria-label': 'Отменить', disabled: true, html: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'), onclick: onUndo }),
  h('button', { type: 'button', class: 'ph-tool ph-hist', 'aria-label': 'Повторить', disabled: true, html: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'), onclick: onRedo }),
];

export const CAP_LOOKS =['meme', 'hand', 'plate', 'bubble', 'tape', 'neon'];
const LOOK_NAMES = { meme: 'Мем', hand: 'Рукой', plate: 'Плашка', bubble: 'Облачко', tape: 'Скотч', neon: 'Неон' };

// belowLabel — назва «під картинкою»; onLook(v), onFont(v — '' це шрифт виду), onColor(i — номер кружка, або hex), onPipette()
export function capStyle({ belowLabel, onLook, onFont, onColor, onPipette }) {
  let tab = 'look';
  const radio = (label, v, pick, extra = {}) => h('button', {
    type: 'button', role: 'radio', class: 'mk-chip', 'data-v': v, onclick: () => pick(v), ...extra,
  }, label);
  const looks = h('div', { class: 'mk-chips mk-row ph-looks', role: 'radiogroup', 'aria-label': 'Вид подписи' },
    radio(belowLabel, 'below', onLook), ...CAP_LOOKS.map((v) => radio(LOOK_NAMES[v], v, onLook)));
  // Назва шрифту — ним самим: файл шрифту вантажиться, лише коли вкладку відкрили
  const fonts = h('div', { class: 'mk-chips mk-row ph-looks ph-fonts', role: 'radiogroup', 'aria-label': 'Шрифт подписи' },
    radio('Обычный', '', onFont),
    ...CAP_FONTS.map((f) => radio(f.label, f.v, onFont, { style: `font-family:'${f.family}';font-weight:${f.weight}` })));
  const own = ownColor({ label: 'Цвет подписи', onPick: onColor, onPipette });
  const colors = h('div', { class: 'ph-swatches ph-cap-colors', role: 'radiogroup', 'aria-label': 'Цвет подписи' },
    ...CAP_COLORS.map((c, i) => h('button', {
      type: 'button', class: 'ph-swatch', role: 'radio', style: `--c:${c}`, 'data-v': String(i), 'aria-label': CAP_COLOR_NAMES[i],
      onclick: () => onColor(i),
    })), own.el);
  const panes = { look: h('div', { class: 'ph-pane' }, looks), font: h('div', { class: 'ph-pane' }, fonts), color: h('div', { class: 'ph-pane' }, colors) };
  ribbon(looks);
  ribbon(fonts);
  const tabBtn = (k, label) => h('button', {
    type: 'button', role: 'tab', class: 'ph-tab', 'data-k': k, onclick: () => { tab = k; paint(last); },
  }, label);
  const tabs = [tabBtn('look', 'Вид'), tabBtn('font', 'Шрифт'), tabBtn('color', 'Цвет')];
  const el = h('div', { class: 'ph-capstyle', hidden: true }, h('div', { class: 'ph-tabs', role: 'tablist', 'aria-label': 'Подпись' }, ...tabs), panes.look, panes.font, panes.color);

  // s: { text, look, font, color — hex, preset — номер кружка або -1, armed — піпетка чекає }
  let last = null;
  function paint(s) {
    last = s;
    el.hidden = !s.text;
    // «Под фото» — звичайний текст: ні шрифту, ні кольору в нього нема
    const plain = s.look === 'below';
    if (plain) tab = 'look';
    tabs.forEach((b) => {
      b.hidden = plain && b.dataset.k !== 'look';
      b.setAttribute('aria-selected', String(b.dataset.k === tab));
    });
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== tab;
    looks.querySelectorAll('.mk-chip').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === s.look)));
    fonts.querySelectorAll('.mk-chip').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === (s.font || ''))));
    colors.querySelectorAll('.ph-swatch[data-v]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.v === s.preset)));
    own.paint(s.color, s.preset >= 0, s.armed);
  }
  return { el, paint };
}
