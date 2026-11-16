// Дані з сервера (заповнюються при старті); у коді — лише підписи сторін, нічого особистого
export const DATA = {
  side: 'vona',
  letter: null,
  envelopes: [],
  together: {},
  mine: {},
  mascots: {},
};

// vona — її половина, vin — його
export const SIDES = {
  vona: {
    from: 'Твой',
    partner: 'он',
    partnerWrites: 'Он уже пишет новое ✍️',
    youOpened: 'открыла',
  },
  vin: {
    from: 'Твоя',
    partner: 'она',
    partnerWrites: 'Она уже пишет новое ✍️',
    youOpened: 'открыл',
  },
};

export const who = () => SIDES[DATA.side];
