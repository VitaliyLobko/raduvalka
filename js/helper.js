// «✨ Помочь написать»: повод + повзунки → 3 чернетки від ШІ; або «Поправить» свій текст.
// Чернетка лише лягає в поле — далі людина править і надсилає сама
import { send } from './api.js';
import { h, toast } from './ui.js';

const REASONS = ['скучаю', 'доброе утро', 'спокойной ночи', 'тяжёлый день', 'горжусь тобой', 'спасибо', 'просто так'];
const OWN = '✎ свой повод';
const FOCUS = [
  { v: '', label: 'как пойдёт' },
  { v: 'today', label: 'про сегодня' },
  { v: 'memory', label: 'вспомнить нас' },
  { v: 'future', label: 'мечты о встрече' },
];
const FIXES = [
  { v: 'warm', label: '💗 теплее' },
  { v: 'short', label: '✂️ короче' },
  { v: 'fun', label: '😄 веселее' },
  { v: 'fix', label: '✓ без ошибок' },
];

function slider(left, right, value) {
  const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(value), 'aria-label': `${left} или ${right}` });
  return { el: h('div', { class: 'mk-slider' }, h('span', {}, left), input, h('span', {}, right)), value: () => Number(input.value) };
}

function chips(items, picked, onPick) {
  const row = h('div', { class: 'mk-chips', role: 'radiogroup' });
  const paint = () => row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === picked)));
  items.forEach(({ v, label }) => row.append(h('button', {
    type: 'button', role: 'radio', class: 'mk-chip', 'data-v': v,
    onclick: () => { picked = v; paint(); onPick?.(v); },
  }, label)));
  paint();
  return { el: row, value: () => picked };
}

// Покласти текст у поле листа; свій попередній текст можна повернути одним тапом
function putIntoArea(area, text) {
  const prev = area.value;
  area.value = text;
  area.dispatchEvent(new Event('input'));
  area.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (prev.trim() && prev !== text) {
    const undo = h('button', {
      type: 'button',
      class: 'help-undo',
      onclick: () => { area.value = prev; area.dispatchEvent(new Event('input')); undo.remove(); },
    }, '↩ вернуть мой текст');
    area.before(undo);
    setTimeout(() => undo.remove(), 15000);
  }
}

export function mountHelper(box, area) {
  const open = h('button', { type: 'button', class: 'btn help-open' }, '✨ Помочь написать');
  const panel = h('div', { class: 'help-panel', hidden: true });
  box.replaceChildren(open, panel);

  const own = h('input', { type: 'text', maxlength: '200', placeholder: 'Например: у тебя завтра собеседование', 'aria-label': 'Свой повод', hidden: true });
  const reason = chips([...REASONS, OWN].map((v) => ({ v, label: v })), REASONS[0], (v) => {
    own.hidden = v !== OWN;
    if (!own.hidden) own.focus();
  });
  const words = h('textarea', {
    'data-voice': true,
    class: 'help-words',
    maxlength: '400',
    rows: '2',
    placeholder: 'Пара своих слов: что сказать или что вспомнить (можно пусто)',
    'aria-label': 'Что обязательно сказать',
  });
  const focus = chips(FOCUS, '');
  const funny = slider('нежно', 'игриво', 25);
  const long = slider('коротко', 'подробно', 35);
  const poetic = slider('просто', 'поэтично', 25);

  const results = h('div', { class: 'mk-results', 'aria-live': 'polite' });
  const go = h('button', { type: 'button', class: 'btn btn-primary mk-go' }, '✨ Придумать');

  const fixBox = h('div', { class: 'mk-group help-fix', hidden: true },
    h('p', { class: 'mk-label' }, 'Поправить мой текст'),
    h('div', { class: 'mk-chips' }, ...FIXES.map(({ v, label }) => h('button', {
      type: 'button',
      class: 'mk-chip',
      onclick: (e) => fixText(v, e.currentTarget),
    }, label))));
  const paintFix = () => { fixBox.hidden = area.value.trim().length < 10; };
  area.addEventListener('input', paintFix);

  panel.append(
    h('div', { class: 'mk-group' }, h('p', { class: 'mk-label' }, 'Повод'), reason.el, own),
    h('div', { class: 'mk-group' }, h('p', { class: 'mk-label' }, 'О чём'), focus.el, words),
    h('div', { class: 'mk-group' }, h('p', { class: 'mk-label' }, 'Тон'), funny.el, long.el, poetic.el),
    go,
    results,
    fixBox);

  open.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    open.setAttribute('aria-expanded', String(!panel.hidden));
    open.textContent = panel.hidden ? '✨ Помочь написать' : '✨ Свернуть помощника';
    paintFix();
  });

  const draft = async () => {
    const r = reason.value() === OWN ? own.value.trim() : reason.value();
    if (!r) { own.focus(); return; }
    go.disabled = true;
    results.replaceChildren(h('p', { class: 'mk-wait' }, 'Подбираю слова… это 5–10 секунд'));
    try {
      const { drafts } = await send('letter-ideas', 'POST', {
        mode: 'draft', reason: r, words: words.value, focus: focus.value(),
        funny: funny.value(), long: long.value(), poetic: poetic.value(),
      });
      if (!drafts?.length) throw new Error('empty');
      results.replaceChildren(
        h('p', { class: 'mk-label' }, 'Тап — черновик ляжет в письмо, дальше правь как хочешь'),
        ...drafts.map((d) => h('button', { type: 'button', class: 'help-draft', onclick: () => putIntoArea(area, d) }, d)),
        h('button', { type: 'button', class: 'btn mk-reroll', onclick: draft }, '🎲 Ещё варианты'));
    } catch {
      results.replaceChildren(h('p', { class: 'mk-wait' }, 'Не получилось — проверь интернет и попробуй ещё раз.'));
    }
    go.disabled = false;
  };
  go.addEventListener('click', draft);

  async function fixText(kind, btn) {
    const text = area.value.trim();
    if (!text) return;
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = '…';
    try {
      const { text: fixed } = await send('letter-ideas', 'POST', { mode: 'fix', fix: kind, text });
      if (!fixed) throw new Error('empty');
      putIntoArea(area, fixed);
      toast('Готово — проверь и поправь, если что');
    } catch {
      toast('Не получилось — попробуй ещё раз');
    }
    btn.textContent = was;
    btn.disabled = false;
  }
}
