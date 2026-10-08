/**
 * Tutoriel « Scanner un code-barres » (MagyaPro Boutique).
 *
 * Le téléphone montre la caisse et son scanner (`components/boutique/
 * barcode-scanner.tsx`) : « Scanner » ouvre la caméra en plein écran, cadre
 * de visée et trait rouge, « Visez le code-barres » ; un code inconnu
 * s'annonce en rouge avec « Associer ce code à un produit », qui ouvre « Quel
 * produit porte ce code ? » (`BarcodeLinkSheet` de `pos.tsx`) ; un code connu
 * passe le cadre au vert, « ✓ … ajouté au panier », et « Terminé · N articles ».
 *
 * L'ordinateur montre la même caisse avec une douchette USB : elle tape le
 * code dans la recherche puis Entrée, et l'article s'ajoute (`submitBarcode`).
 *
 * Les produits de « Marché du Coin » n'ont pas de code-barres : c'est le cas
 * du premier jour, que la vidéo montre tel quel. Le code dessiné est un vrai
 * EAN-13 (clé de contrôle juste, codage standard).
 */
(() => {
  const CODE = '6181100023459';
  const PRODUCTS = [
    { k: 'eau', nm: 'Eau minérale 1,5 L', st: '4 cartons', units: [['bouteille', 500], ['carton ×12', 5400]] },
    { k: 'huile', nm: 'Huile végétale 1 L', st: '2 cartons + 6 bouteilles', units: [['bouteille', 1800], ['carton ×12', 20400]] },
    { k: 'jus', nm: 'Jus de fruits 1 L', st: '5 cartons', units: [['bouteille', 1500], ['carton ×6', 8400]] },
    { k: 'lait', nm: 'Lait en poudre 400 g', st: '9 boîtes', low: true, units: [['boîte', 2200], ['carton ×24', 50000]] },
  ];
  const ALL = ['Eau minérale 1,5 L', 'Huile végétale 1 L', 'Jus de fruits 1 L', 'Lait en poudre 400 g', 'Riz parfumé', 'Soda 33 cl', 'Sucre en poudre', 'Tomate concentrée 70 g', 'Œufs'];

  /** Codage EAN-13 réel : modules noirs et blancs, gardes comprises. */
  function ean13(code) {
    const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
    const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
    const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
    const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
    const d = code.split('').map(Number);
    let bits = '101';
    for (let i = 1; i <= 6; i++) bits += (PAR[d[0]][i - 1] === 'L' ? L : G)[d[i]];
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += R[d[i]];
    return bits + '101';
  }
  function barcodeSVG(w, h) {
    const bits = ean13(CODE);
    const m = w / (bits.length + 18);
    const bars = [...bits].map((b, i) => (b === '1' ? `<rect x="${(9 + i) * m}" y="6" width="${m + 0.02}" height="${h - 30}" fill="#111"/>` : '')).join('');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><rect width="${w}" height="${h}" rx="6" fill="#fff"/>${bars}
      <text x="${w / 2}" y="${h - 8}" text-anchor="middle" font-family="DM Mono" font-size="${m * 7.4}" fill="#111" letter-spacing="${m * 1.6}">${CODE[0]} ${CODE.slice(1, 7)} ${CODE.slice(7)}</text></svg>`;
  }
  /** La bouteille d'huile, son étiquette, et le code collé dessus. */
  function bottle() {
    return `<div class="bottle"><div class="cap"></div><div class="neck"></div><div class="body"><div class="lbl"><b>HUILE</b><small>végétale · 1 L</small></div>
      <div class="bc">${barcodeSVG(190, 92)}</div></div></div>`;
  }

  const caret = (s, f) => (s.focus === f ? '<span class="caret"></span>' : '');
  const cartCount = (s, dev) => s.cart[dev];

  // ------------------------------------------------------------ L'ordinateur
  function side() {
    const item = (label, on) => `<div class="nav ${on ? 'on' : ''}"><i></i>${label}</div>`;
    return `<div class="side"><div class="logo">Magya<b>pro</b></div><div class="resto">Marché du Coin<small>MagyaPro Boutique</small></div><h6>Au quotidien</h6>
      ${item('Vue d’ensemble')}${item('Caisse', true)}${item('Ventes')}<h6 style="margin-top:16px">Ma boutique</h6>${item('Produits')}${item('Clients')}</div>`;
  }
  function tile(p) {
    return `<div class="card ptile"><div class="nm">${p.nm}</div><span class="badge ${p.low ? 'warn' : 'ok'}">${p.st} en stock</span>
      <div class="ub">${p.units.map(([l, pr]) => `<span>${l}<b>${fmt(pr).replace(' F CFA', '')}</b></span>`).join('')}</div></div>`;
  }
  function deskHTML(s) {
    const n = cartCount(s, 'd');
    const lines = n ? `<div class="ln" data-born="dl"><div><b>Huile végétale 1 L</b><small>1 800 F CFA / bouteille</small></div><div class="qty"><span>−</span><b data-pop="dq-${n}">${n}</b><span>+</span></div></div>`
      : '<div style="color:var(--ink-faint);padding:12px 0;font-size:14px">Ajoutez des produits pour commencer une vente.</div>';
    return `<div class="app">${side()}<div class="main"><h1>Caisse</h1><div class="lead">Enregistrez une vente.</div>
      <div style="display:grid;grid-template-columns:1fr 340px;gap:18px">
        <div><div style="display:flex;gap:8px;margin-bottom:12px"><div class="input ${s.focus === 'dq' ? 'focus' : ''}" data-t="d-search" style="flex:1">${s.dq ? `<span class="mono">${s.dq}</span>` : ''}${caret(s, 'dq')}${!s.dq && s.focus !== 'dq' ? '<span style="color:var(--ink-faint)">Rechercher un produit ou scanner un code-barres…</span>' : ''}</div><span class="btn sec">Scanner</span></div>
          <div class="pgrid">${PRODUCTS.map(tile).join('')}</div></div>
        <div class="card" style="padding:16px 18px"><div style="font:700 18px/1 Manrope;margin-bottom:6px">Panier</div><div class="lines">${lines}</div>
          <div class="row" style="margin-top:12px;font:800 20px/1.2 Manrope"><span>Total</span><span data-pop="dt-${n}">${fmt(1800 * n)}</span></div>
          <div class="btn wide ${n ? '' : 'off'}" style="margin-top:14px">Encaisser ${fmt(1800 * n)}</div></div></div></div></div>`;
  }

  // ------------------------------------------------------------ Le téléphone
  function scanner(s) {
    const fb = s.fb;
    const frame = fb === 'ok' ? 'ok' : fb === 'ko' ? 'ko' : '';
    const banner = fb === 'ko'
      ? `<div class="fbk ko" data-born="fb-ko">Code ${CODE} inconnu<span class="act" data-t="m-assoc">Associer ce code à un produit</span></div>`
      : fb === 'ok' ? `<div class="fbk ok" data-born="fb-ok-${s.scanCount}">✓ Huile végétale 1 L ajouté au panier</div>` : '';
    return `<div class="cam"><div class="scene"><div class="shelf s1"></div><div class="shelf s2"></div><div class="shelf s3"></div>
        <div class="prod" id="prod">${bottle()}</div></div>
      <div class="aim"><div class="frame ${frame}" data-t="m-frame">${s.camOn && !fb ? '<span class="laser"></span>' : ''}</div><p>${s.camOn ? 'Visez le code-barres' : 'Ouverture de la caméra…'}</p></div>
      ${banner}</div>
      <div class="ctl"><span class="b1">Taper le code</span><span class="b2" data-t="m-done">${s.scanCount ? `Terminé · ${s.scanCount} article${s.scanCount > 1 ? 's' : ''}` : 'Terminé'}</span></div>`;
  }
  function sheet(s) {
    const q = (s.mq || '').toLowerCase();
    const rows = ALL.filter((nm) => !q || nm.toLowerCase().includes(q));
    return `<div class="veil"></div><div class="lsheet" data-sheet><div class="lh"><b>Quel produit porte ce code ?</b><div class="mono" style="margin-top:4px;color:var(--ink-muted);font-size:14px">${CODE}</div>
      <div class="input ${s.focus === 'mq' ? 'focus' : ''}" data-t="m-q" style="margin-top:12px">${s.mq || ''}${caret(s, 'mq')}${!s.mq && s.focus !== 'mq' ? '<span style="color:var(--ink-faint)">Rechercher le produit…</span>' : ''}</div></div>
      <div class="lrows">${rows.map((nm) => `<div data-t="m-pick-${nm.split(' ')[0].toLowerCase()}">${nm}</div>`).join('')}</div>
      <div class="lf"><span class="btn sec wide" style="height:46px">Annuler</span></div></div>`;
  }
  function mobHTML(s) {
    const n = cartCount(s, 'm');
    const header = `<div style="height:56px;display:flex;align-items:center;gap:12px;padding:0 14px;background:var(--card);border-bottom:1px solid var(--border)"><span style="width:40px;height:40px;border:1px solid var(--border);border-radius:10px;display:grid;place-items:center;font-size:20px">☰</span><b style="font-size:16px">Marché du Coin</b></div>`;
    const body = `<h1>Caisse</h1><div class="lead" style="margin-bottom:10px">Enregistrez une vente.</div>
      <div style="display:flex;gap:8px;margin-bottom:12px"><div class="input" style="flex:1;font-size:14px;color:var(--ink-faint)">Rechercher un produit…</div><span class="btn sec scanb" data-t="m-scan"><i class="bci"></i>Scanner</span></div>
      <div style="display:grid;gap:10px">${PRODUCTS.map(tile).join('')}</div>`;
    const bar = `<div style="position:absolute;left:0;right:0;bottom:0;background:var(--raised);border-top:1px solid var(--border);padding:12px 14px 22px;display:flex;align-items:center;gap:12px;box-shadow:0 -10px 24px -14px rgba(33,29,22,.3)">
      <div style="flex:1"><div style="font-size:12.5px;color:var(--ink-muted)">${n ? `${n} article${n > 1 ? 's' : ''}` : 'Panier vide'}</div><div style="font:700 19px/1.2 Manrope" data-pop="mt-${n}">${fmt(1800 * n)}</div></div>
      <span class="btn ${n ? '' : 'sec'}" style="height:46px">Voir le panier</span></div>`;
    return `${header}<div style="position:absolute;left:0;right:0;top:56px;bottom:0;padding:16px;overflow:hidden">${body}</div>${bar}
      ${s.cam ? `<div class="scan" data-born="cam-${s.camN}">${scanner(s)}</div>` : ''}${s.sheet ? sheet(s) : ''}`;
  }

  // ------------------------------------------------------------ Le temps
  let T = {};
  function events(at) {
    T = {
      open1: at('scanner', 0.42), see1: at('inconnu', 0.10), assoc: at('inconnu', 0.62),
      open2: at('direct', 0.14), see2: at('direct', 0.34), see3: at('direct', 0.62), usb: at('douchette', 0.34),
    };
    return [
      // Étape 1 : Scanner, la caméra s'ouvre.
      { t: T.open1, m: 'm-scan', tip: 'Scanner', fn: (s) => { s.cam = true; s.camN = 1; s.camOn = false; s.fb = null; } },
      { t: T.open1 + 0.7, fn: (s) => { s.camOn = true; } },
      // Étape 2 : un code inconnu → l'associer.
      { t: T.see1 + 1.3, fn: (s) => { s.fb = 'ko'; } },
      { t: T.see1 + 1.9, m: 'm-frame', look: true, hold: 0.9, tip: 'Code inconnu', fn: () => {} },
      { t: T.assoc, m: 'm-assoc', tip: 'Associer ce code', fn: (s) => { s.cam = false; s.fb = null; s.sheet = true; } },
      { t: at('inconnu', 0.78), m: 'm-q', tip: 'Le produit', fn: (s) => { s.focus = 'mq'; }, type: { field: 'mq', text: 'huile', dur: 0.4 } },
      { t: at('inconnu', 0.93), m: 'm-pick-huile', tip: 'Huile végétale 1 L', fn: (s) => { s.focus = null; s.sheet = false; s.cart.m = 1; } },
      // Étape 3 : ensuite, un scan suffit.
      { t: T.open2, m: 'm-scan', tip: 'Scanner', fn: (s) => { s.cam = true; s.camN = 2; s.camOn = true; s.fb = null; s.scanCount = 0; } },
      { t: T.see2 + 1.2, fn: (s) => { s.fb = 'ok'; s.scanCount = 1; s.cart.m = 2; } },
      { t: T.see2 + 1.8, m: 'm-frame', look: true, hold: 0.8, tip: 'Ajouté !', fn: () => {} },
      { t: T.see3 + 1.0, fn: (s) => { s.fb = null; } },
      { t: T.see3 + 1.2, fn: (s) => { s.fb = 'ok'; s.scanCount = 2; s.cart.m = 3; } },
      { t: at('direct', 0.92), m: 'm-done', tip: 'Terminé', fn: (s) => { s.cam = false; s.fb = null; } },
      // Sur ordinateur : la douchette tape le code, puis Entrée.
      { t: T.usb, d: 'd-search', look: true, hold: 1.2, tip: 'Douchette USB', fn: (s) => { s.focus = 'dq'; }, type: { field: 'dq', text: CODE, dur: 0.35 } },
      { t: T.usb + 0.9, fn: (s) => { s.dq = ''; s.focus = null; s.cart.d = 1; } },
    ];
  }

  /** La bouteille entre dans le champ au moment de chaque visée. */
  function afterPaint(s, t) {
    const prod = document.querySelector('#mob #prod');
    if (!prod) return;
    const visits = s.camN === 1 ? [[T.see1, 99]] : [[T.see2, T.see3 - 0.2], [T.see3, 99]];
    let y = 120, rot = 8, op = 0;
    for (const [a, b] of visits) {
      if (t < a - 0.1) continue;
      const k = arrive(span(a, a + 1.0, t)), out = span(b, b + 0.4, t);
      y = mix(120, 0, k) + out * 140; rot = mix(10, -2, k) + Math.sin(t * 2.3) * 0.6; op = Math.min(1, k * 2) * (1 - out);
    }
    Object.assign(prod.style, { transform: `translate(-50%, ${y}%) rotate(${rot}deg)`, opacity: String(op) });
    const cam = document.querySelector('#mob .scan');
    if (cam) cam.style.opacity = String(span(s.camN === 1 ? T.open1 : T.open2, (s.camN === 1 ? T.open1 : T.open2) + 0.3, t));
    const glow = (el, a) => el && Object.assign(el.style, { boxShadow: `0 0 0 ${3 * a}px rgba(255,94,46,${a}), 0 0 24px rgba(255,94,46,${0.45 * a})` });
    glow(document.querySelector('#desk .ln'), 1 - span(T.usb + 2.2, T.usb + 3.2, t));
  }

  window.TUTO = {
    produit: 'Boutique',
    theme: { '--side': '#2a2118', '--bg-mid': '#2b2016', '--bg-deep': '#0d0a07' },
    road: [[1, 'Scanner'], [2, 'Associer'], [3, 'Un scan suffit']],
    recap: [['Scanner', 'la caméra s’ouvre en grand'], ['Code inconnu ?', 'associez-le une fois'], ['Ensuite', 'un scan, et c’est au panier']],
    recapAt: [0.06, 0.3, 0.55],
    tagline: 'Un scan, et c’est dans le panier.',
    hook: {
      ring: false,
      slip: '<b>Caisse</b><br>huile… 1 800 ?<br><s>1 500</s><br>riz, sucre,<br>tomate… ???',
      lost: 'On cherche, <em>le client attend.</em>',
    },
    toast: null,
    initState: () => ({ cam: false, camN: 0, camOn: false, fb: null, sheet: false, mq: '', focus: null, scanCount: 0, cart: { m: 0, d: 0 }, dq: '' }),
    events,
    deskHTML,
    mobHTML,
    afterPaint,
    focus: {
      plein: { x: 0, y: 0, w: 1280, h: 800 },
      caisse: { x: 240, y: 60, w: 1030, h: 520 },
    },
    zoneOf: (id) => (id === 'douchette' ? 'caisse' : 'plein'),
    css: `
      .mono { font-family: 'DM Mono'; letter-spacing: .02em; }
      .pgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .ptile { padding: 12px 14px; }
      .ptile .nm { font-weight: 700; font-size: 14.5px; }
      .ptile .badge { margin: 6px 0 10px; }
      .ptile .ub { display: flex; gap: 6px; }
      .ptile .ub span { flex: 1; text-align: center; padding: 7px 4px; border-radius: 10px; border: 1px solid var(--border); font-size: 12.5px; font-weight: 600; line-height: 1.25; background: var(--raised); }
      .ptile .ub span b { display: block; font-size: 14px; }
      .scanb { gap: 6px; }
      .bci { width: 16px; height: 14px; border-left: 2px solid currentColor; border-right: 2px solid currentColor; background: repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 4px); opacity: .85; }

      .scan { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; background: #000; color: #fff; }
      .cam { position: relative; flex: 1; overflow: hidden; }
      .scene { position: absolute; inset: 0; background: linear-gradient(180deg, #4b3a2a, #2b2118 60%, #1b140e); }
      .shelf { position: absolute; left: -10%; right: -10%; height: 90px; filter: blur(7px); opacity: .7;
               background: repeating-linear-gradient(90deg, #c0392b 0 34px, #e9b949 34px 70px, #2e86c1 70px 96px, #27ae60 96px 130px, #ecf0f1 130px 150px); }
      .s1 { top: 8%; } .s2 { top: 42%; } .s3 { top: 76%; }
      .prod { position: absolute; left: 50%; top: 14%; transform-origin: 50% 80%; filter: drop-shadow(0 30px 30px rgba(0,0,0,.6)); }
      .bottle { width: 240px; display: flex; flex-direction: column; align-items: center; }
      .bottle .cap { width: 54px; height: 30px; border-radius: 8px 8px 4px 4px; background: #c0392b; }
      .bottle .neck { width: 70px; height: 46px; background: linear-gradient(90deg, #d9a21b, #f5d262 45%, #c98d10); }
      .bottle .body { width: 240px; height: 380px; border-radius: 46px 46px 30px 30px; background: linear-gradient(90deg, #c98d10, #f4cf55 40%, #ffe48a 52%, #d39a17); display: flex; flex-direction: column; align-items: center; padding-top: 40px; gap: 18px; }
      .bottle .lbl { width: 200px; padding: 14px 0; border-radius: 12px; background: #1d6b3a; text-align: center; color: #fff; }
      .bottle .lbl b { display: block; font: 800 30px/1 Manrope; letter-spacing: .08em; } .bottle .lbl small { font-size: 14px; opacity: .85; }
      .bottle .bc { padding: 4px; border-radius: 8px; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
      .aim { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 0 30px; }
      .frame { position: relative; width: 100%; aspect-ratio: 16/9; border: 3px solid rgba(255,255,255,.9); border-radius: 18px; box-shadow: 0 0 0 1000px rgba(0,0,0,.45); }
      .frame.ok { border-color: #34d399; } .frame.ko { border-color: #f87171; }
      .laser { position: absolute; left: 16px; right: 16px; top: 50%; height: 2px; border-radius: 2px; background: rgba(239,68,68,.85); box-shadow: 0 0 12px rgba(239,68,68,.8); }
      .aim p { margin: 0; padding: 8px 16px; border-radius: 99px; background: rgba(0,0,0,.55); font-size: 14px; font-weight: 600; }
      .fbk { position: absolute; left: 16px; right: 16px; top: 16px; padding: 12px 16px; border-radius: 16px; text-align: center; font-size: 15.5px; font-weight: 700; box-shadow: 0 12px 30px -10px rgba(0,0,0,.6); }
      .fbk.ok { background: #10b981; } .fbk.ko { background: #ef4444; }
      .fbk .act { display: block; margin-top: 12px; padding: 13px 0; border-radius: 12px; background: #fff; color: #dc2626; font-size: 15.5px; }
      .ctl { display: flex; gap: 8px; padding: 14px 16px 26px; background: #000; }
      .ctl span { flex: 1; height: 48px; border-radius: 12px; display: grid; place-items: center; font-weight: 600; }
      .ctl .b1 { border: 1px solid rgba(255,255,255,.25); color: rgba(255,255,255,.85); font-size: 14px; }
      .ctl .b2 { background: #fff; color: #000; font-size: 15.5px; }
      .veil { position: absolute; inset: 0; z-index: 21; background: rgba(33,29,22,.5); }
      .lsheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 22; max-height: 85%; display: flex; flex-direction: column; background: var(--card); border-radius: 22px 22px 0 0; }
      .lh { padding: 16px; border-bottom: 1px solid var(--border); } .lh b { font-size: 16.5px; }
      .lrows { padding: 8px; }
      .lrows div { padding: 13px 12px; border-radius: 12px; font-weight: 600; font-size: 14.5px; }
      .lf { padding: 12px 16px 22px; border-top: 1px solid var(--border); }
    `,
  };
})();
