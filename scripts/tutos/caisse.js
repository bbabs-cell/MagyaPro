/**
 * Tutoriel « Encaisser une vente » (MagyaPro Boutique).
 *
 * Écrans reconstruits d'après `components/boutique/pos.tsx` : grille de
 * produits avec un bouton par unité (« Bouteille », « Carton ×12 »), panier
 * à droite sur ordinateur et en feuille sur téléphone, paiement par mode et
 * montant, « Encaisser » puis « Vente n°… enregistrée ». Produits et prix de
 * la boutique de démonstration « Marché du Coin ».
 */
(() => {
  const PRODUCTS = [
    { k: 'eau', nm: 'Eau minérale 1,5 L', base: 500, units: [['u', 'Bouteille', 1, 500], ['c', 'Carton ×12', 12, 5400]], stock: 48, fmtStock: (n) => `${Math.floor(n / 12)} cartons` },
    { k: 'riz', nm: 'Riz parfumé', base: 900, units: [['u', 'Kilo', 1, 900], ['c', 'Sac ×25', 25, 20000]], stock: 210, fmtStock: (n) => `${Math.floor(n / 25)} sacs + ${n % 25} kg` },
    { k: 'huile', nm: 'Huile végétale 1 L', units: [['u', 'Litre', 1, 1800], ['c', 'Carton ×12', 12, 20400]], stock: 30, fmtStock: (n) => `${Math.floor(n / 12)} cartons + ${n % 12} L` },
    { k: 'sucre', nm: 'Sucre en poudre', units: [['u', 'Kilo', 1, 1000], ['c', 'Sac ×50', 50, 46000]], stock: 120, fmtStock: (n) => `${Math.floor(n / 50)} sacs + ${n % 50} kg` },
    { k: 'lait', nm: 'Lait en poudre 400 g', units: [['u', 'Boîte', 1, 2200], ['c', 'Carton ×24', 24, 50000]], stock: 9, fmtStock: (n) => `${n} boîtes`, low: true },
    { k: 'oeufs', nm: 'Œufs', units: [['u', 'Pièce', 1, 125], ['c', 'Plateau ×30', 30, 3400]], stock: 60, fmtStock: (n) => `${Math.floor(n / 30)} plateaux` },
  ];
  const METHODS = ['Espèces', 'Orange Money', 'Moov Money', 'Carte', 'Wave'];
  const unitOf = (l) => PRODUCTS.find((p) => p.k === l.k).units.find((u) => u[0] === l.u);
  const total = (s) => s.lines.reduce((a, l) => a + unitOf(l)[3] * l.q, 0);
  const count = (s) => s.lines.reduce((a, l) => a + l.q, 0);
  function add(s, k, u) {
    const line = s.lines.find((l) => l.k === k && l.u === u);
    if (line) line.q += 1;
    else s.lines.push({ k, u, q: 1 });
  }
  const caret = (s, f) => (s.focus === f ? '<span class="caret"></span>' : '');

  function side() {
    const item = (label, on) => `<div class="nav ${on ? 'on' : ''}"><i></i>${label}</div>`;
    return `<div class="side"><div class="logo">Magya<b>pro</b></div><div class="resto">Marché du Coin<small>MagyaPro Boutique</small></div><h6>Au quotidien</h6>
      ${item('Vue d’ensemble')}${item('Caisse', true)}${item('Ventes')}<h6 style="margin-top:16px">Ma boutique</h6>${item('Produits')}${item('Clients')}</div>`;
  }
  function tile(s, p) {
    const sold = s.sold ? s.lines.filter((l) => l.k === p.k).reduce((a, l) => a + unitOf(l)[2] * l.q, 0) : 0;
    const stock = p.stock - (s.done ? s.soldUnits[p.k] || 0 : sold);
    return `<div class="card ptile" data-t="tile-${p.k}"><div class="nm">${p.nm}</div>
      <span class="badge ${p.low ? 'warn' : 'ok'}" ${s.done && s.soldUnits[p.k] ? `data-pop="st-${p.k}"` : ''}>${p.fmtStock(stock)} en stock</span>
      <div class="ub">${p.units.map((u) => `<span data-t="u-${p.k}-${u[0]}">${u[1]}<b>${fmt(u[3]).replace(' F CFA', '')}</b></span>`).join('')}</div></div>`;
  }
  function cart(s) {
    const lines = s.lines.map((l) => {
      const p = PRODUCTS.find((x) => x.k === l.k), u = unitOf(l);
      return `<div class="ln" data-born="${l.k}-${l.u}"><div><b>${p.nm}</b><small>${fmt(u[3])} / ${u[1].replace(/ ×\d+/, '').toLowerCase()}</small></div>
        <div class="qty"><span>−</span><b data-pop="q-${l.k}-${l.q}">${l.q}</b><span data-t="plus-${l.k}">+</span></div></div>`;
    }).join('');
    const tot = total(s);
    const paid = Number((s.amount || '').replace(/\D/g, '')) || 0;
    const rest = Math.max(0, tot - paid);
    return `<div style="font:700 18px/1 Manrope;margin-bottom:6px">Panier</div>
      ${s.done ? `<div class="okmsg" data-born="ok">Vente n°413 enregistrée — ${fmt(s.doneTotal)}</div>` : ''}
      <div class="lines">${lines || '<div style="color:var(--ink-faint);padding:12px 0;font-size:14px">Ajoutez des produits pour commencer une vente.</div>'}</div>
      <div class="row" style="margin-top:12px"><span style="color:var(--ink-muted)">Sous-total</span><span>${fmt(tot)}</span></div>
      <div class="row" style="margin-top:6px;font:800 22px/1.2 Manrope"><span>Total</span><span data-pop="tot-${count(s)}">${fmt(tot)}</span></div>
      <div class="label">Client (facultatif)</div><div class="input ph">Aucun</div>
      <div class="label">Paiement</div>
      <div style="display:flex;gap:8px;position:relative"><div class="input ${s.focus === 'method' ? 'focus' : ''}" data-t="method" style="flex:1">${s.method}<span style="margin-left:auto;color:var(--ink-faint)">▾</span></div>
        <div class="input ${s.amount ? '' : 'ph'} ${s.focus === 'amount' ? 'focus' : ''}" data-t="amount" style="width:120px">${s.amount || (s.focus === 'amount' ? '' : '0')}${caret(s, 'amount')}</div>
        ${s.menu ? `<div class="menu" data-born="menu">${METHODS.map((m) => `<div data-t="m-${m}" class="${m === s.method ? 'on' : ''}">${m}</div>`).join('')}</div>` : ''}</div>
      <div style="margin-top:8px;color:var(--accent);font-size:14px;font-weight:600">+ Scinder le paiement</div>
      ${tot && rest ? `<div style="margin-top:8px;font-size:13.5px;color:var(--ink-muted)">Reste non couvert : <b>${fmt(rest)}</b></div>` : ''}
      <div class="btn wide ${tot && !rest ? '' : 'off'}" data-t="pay" style="margin-top:14px">Encaisser ${fmt(tot)}</div>`;
  }
  function deskHTML(s) {
    return `<div class="app">${side()}<div class="main"><h1>Caisse</h1><div class="lead">Enregistrez une vente.</div>
      <div style="display:grid;grid-template-columns:1fr 360px;gap:18px">
        <div><div class="card row" style="padding:12px 16px;margin-bottom:12px"><div><b>Caisse principale</b> <span class="badge ok">Ouverte</span></div><span class="btn sec" style="height:36px">Dépôt / Retrait</span></div>
          <div style="display:flex;gap:8px;margin-bottom:12px"><div class="input ph" style="flex:1">Rechercher un produit ou scanner un code-barres…</div><span class="btn sec">Scanner</span></div>
          <div class="pgrid">${PRODUCTS.map((p) => tile(s, p)).join('')}</div></div>
        <div class="card" style="padding:16px 18px">${cart(s)}</div></div></div></div>`;
  }
  function mobHTML(s) {
    const header = `<div style="height:56px;display:flex;align-items:center;gap:12px;padding:0 14px;background:var(--card);border-bottom:1px solid var(--border)"><span style="width:40px;height:40px;border:1px solid var(--border);border-radius:10px;display:grid;place-items:center;font-size:20px">☰</span><b style="font-size:16px">Marché du Coin</b></div>`;
    const body = `<h1>Caisse</h1><div class="lead" style="margin-bottom:10px">Enregistrez une vente.</div>
      <div style="display:flex;gap:8px;margin-bottom:12px"><div class="input ph" style="flex:1;font-size:14px">Rechercher un produit…</div><span class="btn sec">Scanner</span></div>
      <div style="display:grid;gap:10px">${PRODUCTS.slice(0, 4).map((p) => tile(s, p)).join('')}</div>`;
    const bar = !s.sheet ? `<div style="position:absolute;left:0;right:0;bottom:0;background:var(--raised);border-top:1px solid var(--border);padding:12px 14px 22px;display:flex;align-items:center;gap:12px;box-shadow:0 -10px 24px -14px rgba(33,29,22,.3)">
      <div style="flex:1"><div style="font-size:12.5px;color:var(--ink-muted)">${count(s) ? `${count(s)} article${count(s) > 1 ? 's' : ''}` : 'Panier vide'}</div><div style="font:700 19px/1.2 Manrope" data-pop="mtot-${count(s)}">${fmt(total(s))}</div></div>
      <span class="btn ${count(s) ? '' : 'sec'}" data-t="see" style="height:46px">Voir le panier</span></div>` : '';
    const sheet = s.sheet ? `<div style="position:absolute;inset:0;background:rgba(33,29,22,.4)"></div><div data-sheet style="position:absolute;left:0;right:0;bottom:0;max-height:92%;overflow:hidden;background:var(--card);border-radius:22px 22px 0 0;padding:16px 16px 22px">${cart(s)}</div>` : '';
    return `${header}<div style="position:absolute;left:0;right:0;top:56px;bottom:0;padding:16px;overflow:hidden">${body}</div>${bar}${sheet}`;
  }

  function events(at) {
    return [
      // Étape 1 : les produits, chacun au bon bouton d'unité.
      { t: at('produits', 0.42), d: 'u-eau-c', m: 'u-eau-c', tip: 'Un carton d’eau', fn: (s) => add(s, 'eau', 'c') },
      { t: at('produits', 0.74), d: 'u-riz-u', m: 'u-riz-u', tip: 'Un kilo de riz', fn: (s) => add(s, 'riz', 'u') },
      { t: at('quantite', 0.40), d: 'plus-riz', m: 'u-riz-u', tip: 'Encore un kilo', fn: (s) => add(s, 'riz', 'u') },
      // Étape 2 : le panier et le paiement.
      { t: at('paiement', 0.16), m: 'see', tip: 'Voir le panier', fn: (s) => { s.sheet = true; } },
      { t: at('paiement', 0.42), d: 'method', m: 'method', tip: 'Le mode de paiement', fn: (s) => { s.menu = true; s.focus = 'method'; } },
      { t: at('paiement', 0.60), d: 'm-Espèces', m: 'm-Espèces', tip: 'Espèces', fn: (s) => { s.menu = false; s.method = 'Espèces'; s.focus = null; } },
      { t: at('paiement', 0.80), d: 'amount', m: 'amount', tip: 'Le montant reçu', fn: (s) => { s.focus = 'amount'; }, type: { field: 'amount', text: '7 200', dur: 0.6 } },
      // Étape 3 : encaisser.
      { t: at('encaisser', 0.32), d: 'pay', m: 'pay', tip: 'Touchez « Encaisser »', chime: true,
        fn: (s) => {
          s.focus = null;
          s.soldUnits = {};
          for (const l of s.lines) s.soldUnits[l.k] = (s.soldUnits[l.k] || 0) + unitOf(l)[2] * l.q;
          s.doneTotal = total(s);
          s.done = true;
          s.lines = [];
          s.amount = '';
        } },
    ];
  }

  window.TUTO = {
    produit: 'Boutique',
    theme: { '--side': '#2a2118', '--bg-mid': '#2b2016', '--bg-deep': '#0d0a07' },
    road: [[1, 'Les produits'], [2, 'Le paiement'], [3, 'Encaisser']],
    recap: [['Les produits', 'à l’unité ou au carton'], ['Le paiement', 'mode et montant reçu'], ['Encaisser', 'le stock se met à jour']],
    recapAt: [0.08, 0.34, 0.6],
    tagline: 'Vendez au carton comme à l’unité, sans calculer de tête.',
    hook: {
      ring: false,
      slip: '<b>Cahier — lundi</b><br>3 eau<br><s>1 carton</s> ?<br>riz 2 kg<br>total : ????<br>— manque 3 500',
      lost: 'La caisse <em>ne tombe pas juste.</em>',
    },
    toast: null,
    initState: () => ({ lines: [], sheet: false, menu: false, method: 'Espèces', amount: '', focus: null, done: false, soldUnits: {} }),
    events,
    deskHTML,
    mobHTML,
    focus: {
      plein: { x: 0, y: 0, w: 1280, h: 800 },
      produits: { x: 250, y: 170, w: 650, h: 420 },
      panier: { x: 900, y: 70, w: 370, h: 470 },
      panierBas: { x: 900, y: 300, w: 370, h: 470 },
    },
    zoneOf: (id) => (['produits', 'quantite'].includes(id) ? 'produits' : id === 'paiement' ? 'panierBas' : id === 'encaisser' ? 'panier' : 'plein'),
    css: `
      .pgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .ptile { padding: 12px 14px; }
      .ptile .nm { font-weight: 700; font-size: 14.5px; min-height: 36px; }
      .ptile .badge { margin: 6px 0 10px; }
      .ptile .ub { display: flex; gap: 6px; }
      .ptile .ub span { flex: 1; text-align: center; padding: 7px 4px; border-radius: 10px; border: 1px solid var(--border); font-size: 12.5px; font-weight: 600; line-height: 1.25; background: var(--raised); }
      .ptile .ub span b { display: block; font-size: 14px; }
      .mob .ptile .nm { min-height: 0; }
      .menu { position: absolute; left: 0; right: 128px; top: 50px; z-index: 5; background: var(--raised); border: 1px solid var(--border); border-radius: 14px; padding: 6px; box-shadow: 0 16px 30px -14px rgba(33,29,22,.5); }
      .menu div { padding: 9px 10px; border-radius: 9px; font-size: 14.5px; }
      .menu div.on { background: var(--app-bg); font-weight: 700; }
      .okmsg { margin: 4px 0 8px; padding: 12px 14px; border-radius: 12px; background: var(--ok-soft); color: var(--ok); font-weight: 700; font-size: 15px; }
    `,
  };
})();
