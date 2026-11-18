// Юпітер і Земля в стилі їхньої листівки — вектором, в координатах листівки 300×400
// Юпітер: центр (222, 84), r 58. Земля: центр (78, 318), r 56. Обидві обертаються:
// візерунок — смуга шириною в період P, поруч її копія, група їде ліворуч на P
let uid = 0;

const JUP = { cx: 222, cy: 84, r: 58, P: 240 };
const EARTH = { cx: 78, cy: 318, r: 56, P: 224 };

// Хвиляста лінія, періодична на P (гармоніки — цілі числа на період, тому шов не видно)
function wave(x0, P, y, amp, k, phase) {
  const pts = [];
  for (let x = 0; x <= P; x += 4) {
    const t = (x / P) * Math.PI * 2;
    const dy = amp * Math.sin(k * t + phase) + amp * 0.45 * Math.sin((2 * k + 1) * t + phase * 1.7);
    pts.push([x0 + x, y + dy]);
  }
  return pts;
}

function band(x0, P, y1, y2, amp, k, phase) {
  const top = wave(x0, P, y1, amp, k, phase);
  const bottom = wave(x0, P, y2, amp * 0.8, k + 1, phase + 1.3).reverse();
  return `M${[...top, ...bottom].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
}

function line(x0, P, y, amp, k, phase) {
  return `M${wave(x0, P, y, amp, k, phase).map(([x, yy]) => `${x.toFixed(1)} ${yy.toFixed(1)}`).join('L')}`;
}

function jupiterStrip(x0) {
  const { P } = JUP;
  // [верх, низ, колір, амплітуда, гармоніка, фаза]
  const belts = [
    [26, 36, '#D99A63', 1.4, 3, 0.2],
    [39, 46, '#EDB27C', 1.2, 4, 1.1],
    [50, 60, '#E58C47', 2.0, 3, 2.0],
    [65, 79, '#D2642B', 2.4, 4, 0.7],
    [92, 104, '#DE7A39', 2.2, 3, 2.6],
    [108, 113, '#F2B57C', 1.2, 5, 1.4],
    [117, 125, '#E79A5C', 1.6, 4, 0.3],
    [129, 135, '#DDA06A', 1.2, 3, 2.2],
    [138, 146, '#C98D5C', 1.0, 3, 1.0],
  ];
  const fills = belts.map(([a, b, c, amp, k, ph]) => `<path d="${band(x0, P, a, b, amp, k, ph)}" fill="${c}"/>`).join('');
  const edges = belts.map(([a, , , amp, k, ph]) => `<path d="${line(x0, P, a, amp, k, ph)}"/>`).join('');
  // Світлі завитки в екваторіальній зоні та фестони
  const wisps = [
    `M${x0 + 20} 84c8-3 14 2 22-1`, `M${x0 + 96} 86c10-4 16 3 26-1`, `M${x0 + 170} 83c8-3 14 2 22 0`,
  ].join(' ');
  const festoons = [
    `M${x0 + 40} 80c4 4 10 6 16 5`, `M${x0 + 120} 80c3 5 9 7 15 6`, `M${x0 + 200} 80c4 4 9 6 15 5`,
  ].join(' ');
  return `
    ${fills}
    <g fill="none" stroke="#9E4419" stroke-width=".7" opacity=".45">${edges}</g>
    <path d="${wisps}" fill="none" stroke="#FFF3DE" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    <path d="${festoons}" fill="none" stroke="#A9501F" stroke-width="1.3" stroke-linecap="round" opacity=".45"/>
    <g transform="translate(${x0 + 78} 106)">
      <ellipse rx="17" ry="9" fill="#F6C79A"/>
      <ellipse rx="13" ry="6.4" fill="#C9482A"/>
      <path d="M-8 0c2-4 10-4 13-1 2 2-1 4-5 3" fill="none" stroke="#E87650" stroke-width="1.4" stroke-linecap="round"/>
      <ellipse cx="-2" cy="-1" rx="4" ry="1.8" fill="#E2683F"/>
    </g>
    <ellipse cx="${x0 + 30}" cy="121" rx="4.5" ry="2.4" fill="#FFF4E0" opacity=".9"/>
    <ellipse cx="${x0 + 150}" cy="127" rx="3.6" ry="2" fill="#FFF4E0" opacity=".85"/>
    <ellipse cx="${x0 + 190}" cy="56" rx="3.2" ry="1.7" fill="#FFF4E0" opacity=".7"/>`;
}

// Карта світу на розгортці шириною P (0…224): Америки, Атлантика, Європа й Африка, Азія, Австралія
function earthLand(x0) {
  const t = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(+x + x0).toFixed(1)},${y}`);
  const land = [
    // Північна Америка
    'M10,284 C14,276 22,271 32,270 C40,269 46,271 48,278 C50,283 54,276 60,276 C66,277 68,284 64,290 C60,295 58,300 56,304 C55,309 54,314 51,311 C49,307 46,307 42,309 C39,312 38,317 35,318 C31,318 30,313 27,309 C24,304 20,300 16,296 C12,292 8,290 10,284 Z',
    // Ґренландія
    'M62,268 C66,264 74,264 77,268 C79,273 74,278 69,277 C64,276 60,272 62,268 Z',
    // Центральна та Південна Америка
    'M36,318 C38,321 41,323 44,325 C50,322 58,324 64,330 C70,336 70,344 65,352 C60,360 56,366 52,372 C49,374 47,368 47,360 C47,352 43,345 42,338 C41,332 40,328 36,322 Z',
    // Європа
    'M100,286 C104,280 112,278 118,280 C122,282 124,287 121,291 C118,294 114,293 111,296 C107,298 102,297 100,293 C98,290 98,288 100,286 Z',
    // Африка
    'M100,302 C106,298 116,297 124,301 C130,304 133,311 131,318 C129,325 125,331 123,338 C121,346 118,354 113,357 C109,359 107,351 106,344 C105,337 101,331 99,325 C97,318 95,309 100,302 Z',
    // Мадагаскар
    'M127,342 C129,340 131,342 130,346 C129,349 126,348 127,342 Z',
    // Азія
    'M122,280 C130,272 142,268 156,267 C170,266 184,268 194,274 C200,278 200,285 195,290 C191,294 188,298 185,303 C182,308 178,312 174,309 C170,306 168,310 164,313 C161,316 158,318 156,314 C154,309 151,306 148,304 C144,302 140,303 137,300 C134,297 131,294 127,292 C123,290 120,286 122,280 Z',
    // Індія
    'M150,304 C154,304 158,306 158,310 C158,315 155,320 153,322 C151,318 149,313 150,304 Z',
    // Індонезія
    'M172,322 C176,320 182,321 184,323 C182,325 176,326 172,322 Z M186,326 C189,325 193,326 194,328 C191,330 188,329 186,326 Z',
    // Австралія
    'M182,338 C188,334 198,334 204,338 C208,342 207,350 202,354 C197,357 190,356 186,352 C182,349 179,342 182,338 Z',
  ];
  return land.map(t);
}

function earthClouds(x0) {
  const c = [
    [14, 300, 18], [52, 340, 14], [86, 292, 20], [118, 352, 16], [150, 330, 18], [176, 296, 14], [206, 360, 16],
  ];
  return c.map(([x, y, w]) => `M${x0 + x} ${y}c${w * 0.3}-3 ${w * 0.7}-3 ${w} 0`).join(' ');
}

export function planetsSvg() {
  const u = `p${++uid}`;
  const jx0 = JUP.cx - JUP.r - 6;
  const ex0 = EARTH.cx - EARTH.r;
  const land = (x0) => earthLand(x0).map((d) => `<path d="${d}"/>`).join('');

  return `
<defs>
  <clipPath id="${u}-j"><circle cx="${JUP.cx}" cy="${JUP.cy}" r="${JUP.r}"/></clipPath>
  <clipPath id="${u}-e"><circle cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r}"/></clipPath>
  <radialGradient id="${u}-limb" cx=".38" cy=".34" r=".72">
    <stop offset=".6" stop-color="#5a1d05" stop-opacity="0"/>
    <stop offset=".88" stop-color="#5a1d05" stop-opacity=".22"/>
    <stop offset="1" stop-color="#3d1203" stop-opacity=".5"/>
  </radialGradient>
  <radialGradient id="${u}-ocean" cx=".4" cy=".36" r=".8">
    <stop offset="0" stop-color="#56C6C2"/>
    <stop offset=".7" stop-color="#2A9AA3"/>
    <stop offset="1" stop-color="#17707F"/>
  </radialGradient>
  <radialGradient id="${u}-eshade" cx=".38" cy=".34" r=".72">
    <stop offset=".58" stop-color="#03222b" stop-opacity="0"/>
    <stop offset=".9" stop-color="#03222b" stop-opacity=".28"/>
    <stop offset="1" stop-color="#021820" stop-opacity=".55"/>
  </radialGradient>
  <radialGradient id="${u}-glow" r=".5">
    <stop offset=".86" stop-color="#9BE7F0" stop-opacity=".45"/>
    <stop offset="1" stop-color="#9BE7F0" stop-opacity="0"/>
  </radialGradient>
</defs>

<g class="jupiter">
  <g clip-path="url(#${u}-j)">
    <rect x="${JUP.cx - JUP.r}" y="${JUP.cy - JUP.r}" width="${JUP.r * 2}" height="${JUP.r * 2}" fill="#F9E6C2"/>
    <g class="spin-j">
      <g id="${u}-jstrip">${jupiterStrip(jx0)}</g>
      <use href="#${u}-jstrip" x="${JUP.P}"/>
    </g>
    <circle cx="${JUP.cx}" cy="${JUP.cy}" r="${JUP.r}" fill="url(#${u}-limb)"/>
    <path d="M${JUP.cx - 46} ${JUP.cy - 26}a54 54 0 0 1 40-32" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>
  </g>
  <circle cx="${JUP.cx}" cy="${JUP.cy}" r="${JUP.r}" fill="none" stroke="#24201d" stroke-width="3"/>
</g>

<g class="earth">
  <circle cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r + 7}" fill="url(#${u}-glow)"/>
  <g clip-path="url(#${u}-e)">
    <rect x="${ex0}" y="${EARTH.cy - EARTH.r}" width="${EARTH.r * 2}" height="${EARTH.r * 2}" fill="url(#${u}-ocean)"/>
    <g class="spin-e">
      <g id="${u}-land" fill="#8FBB4C" stroke="#557F27" stroke-width="1.3" stroke-linejoin="round">${land(ex0)}</g>
      <use href="#${u}-land" x="${EARTH.P}"/>
    </g>
    <g class="spin-c">
      <path id="${u}-clouds" d="${earthClouds(ex0)}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>
      <use href="#${u}-clouds" x="${EARTH.P}"/>
    </g>
    <ellipse cx="${EARTH.cx}" cy="${EARTH.cy - EARTH.r + 3}" rx="26" ry="7" fill="#F4FBFF" opacity=".9"/>
    <ellipse cx="${EARTH.cx}" cy="${EARTH.cy + EARTH.r - 2}" rx="30" ry="7" fill="#F4FBFF" opacity=".9"/>
    <circle cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r}" fill="url(#${u}-eshade)"/>
    <path d="M${EARTH.cx - 44} ${EARTH.cy - 24}a52 52 0 0 1 38-30" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".38"/>
  </g>
  <circle cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r}" fill="none" stroke="#1d2a2c" stroke-width="3"/>
</g>`;
}

