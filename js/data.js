// Дані з сервера (заповнюються при старті); у коді — лише підписи сторін, нічого особистого
export const DATA = {
  side: 'vona',
  letter: null,
  gift: null,
  wishes: null,
  envelopes: [],
  partnerEnvelopes: [],
  together: {},
  mine: {},
  mascots: {},
};

// vona — її половина, vin — його
export const SIDES = {
  vona: {
    from: 'Твой',
    partner: 'он',
    partnerKnows: 'Он узнает, что тут пусто ✍️',
    youOpened: 'открыла',
    toWhom: 'ему',
    partnerOpened: 'открыл',
  },
  vin: {
    from: 'Твоя',
    partner: 'она',
    partnerKnows: 'Она узнает, что тут пусто ✍️',
    youOpened: 'открыл',
    toWhom: 'ей',
    partnerOpened: 'открыла',
  },
};

export const who = () => SIDES[DATA.side];
