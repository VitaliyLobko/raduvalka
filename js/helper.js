// «✨ Помочь написать»: повод і настрій стрічками, довжина, свої слова → «Придумать» одразу під ними →
// 3 чернетки карточками (гортаються вбік). Або «Поправить» свій текст. Чернетка лише лягає в поле — далі людина сама
import { send } from './api.js';
import { h, toast, ribbon } from './ui.js';

const REASONS = ['скучаю', 'просто так', 'доброе утро', 'спокойной ночи', 'тяжёлый день', 'горжусь тобой', 'спасибо', 'мечты о встрече'];
const OWN = '✎ свой';
// Настрій — замість трьох повзунків: одна кнопка задає і жарт, і поетичність, і пристрасть
const TONES = [
  { v: 'tender', label: '💗 нежно', funny: 15, poetic: 25, passion: 0 },
  { v: 'flirt', label: '😏 флирт', funny: 55, poetic: 10, passion: 55 },
  { v: 'passion', label: '🔥 страстно', funny: 10, poetic: 35, passion: 90 },
  { v: 'fun', label: '😄 с юмором', funny: 75, poetic: 10, passion: 0 },
  { v: 'poetic', label: '🌸 красиво', funny: 15, poetic: 80, passion: 0 },
  { v: 'plain', label: '🙂 просто', funny: 30, poetic: 5, passion: 0 },
];
const LENGTHS = [{ v: '20', label: 'коротко' }, { v: '70', label: 'подробно' }];
const FIXES = [
  { v: 'warm', label: '💗 теплее' },
  { v: 'short', label: '✂️ короче' },
  { v: 'fun', label: '😄 веселее' },
  { v: 'fix', label: '✓ без ошибок' },
];

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

// Стрічка, що гортається вбік, з тим самим таючим краєм, що й «Когда»
function ribbonChips(items, picked, onPick) {
  const c = chips(items, picked, onPick);
  c.el.classList.add('help-ribbon');
  ribbon(c.el);
  return c;
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
  const open = h('button', { type: 'button', class: 'btn help-open', 'aria-expanded': 'false' }, '✨ Помочь написать');
  const panel = h('div', { class: 'help-panel', hidden: true });
  box.replaceChildren(open, panel);

  const own = h('input', { type: 'text', maxlength: '200', placeholder: 'Например: у тебя завтра собеседование', 'aria-label': 'Свой повод', hidden: true });
  const reason = ribbonChips([...REASONS, OWN].map((v) => ({ v, label: v })), REASONS[0], (v) => {
    own.hidden = v !== OWN;
    if (!own.hidden) own.focus();
  });
  const tone = ribbonChips(TONES, TONES[0].v);
  const long = chips(LENGTHS, LENGTHS[0].v);
  long.el.classList.add('help-length');
  const words = h('textarea', {
    'data-voice': true,
    class: 'help-words',
    maxlength: '400',
    rows: '1',
    placeholder: 'Что обязательно сказать?',
    'aria-label': 'Что обязательно сказать',
  });

  const results = h('div', { class: 'mk-results', 'aria-live': 'polite' });
  const go = h('button', { type: 'button', class: 'btn btn-primary mk-go' }, '✨ Придумать');

  const fixBox = h('div', { class: 'help-fix', hidden: true },
    h('p', { class: 'mk-label' }, 'Или поправить мой текст'),
    h('div', { class: 'mk-chips' }, ...FIXES.map(({ v, label }) => h('button', {
      type: 'button',
      class: 'mk-chip',
      onclick: (e) => fixText(v, e.currentTarget),
    }, label))));
  const paintFix = () => { fixBox.hidden = area.value.trim().length < 10; };
  area.addEventListener('input', paintFix);

  // Зверху вниз, як читається: про що → який настрій і довжина → свої слова → кнопка → чернетки.
  // У документ — лише з першим «Помочь написать»: стрічки зі спостерігачами гальмували відкриття вікна
  const build = () => {
    if (panel.childElementCount) return;
    panel.append(
      h('p', { class: 'mk-label' }, 'Повод'), reason.el, own,
      h('div', { class: 'help-tone-row' }, h('p', { class: 'mk-label' }, 'Настроение'), long.el),
      tone.el,
      words,
      go,
      results,
      fixBox);
  };

  // Помічник відкритий — переписка над полем ховається, місце йому
  const toggle = (show) => {
    if (show) build();
    panel.hidden = !show;
    open.setAttribute('aria-expanded', String(show));
    open.textContent = show ? '✨ Свернуть' : '✨ Помочь написать';
    box.closest('.sheet')?.classList.toggle('is-helping', show);
    paintFix();
  };
  open.addEventListener('click', () => toggle(panel.hidden));

  const draft = async () => {
    const r = reason.value() === OWN ? own.value.trim() : reason.value();
    if (!r) { own.focus(); return; }
    const t = TONES.find((x) => x.v === tone.value()) || TONES[0];
    go.disabled = true;
    results.replaceChildren(h('p', { class: 'mk-wait' }, 'Подбираю слова… это 5–10 секунд'));
    try {
      const { drafts } = await send('letter-ideas', 'POST', {
        mode: 'draft', reason: r, words: words.value, focus: '',
        funny: t.funny, long: Number(long.value()), poetic: t.poetic, passion: t.passion,
      });
      if (!drafts?.length) throw new Error('empty');
      // Карточки вбік: видно, що варіантів кілька; тап — чернетка в полі, помічник згортається
      const cards = h('div', { class: 'help-drafts' }, ...drafts.map((d) => h('button', {
        type: 'button', class: 'help-draft',
        onclick: () => { putIntoArea(area, d); toggle(false); },
      }, h('span', { class: 'help-draft-text' }, d), h('span', { class: 'help-draft-take' }, 'Взять →'))));
      results.replaceChildren(
        h('p', { class: 'mk-label' }, `${drafts.length} варианта — листай вбок, тап — в письмо`),
        cards,
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
