/**
 * Tutoriel « Ajouter un produit, à l'unité et au carton » (MagyaPro Boutique).
 *
 * L'ordinateur montre la page Produits et sa fiche (`components/boutique/
 * product-manager.tsx`, dans l'ordre réel des champs : nom, prix, « Vendez-vous
 * aussi par carton, sac ou paquet ? », stock initial en cartons + pièces,
 * statut, « Enregistrer »). Le téléphone montre la caisse
 * (`components/boutique/pos.tsx`) : le produit y est vendable dès qu'il est
 * enregistré en « Actif » — un produit en brouillon n'y apparaît pas.
 *
 * Unités, produits et prix de la boutique de démonstration « Marché du Coin ».
 */
(() => {
  // Les unités de la boutique, dans leur ordre (la pièce, unité de stock par défaut, exclue).
  const UNITS = ['kg', 'g', 'L', 'mL', 'bouteille', 'bidon', 'boîte', 'sachet', 'paquet', 'carton', 'sac', 'plateau', 'caisse'];
  const LIST = [
    { nm: 'Lait en poudre 400 g', cat: 'Frais', pr: 2200, alt: 'carton ×24 : 50 000 F CFA', st: '9 boîtes', low: true },
    { nm: 'Œufs', cat: 'Frais', pr: 125, alt: 'plateau ×30 : 3 400 F CFA', st: '2 plateaux' },
    { nm: 'Soda 33 cl', cat: 'Boissons', pr: 600, alt: 'caisse ×24 : 13 200 F CFA', st: '3 caisses + 4 bouteilles' },
    { nm: 'Jus de fruits 1 L', cat: 'Boissons', pr: 1500, alt: 'carton ×6 : 8 400 F CFA', st: '5 cartons' },
    { nm: 'Eau minérale 1,5 L', cat: 'Boissons', pr: 500, alt: 'carton ×12 : 5 400 F CFA', st: '4 cartons' },
  ];
  const TILES = [
    { k: 'eau', nm: 'Eau minérale 1,5 L', st: '4 cartons', units: [['bouteille', 500], ['carton ×12', 5400]] },
    { k: 'huile', nm: 'Huile végétale 1 L', st: '2 cartons + 6 bouteilles', units: [['bouteille', 1800], ['carton ×12', 20400]] },
    { k: 'jus', nm: 'Jus de fruits 1 L', st: '5 cartons', units: [['bouteille', 1500], ['carton ×6', 8400]] },
    { k: 'lait', nm: 'Lait en poudre 400 g', st: '9 boîtes', low: true, units: [['boîte', 2200], ['carton ×24', 50000]] },
  ];
  const NEW = { nm: 'Savon de ménage 200 g', cost: '260', price: '350', factor: '24', cprice: '7800', packs: '5', extra: '8' };

  const caret = (s, f) => (s.focus === f ? '<span class="caret"></span>' : '');
  const val = (s, f, ph = '') => `${s[f] || ''}${caret(s, f)}${!s[f] && s.focus !== f && ph ? `<span style="color:var(--ink-faint)">${ph}</span>` : ''}`;
  const inp = (s, f, key, ph, style = '') => `<div class="input ${s.focus === f ? 'focus' : ''}" data-t="${key}" style="${style}">${val(s, f, ph)}</div>`;
  const sel = (label, key, on) => `<div class="input ${on ? 'focus' : ''}" data-t="${key}">${label}<span style="margin-left:auto;color:var(--ink-faint)">▾</span></div>`;

  function side() {
    const item = (label, on) => `<div class="nav ${on ? 'on' : ''}"><i></i>${label}</div>`;
    return `<div class="side"><div class="logo">Magya<b>pro</b></div><div class="resto">Marché du Coin<small>MagyaPro Boutique</small></div><h6>Au quotidien</h6>
      ${item('Vue d’ensemble')}${item('Caisse')}${item('Ventes')}<h6 style="margin-top:16px">Ma boutique</h6>${item('Produits', true)}${item('Clients')}${item('Achats')}</div>`;
  }

  // ------------------------------------------------------------ La fiche
  function formHTML(s) {
    const cond = s.cond ? `<div class="cgrid" data-born="cond">
        <label><span>Unité</span>${sel(s.unit, 'cu-unit', s.menu === 'unit')}
          ${s.menu === 'unit' ? `<div class="umenu" data-born="umenu">${UNITS.map((u) => `<div data-t="mu-${u}" class="${u === s.unit ? 'on' : ''}">${u}</div>`).join('')}</div>` : ''}</label>
        <label><span>Contient (pièces)</span>${inp(s, 'factor', 'cu-factor', '20')}</label>
        <label><span>Prix vente (F CFA)</span>${inp(s, 'cprice', 'cu-price')}</label>
        <label><span>Coût achat (F CFA)</span><div class="input"></div></label><span class="x">✕</span></div>` : '';
    const packs = s.cond && s.unit === 'carton' && s.factor;
    const stock = packs
      ? `<div class="grid3" data-t="st-grid"><div><div class="label">cartons en stock</div>${inp(s, 'packs', 'st-packs', '0')}<div class="hint">Chaque carton contient ${s.factor} pièces.</div></div>
          <div><div class="label">pièces en plus</div>${inp(s, 'extra', 'st-extra', '0')}</div>
          <div><div class="label">Seuil d'alerte stock bas</div><div class="input">0</div></div></div>`
      : `<div class="grid2" data-t="st-grid"><div><div class="label">Stock initial</div><div class="input">0</div></div><div><div class="label">Seuil d'alerte stock bas</div><div class="input">0</div></div></div>`;
    return `<div class="card fcard" data-born="form"><div style="font:600 20px/1.2 Manrope">Nouveau produit</div>
      <div class="label">Nom <span class="req">*</span></div>${inp(s, 'name', 'f-name', 'T-shirt col rond')}
      <div class="grid2"><div><div class="label">Catégorie</div>${sel('Aucune', 'f-cat')}</div><div><div class="label">Marque</div>${sel('Aucune', 'f-brand')}</div></div>
      <div class="grid2"><div><div class="label">Coût d'achat (F CFA) <span class="req">*</span></div>${inp(s, 'cost', 'f-cost', '0')}</div>
        <div><div class="label">Prix de vente (F CFA) <span class="req">*</span></div>${inp(s, 'price', 'f-price')}</div></div>
      <div class="fs"><span class="lg">Ce produit existe en plusieurs versions ?</span><div class="hint" style="margin:0">Le même tee-shirt en rouge et en bleu, la même huile en 1 L et en 5 L. Laissez vide si votre produit n'existe qu'en une seule version.</div>
        <span class="btn sec sm" style="margin-top:12px">+ Autre chose qui change</span></div>
      <div class="opt ${s.open ? 'open' : ''}"><div class="sum" data-t="opt-carton"><span><b>Vendez-vous aussi par carton, sac ou paquet ?</b><small>Pour acheter ou vendre en gros, avec un prix différent de l'unité.</small></span><i>${s.open ? '−' : '+'}</i></div>
        ${s.open ? `<div class="body" data-born="optbody"><div class="hint" style="margin:0">Le stock reste toujours compté en <b>pièces</b> ; ces conditionnements servent à acheter, vendre et afficher. Chacun a son propre prix.</div>
          ${cond}<span class="btn sec sm" data-t="add-cond" style="margin-top:12px">+ Ajouter un conditionnement</span></div>` : ''}</div>
      <div class="opt"><div class="sum"><span><b>Voulez-vous être prévenu avant la rupture ?</b><small>Le délai de votre fournisseur sert à calculer quand recommander.</small></span><i>+</i></div></div>
      ${stock}
      <div class="label">Date de péremption du stock initial (facultatif)</div><div class="input" style="color:var(--ink-faint)">jj/mm/aaaa</div>
      <div class="grid2"><div><div class="label">Référence / SKU (facultatif)</div>${inp(s, 'sku', 'f-sku', 'TSH-001')}</div>
        <div><div class="label">Unité de stock</div>${sel('pièce', 'f-unit')}</div></div>
      <div class="label">Statut</div><div style="position:relative">${sel(s.status, 'f-status', s.menu === 'status')}
        ${s.menu === 'status' ? `<div class="umenu" style="top:50px" data-born="smenu">${['Brouillon', 'Actif'].map((v) => `<div data-t="ms-${v}" class="${v === s.status ? 'on' : ''}">${v}</div>`).join('')}</div>` : ''}</div>
      <div style="display:flex;gap:10px;margin-top:20px"><span class="btn" data-t="save">Enregistrer</span><span class="btn ghost">Annuler</span></div></div>`;
  }
  function tableHTML(s) {
    const row = (p, fresh) => `<tr ${fresh ? 'data-born="r-new" data-t="row-new"' : ''}><td><b>${p.nm}</b></td><td class="mu">${p.cat}</td><td class="mu">—</td>
      <td class="r"><b>${fmt(p.pr)}</b><small>${p.alt}</small></td><td class="r ${p.low ? 'warn' : ''}">${p.st}</td>
      <td><span class="badge ok">Actif</span></td><td class="r mu">Retirer&nbsp;&nbsp;Modifier</td></tr>`;
    const fresh = s.saved ? row({ nm: NEW.nm, cat: '—', pr: 350, alt: 'carton ×24 : 7 800 F CFA', st: '5 cartons + 8 pièces' }, true) : '';
    return `<div style="display:flex;gap:8px;margin:18px 0 12px"><div class="input ph" style="flex:1">Rechercher un produit, une référence, un code-barres…</div><span class="btn sec">Scanner</span></div>
      <div class="card" style="padding:4px 0;overflow:hidden"><table class="pt"><thead><tr><th>Produit</th><th>Catégorie</th><th>Marque</th><th class="r">Prix</th><th class="r">Stock</th><th>Statut</th><th></th></tr></thead>
        <tbody>${fresh}${LIST.map((p) => row(p)).join('')}</tbody></table></div>`;
  }
  function deskHTML(s) {
    return `<div class="app">${side()}<div class="main"><div class="scroller" id="scroller">
      <h1>Produits</h1><div class="lead">Votre catalogue et le suivi de votre stock.</div>
      <div style="display:flex;gap:8px;margin-bottom:${s.form ? '18px' : '0'}"><span class="btn sm" data-t="new">+ Nouveau produit</span><span class="btn sec sm">+ Catégorie</span><span class="btn sec sm">+ Marque</span></div>
      ${s.form ? formHTML(s) : ''}${tableHTML(s)}</div></div></div>`;
  }

  // ------------------------------------------------------------ La caisse
  function tile(p, s) {
    return `<div class="card ptile" data-t="tile-${p.k}" ${p.k === 'savon' ? 'data-born="t-savon"' : ''}><div class="nm">${p.nm}</div>
      <span class="badge ${p.low ? 'warn' : 'ok'}" ${p.k === 'savon' && s.sold ? 'data-pop="st-savon"' : ''}>${p.st} en stock</span>
      <div class="ub">${p.units.map(([l, pr], i) => `<span data-t="u-${p.k}-${i}">${l}<b>${fmt(pr).replace(' F CFA', '')}</b></span>`).join('')}</div></div>`;
  }
  function mobHTML(s) {
    const savon = { k: 'savon', nm: NEW.nm, st: s.sold ? '4 cartons + 8 pièces' : '5 cartons + 8 pièces', units: [['pièce', 350], ['carton ×24', 7800]] };
    const q = (s.search || '').toLowerCase();
    const all = s.saved ? [...TILES.slice(0, 3), TILES[3], savon].sort((a, b) => a.nm.localeCompare(b.nm, 'fr')) : TILES;
    const shown = q ? all.filter((p) => p.nm.toLowerCase().includes(q)) : all.slice(0, 4);
    const header = `<div style="height:56px;display:flex;align-items:center;gap:12px;padding:0 14px;background:var(--card);border-bottom:1px solid var(--border)"><span style="width:40px;height:40px;border:1px solid var(--border);border-radius:10px;display:grid;place-items:center;font-size:20px">☰</span><b style="font-size:16px">Marché du Coin</b></div>`;
    const body = `<h1>Caisse</h1><div class="lead" style="margin-bottom:10px">Enregistrez une vente.</div>
      <div style="display:flex;gap:8px;margin-bottom:12px"><div class="input ${s.focus === 'search' ? 'focus' : ''}" data-t="m-search" style="flex:1;font-size:14px">${s.search || ''}${caret(s, 'search')}${!s.search && s.focus !== 'search' ? '<span style="color:var(--ink-faint)">Rechercher un produit…</span>' : ''}</div><span class="btn sec">Scanner</span></div>
      <div style="display:grid;gap:10px">${shown.map((p) => tile(p, s)).join('')}</div>`;
    const n = s.sold ? 1 : 0;
    const bar = `<div style="position:absolute;left:0;right:0;bottom:0;background:var(--raised);border-top:1px solid var(--border);padding:12px 14px 22px;display:flex;align-items:center;gap:12px;box-shadow:0 -10px 24px -14px rgba(33,29,22,.3)">
      <div style="flex:1"><div style="font-size:12.5px;color:var(--ink-muted)">${n ? '1 article' : 'Panier vide'}</div><div style="font:700 19px/1.2 Manrope" data-pop="mtot-${n}">${fmt(n ? 7800 : 0)}</div></div>
      <span class="btn ${n ? '' : 'sec'}" style="height:46px">Voir le panier</span></div>`;
    return `${header}<div style="position:absolute;left:0;right:0;top:56px;bottom:0;padding:16px;overflow:hidden">${body}</div>${bar}`;
  }

  // ------------------------------------------------------------ Le temps
  let T = {};
  function events(at) {
    T = { open: at('carton', 0.16), add: at('carton', 0.32), packs: at('stock', 0.40), status: at('actif', 0.30), save: at('actif', 0.78), sell: at('caisse', 0.62) };
    T.scroll = [
      { t: T.open - 1.2, key: 'opt-carton' },
      // La liste des unités doit tenir dans le cadre : on remonte la ligne.
      { t: T.add + 0.2, key: 'cu-unit', off: 40 },
      { t: T.packs - 1.2, key: 'st-grid' },
      { t: T.status - 1.2, key: 'f-status' },
    ];
    return [
      // Étape 1 : la fiche, le nom, les prix à la pièce.
      { t: at('nouveau', 0.40), d: 'new', tip: '+ Nouveau produit', fn: (s) => { s.form = true; } },
      { t: at('nouveau', 0.72), d: 'f-name', tip: 'Le nom', fn: (s) => { s.focus = 'name'; }, type: { field: 'name', text: NEW.nm, dur: 0.8 } },
      { t: at('prix', 0.30), d: 'f-cost', tip: 'Le coût d’achat', fn: (s) => { s.focus = 'cost'; }, type: { field: 'cost', text: NEW.cost, dur: 0.35 } },
      { t: at('prix', 0.64), d: 'f-price', tip: 'Le prix à la pièce', fn: (s) => { s.focus = 'price'; }, type: { field: 'price', text: NEW.price, dur: 0.35 } },
      // Étape 2 : le carton, puis le stock déjà en rayon.
      { t: T.open, d: 'opt-carton', tip: 'Vendez-vous aussi par carton ?', fn: (s) => { s.focus = null; s.open = true; } },
      { t: T.add, d: 'add-cond', tip: '+ Ajouter un conditionnement', fn: (s) => { s.cond = true; s.unit = 'kg'; } },
      { t: at('carton', 0.46), d: 'cu-unit', tip: 'L’unité', fn: (s) => { s.menu = 'unit'; } },
      { t: at('carton', 0.56), d: 'mu-carton', tip: 'Carton', fn: (s) => { s.menu = null; s.unit = 'carton'; } },
      { t: at('carton', 0.70), d: 'cu-factor', tip: '24 pièces', fn: (s) => { s.focus = 'factor'; }, type: { field: 'factor', text: NEW.factor, dur: 0.3 } },
      { t: at('carton', 0.86), d: 'cu-price', tip: 'Le prix du carton', fn: (s) => { s.focus = 'cprice'; }, type: { field: 'cprice', text: NEW.cprice, dur: 0.4 } },
      { t: T.packs, d: 'st-packs', tip: '5 cartons', fn: (s) => { s.focus = 'packs'; }, type: { field: 'packs', text: NEW.packs, dur: 0.2 } },
      { t: at('stock', 0.70), d: 'st-extra', tip: '8 pièces en plus', fn: (s) => { s.focus = 'extra'; }, type: { field: 'extra', text: NEW.extra, dur: 0.2 } },
      // Étape 3 : Actif, Enregistrer — puis, à la caisse, il se vend.
      { t: T.status, d: 'f-status', tip: 'Le statut', fn: (s) => { s.focus = null; s.menu = 'status'; } },
      { t: at('actif', 0.48), d: 'ms-Actif', tip: 'Actif', fn: (s) => { s.menu = null; s.status = 'Actif'; } },
      { t: T.save, d: 'save', tip: 'Enregistrer', chime: true, fn: (s) => { s.form = false; s.saved = true; s.toast = true; } },
      { t: T.save + 2.6, fn: (s) => { s.toast = false; } },
      { t: at('caisse', 0.16), m: 'm-search', tip: 'Rechercher', fn: (s) => { s.focus = 'search'; }, type: { field: 'search', text: 'sav', dur: 0.4 } },
      { t: T.sell, m: 'u-savon-1', tip: 'Un carton', fn: (s) => { s.focus = null; s.sold = true; } },
    ];
  }

  function offsetIn(root, key) {
    let el = root.querySelector(`[data-t="${key}"]`), y = 0;
    const stop = root.querySelector('#scroller');
    while (el && el !== stop) { y += el.offsetTop; el = el.offsetParent; }
    return el ? y : 0;
  }
  function afterPaint(s, t) {
    const desk = document.getElementById('desk');
    const sc = desk.querySelector('#scroller');
    if (s.form) {
      const max = Math.max(0, sc.scrollHeight - 744);
      const yOf = (kf) => Math.min(max, Math.max(0, offsetIn(desk, kf.key) - (kf.off ?? 170)));
      let y = 0;
      for (const kf of T.scroll) {
        if (t < kf.t) break;
        y = mix(y, yOf(kf), smooth(span(kf.t, kf.t + 0.6, t)));
      }
      sc.style.transform = `translateY(${-y}px)`;
    } else sc.style.transform = 'none';
    // Le nouveau produit s'allume, sur la liste comme à la caisse.
    const glow = (el, a) => el && Object.assign(el.style, { boxShadow: `0 0 0 ${3 * a}px rgba(255,94,46,${a}), 0 0 24px rgba(255,94,46,${0.45 * a})` });
    glow(document.querySelector('#mob [data-t="tile-savon"]'), 1 - span(T.sell + 1.2, T.sell + 2.2, t));
    const row = desk.querySelector('[data-t="row-new"]');
    if (row) row.style.background = `rgba(255,94,46,${0.14 * (1 - span(T.save + 2.4, T.save + 3.4, t))})`;
  }

  window.TUTO = {
    produit: 'Boutique',
    theme: { '--side': '#2a2118', '--bg-mid': '#2b2016', '--bg-deep': '#0d0a07' },
    road: [[1, 'Le produit'], [2, 'Le carton'], [3, 'Actif']],
    recap: [['Le produit', 'nom, coût, prix à la pièce'], ['Le carton', 'contenu, prix, stock'], ['Actif', 'puis Enregistrer : il est en caisse']],
    recapAt: [0.06, 0.3, 0.55],
    tagline: 'À la pièce ou au carton, le stock se compte tout seul.',
    hook: {
      ring: false,
      slip: '<b>Stock savon</b><br>6 cartons<br>– 1 carton<br>– 17 pièces<br><s>4 cartons ?</s><br>reste : ???',
      lost: 'Le stock <em>ne tombe pas juste.</em>',
    },
    labels: { pc: 'Sur ordinateur', tel: 'À la caisse' },
    toast: 'Produit ajouté.',
    toastOn: ['d'],
    toastAt: { d: { left: '470px', top: '22px' } },
    zoneAfterChime: 'liste',
    initState: () => ({ form: false, focus: null, name: '', cost: '', price: '', open: false, cond: false, unit: 'kg', menu: null, factor: '', cprice: '',
      packs: '', extra: '', sku: '', status: 'Brouillon', saved: false, toast: false, search: '', sold: false }),
    events,
    deskHTML,
    mobHTML,
    afterPaint,
    focus: {
      plein: { x: 0, y: 0, w: 1280, h: 800 },
      form: { x: 244, y: 0, w: 800, h: 500 },
      liste: { x: 232, y: 0, w: 1048, h: 560 },
    },
    zoneOf: (id) => (['nouveau', 'prix', 'carton', 'stock', 'actif'].includes(id) ? 'form' : id === 'caisse' ? 'liste' : 'plein'),
    css: `
      .scroller { position: relative; padding-bottom: 420px; }
      .btn.sm { height: 36px; padding: 0 14px; font-size: 14px; border-radius: 12px; }
      .fcard { width: 760px; padding: 22px 24px 26px; }
      .fcard .label { margin-top: 14px; }
      .hint { font-size: 12.5px; color: var(--ink-muted); margin-top: 6px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
      .fs { position: relative; margin-top: 22px; padding: 16px; border: 1px solid var(--border); border-radius: 14px; }
      .fs .lg { position: absolute; top: -10px; left: 12px; padding: 0 5px; background: var(--card); font-size: 13.5px; font-weight: 600; }
      .fs .btn, .opt .btn { display: flex; width: fit-content; }
      .opt { margin-top: 14px; border: 1px solid var(--border); border-radius: 14px; }
      .opt .sum { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; }
      .opt .sum b { display: block; font-size: 14px; font-weight: 600; }
      .opt .sum small { display: block; margin-top: 2px; font-size: 12.5px; color: var(--ink-faint); }
      .opt .sum i { font-style: normal; color: var(--ink-faint); font-size: 18px; }
      .opt.open .sum { border-bottom: 1px solid var(--border); }
      .opt .body { padding: 14px 16px 16px; }
      .cgrid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 10px; margin-top: 14px; align-items: end; }
      .cgrid label { position: relative; display: block; }
      .cgrid label > span { display: block; margin-bottom: 5px; font-size: 12.5px; color: var(--ink-muted); }
      .cgrid .x { padding: 0 6px 12px; color: var(--ink-faint); }
      .umenu { position: absolute; left: 0; right: 0; top: 68px; z-index: 5; background: var(--raised); border: 1px solid var(--border); border-radius: 12px; padding: 5px; box-shadow: 0 16px 30px -14px rgba(33,29,22,.5); }
      .umenu div { padding: 5px 10px; border-radius: 8px; font-size: 14px; line-height: 1.3; }
      .umenu div.on { background: var(--app-bg); font-weight: 700; }
      .pt { width: 100%; border-collapse: collapse; font-size: 14px; }
      .pt th { text-align: left; padding: 12px 14px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-faint); border-bottom: 1px solid var(--border); }
      .pt td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
      .pt tr:last-child td { border-bottom: 0; }
      .pt .r { text-align: right; }
      .pt .mu { color: var(--ink-muted); }
      .pt .warn { color: var(--warn); font-weight: 600; }
      .pt small { display: block; margin-top: 2px; font-size: 12px; font-weight: 400; color: var(--ink-faint); white-space: nowrap; }
      .ptile { padding: 12px 14px; }
      .ptile .nm { font-weight: 700; font-size: 14.5px; }
      .ptile .badge { margin: 6px 0 10px; }
      .ptile .ub { display: flex; gap: 6px; }
      .ptile .ub span { flex: 1; text-align: center; padding: 7px 4px; border-radius: 10px; border: 1px solid var(--border); font-size: 12.5px; font-weight: 600; line-height: 1.25; background: var(--raised); }
      .ptile .ub span b { display: block; font-size: 14px; }
    `,
  };
})();
