/**
 * Tutoriel « Commande au comptoir » (MagyaPro Restaurant) : les écrans
 * reconstruits, les gestes et l'habillage propres à cette vidéo. La mise en
 * scène commune (projecteur, bulles, feuille de route, résumé, son) est dans
 * `tuto.html`.
 */
(() => {
  // ------------------------------------------------------------ La carte
  const MENU = [
    { k: 'yassa', nm: 'Poulet yassa', cat: 'Plats mijotés', pr: 5500 },
    { k: 'thieb', nm: 'Thieboudienne', cat: 'Plats mijotés', pr: 5000, opts: [['poisson', 'Poisson supplémentaire', 1500], ['piment', 'Piment', 0], ['citron', 'Citron', 0]] },
    { k: 'mafe', nm: 'Mafé bœuf', cat: 'Plats mijotés', pr: 5500 },
    { k: 'dibi', nm: 'Dibi mouton', cat: 'Grillades', pr: 6000 },
    { k: 'bouye', nm: 'Bouye', cat: 'Boissons', pr: 1200 },
    { k: 'bissap', nm: 'Jus de bissap', cat: 'Boissons', pr: 1500 },
  ];

  function add(s, k, opts = []) {
    const key = `${k}|${opts.join(',')}`;
    const line = s.lines.find((l) => l.key === key);
    if (line) line.q += 1;
    else s.lines.push({ key, k, opts, q: 1 });
  }

  const priceOf = (l) => { const d = MENU.find((m) => m.k === l.k); return d.pr + (d.opts || []).filter((o) => l.opts.includes(o[0])).reduce((a, o) => a + o[2], 0); };
  const total = (s) => s.lines.reduce((a, l) => a + priceOf(l) * l.q, 0);
  const count = (s) => s.lines.reduce((a, l) => a + l.q, 0);

  // ------------------------------------------------------------ Écrans
  const caret = (s, f) => (s.focus === f ? '<span class="caret"></span>' : '');
  function sideHTML(page) {
    const item = (t, label, on) => `<div class="nav ${on ? 'on' : ''}" data-t="${t}"><i></i>${label}</div>`;
    return `<div class="side"><div class="logo">Magya<b>pro</b></div><div class="resto">Chez Aminata<small>Restaurant</small></div><h6>Service</h6>
      ${item('nav-ov', 'Vue d’ensemble', page === 'overview')}${item('nav-cmd', 'Commandes', page === 'orders' || page === 'new')}${item('nav-cui', 'Cuisine', page === 'kitchen')}${item('nav-res', 'Réservations', false)}${item('nav-liv', 'Livraisons', false)}</div>`;
  }
  function overviewHTML(mobile) {
    return `<h1>Bonjour Aminata</h1><div class="lead">Chez Aminata — voici votre service.</div>
      <div style="display:grid;grid-template-columns:${mobile ? '1fr 1fr' : 'repeat(3,1fr)'};gap:12px">${['À traiter|2', 'En cuisine|3', 'Prêtes|1'].map((x) => `<div class="card" style="padding:16px"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint)">${x.split('|')[0]}</div><div style="font:700 28px/1.2 Manrope;margin-top:6px">${x.split('|')[1]}</div></div>`).join('')}</div>`;
  }
  function ordersHTML(mobile) {
    const rows = [['n°26', 'Marc Kouassi', 'En préparation', 'warn'], ['n°25', 'Sarah Bamba', 'Prête', 'ok'], ['n°24', 'Ibrahim Traoré', 'Remise', 'ok']];
    return `<div class="row"><div><h1>Commandes</h1><div class="lead">Les commandes à traiter, de la plus ancienne à la plus récente.</div></div>
      ${mobile ? '' : '<div class="btn" data-t="new">+ Nouvelle commande</div>'}</div>
      ${mobile ? '<div class="btn wide" data-t="new" style="margin-bottom:14px">+ Nouvelle commande</div>' : ''}
      ${rows.map((r) => `<div class="card row" style="padding:14px 16px;margin-bottom:10px"><div><b style="font-size:17px">${r[0]}</b><div style="color:var(--ink-muted);font-size:14px">${r[1]}</div></div><span class="badge ${r[3]}">${r[2]}</span></div>`).join('')}`;
  }
  function dishHTML(s, d) {
    const chosen = s.lines.filter((l) => l.k === d.k).reduce((a, l) => a + l.q, 0);
    const open = s.config === d.k;
    return `<div class="dish ${open ? 'open' : ''}" data-t="dish-${d.k}"><div class="top"><div><div class="nm">${d.nm}</div><div class="cat">${d.cat}${d.opts ? ' · suppléments' : ''}</div><div class="pr">${fmt(d.pr)}</div></div>
      ${chosen ? `<span class="badge b" data-pop="${d.k}-${chosen}" style="height:24px">×${chosen}</span>` : ''}</div>
      ${open ? `<div class="opts">${d.opts.map((o) => `<div class="opt" data-t="opt-${o[0]}"><span class="box ${s.opts.includes(o[0]) ? 'on' : ''}"></span><span style="flex:1">${o[1]}</span>${o[2] ? `<span style="color:var(--ink-muted)">+${fmt(o[2])}</span>` : ''}</div>`).join('')}
        <div style="display:flex;gap:8px;margin-top:8px"><span class="btn" data-t="opt-add" style="height:38px">Ajouter</span><span class="btn ghost" style="height:38px">Annuler</span></div></div>` : ''}</div>`;
  }
  function orderPanelHTML(s) {
    const lines = s.lines.map((l) => { const d = MENU.find((m) => m.k === l.k); const o = (d.opts || []).filter((x) => l.opts.includes(x[0])).map((x) => x[1]).join(', ');
      return `<div class="ln" data-born="${l.key}"><div><b>${d.nm}</b>${o ? `<small>+ ${o}</small>` : ''}</div><div class="qty"><span>−</span><b>${l.q}</b><span>+</span></div></div>`; }).join('');
    const ready = s.lines.length && s.name.length >= 2;
    return `<div style="font:700 18px/1 Manrope;margin-bottom:6px">Commande</div>
      <div class="lines">${lines || '<div style="color:var(--ink-faint);padding:12px 0;font-size:14px">Touchez un plat pour l’ajouter.</div>'}</div>
      <div class="row" style="margin-top:10px"><span style="color:var(--ink-muted)">Sous-total</span><b style="font-size:18px;font-variant-numeric:tabular-nums" data-pop="tot-${count(s)}">${fmt(total(s))}</b></div>
      <div class="label">Type de commande</div><div class="seg">${[['PICKUP', 'À emporter'], ['DINE_IN', 'Sur place'], ['DELIVERY', 'Livraison']].map((f) => `<span data-t="f-${f[0]}" class="${s.ful === f[0] ? 'on' : ''}">${f[1]}</span>`).join('')}</div>
      <div class="label">Nom du client <span class="req">*</span></div><div class="input ${s.name ? '' : 'ph'} ${s.focus === 'name' ? 'focus' : ''}" data-t="name">${s.name || (s.focus === 'name' ? '' : 'Prénom et nom')}${caret(s, 'name')}</div>
      <div class="label">Téléphone</div><div class="input ph">Facultatif</div>
      <div class="label">Note pour la cuisine</div><div class="input ${s.note ? '' : 'ph'} ${s.focus === 'note' ? 'focus' : ''}" data-t="note">${s.note || (s.focus === 'note' ? '' : 'Sans piment, bien cuit…')}${caret(s, 'note')}</div>
      <div class="btn wide ${ready ? '' : 'off'}" data-t="save" style="margin-top:16px">Enregistrer la commande</div>`;
  }
  function kitchenHTML(s, mobile) {
    const card = (n, kind, items, wait, isNew) => `<div class="card kcard" ${isNew ? 'data-born="k27"' : ''}><div class="row"><span class="num">${n}</span><span class="wait">${wait}</span></div><div style="color:var(--ink-faint);font-size:13px;margin-top:3px">${kind}</div><div style="margin:10px 0 12px;font-size:15px;line-height:1.55">${items}</div><div class="btn wide" style="height:40px;font-size:14px">Commencer</div></div>`;
    const mine = card('n°27', `À emporter · ${s.name || 'Awa Koné'}`, '2 × Poulet yassa<br>1 × Thieboudienne <span style="color:var(--ink-muted)">+ Poisson</span><br>1 × Bouye<div style="margin-top:6px;color:var(--warn);font-weight:600">Note : Sans piment</div>', 'à l’instant', true);
    if (mobile) return `<h1>Cuisine</h1><div class="lead">À préparer</div>${mine}${card('n°26', 'Sur place · Table 3', '4 × Dibi mouton', '6 min')}`;
    return `<h1>Cuisine</h1><div class="lead">Commandes confirmées, dans l’ordre d’arrivée.</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      <div class="kcol"><h4>À préparer<span>2</span></h4>${card('n°26', 'Sur place · Table 3', '4 × Dibi mouton', '6 min')}${mine}</div>
      <div class="kcol"><h4>En préparation<span>1</span></h4>${card('n°25', 'Livraison', '2 × Mafé bœuf', '11 min')}</div>
      <div class="kcol"><h4>Prêtes<span>0</span></h4></div></div>`;
  }
  function deskHTML(s) {
    let main;
    if (s.deskPage === 'overview') main = overviewHTML(false);
    else if (s.deskPage === 'orders') main = ordersHTML(false);
    else if (s.deskPage === 'kitchen') main = kitchenHTML(s, false);
    else main = `<h1>Nouvelle commande</h1><div class="lead">Pour un client qui appelle, ou qui commande au comptoir.</div>
      <div style="display:grid;grid-template-columns:1fr 340px;gap:20px"><div><div class="input ph" style="margin-bottom:14px">Rechercher un plat…</div><div class="dishes">${MENU.map((d) => dishHTML(s, d)).join('')}</div></div>
      <div class="card" style="padding:16px 18px">${orderPanelHTML(s)}</div></div>`;
    return `<div class="app">${sideHTML(s.deskPage)}<div class="main">${main}</div></div>`;
  }
  function mobHTML(s) {
    const header = `<div style="height:56px;display:flex;align-items:center;gap:12px;padding:0 14px;background:var(--card);border-bottom:1px solid var(--border)"><span data-t="burger" style="width:40px;height:40px;border:1px solid var(--border);border-radius:10px;display:grid;place-items:center;font-size:20px">☰</span><b style="font-size:16px">Chez Aminata</b></div>`;
    let body;
    if (s.mobPage === 'overview') body = overviewHTML(true);
    else if (s.mobPage === 'orders') body = ordersHTML(true);
    else if (s.mobPage === 'kitchen') body = kitchenHTML(s, true);
    else body = `<h1>Nouvelle commande</h1><div class="lead" style="margin-bottom:12px">Pour un client qui appelle, ou au comptoir.</div><div style="display:grid;gap:10px">${MENU.map((d) => dishHTML(s, d)).join('')}</div>`;
    const bar = s.mobPage === 'new' && !s.sheet ? `<div style="position:absolute;left:0;right:0;bottom:0;background:var(--raised);border-top:1px solid var(--border);padding:12px 14px 22px;display:flex;align-items:center;gap:12px;box-shadow:0 -10px 24px -14px rgba(33,29,22,.3)">
      <div style="flex:1"><div style="font-size:12.5px;color:var(--ink-muted)">${count(s) ? `${count(s)} plat${count(s) > 1 ? 's' : ''}` : 'Aucun plat'}</div><div style="font:700 19px/1.2 Manrope;font-variant-numeric:tabular-nums" data-pop="mtot-${count(s)}">${fmt(total(s))}</div></div>
      <span class="btn ${count(s) ? '' : 'sec'}" data-t="see" style="height:46px">${count(s) ? 'Voir la commande' : 'Détails'}</span></div>` : '';
    const sheet = s.sheet && s.mobPage === 'new' ? `<div style="position:absolute;inset:0;background:rgba(33,29,22,.4)"></div><div data-sheet style="position:absolute;left:0;right:0;bottom:0;max-height:92%;overflow:hidden;background:var(--card);border-radius:22px 22px 0 0;padding:16px 16px 22px">${orderPanelHTML(s)}</div>` : '';
    const drawer = s.drawer ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.4)"></div><div style="position:absolute;left:0;top:0;bottom:0;width:78%;background:var(--side);padding:16px 12px">${sideHTML('overview').replace('<div class="side">', '<div class="side" style="width:auto;padding:0;background:none">').replace(/class="nav on"/, 'class="nav"')}</div>` : '';
    return `${header}<div style="position:absolute;left:0;right:0;top:56px;bottom:0;padding:16px;overflow:hidden" id="mobbody"><div id="mobscroll">${body}</div></div>${bar}${sheet}${drawer}`;
  }



  /**
   * Les gestes. `d` : cible sur l'ordinateur, `m` : sur le téléphone
   * (`data-t`). `tip` : la consigne affichée dans la bulle. `fn` : ce que
   * le geste change à l'écran.
   */
  function events(at) {
    return [
      // Étape 1
      { t: at('ouvrir', 0.22), m: 'burger', tip: 'Ouvrez le menu', fn: (s) => { s.drawer = true; } },
      { t: at('ouvrir', 0.30), d: 'nav-cmd', fn: (s) => { s.deskPage = 'orders'; } },
      { t: at('ouvrir', 0.48), m: 'nav-cmd', tip: 'Touchez « Commandes »', fn: (s) => { s.drawer = false; s.mobPage = 'orders'; } },
      { t: at('ouvrir', 0.86), d: 'new', m: 'new', tip: 'Touchez « Nouvelle commande »', fn: (s) => { s.deskPage = s.mobPage = 'new'; } },
      // Étape 2
      { t: at('plats', 0.36), d: 'dish-yassa', m: 'dish-yassa', tip: 'Touchez le plat', fn: (s) => add(s, 'yassa') },
      { t: at('plats', 0.56), d: 'dish-yassa', m: 'dish-yassa', tip: 'Encore : 2 plats', fn: (s) => add(s, 'yassa') },
      { t: at('plats', 0.80), d: 'dish-bouye', m: 'dish-bouye', tip: 'Une boisson', fn: (s) => add(s, 'bouye') },
      { t: at('choix', 0.16), d: 'dish-thieb', m: 'dish-thieb', tip: 'Ce plat a des suppléments', fn: (s) => { s.config = 'thieb'; } },
      { t: at('choix', 0.52), d: 'opt-poisson', m: 'opt-poisson', tip: 'Cochez « Poisson »', fn: (s) => { s.opts = ['poisson']; } },
      { t: at('choix', 0.86), d: 'opt-add', m: 'opt-add', tip: 'Touchez « Ajouter »', fn: (s) => { add(s, 'thieb', ['poisson']); s.config = null; s.opts = []; } },
      // Étape 3
      { t: at('client', 0.10), m: 'see', tip: 'Voir la commande', fn: (s) => { s.sheet = true; } },
      { t: at('client', 0.42), d: 'f-PICKUP', m: 'f-PICKUP', tip: 'À emporter', fn: (s) => { s.ful = 'PICKUP'; } },
      { t: at('client', 0.74), d: 'name', m: 'name', tip: 'Le nom du client', fn: (s) => { s.focus = 'name'; }, type: { field: 'name', text: 'Awa Koné', dur: 0.9 } },
      { t: at('note', 0.40), d: 'note', m: 'note', tip: 'Note pour la cuisine', fn: (s) => { s.focus = 'note'; }, type: { field: 'note', text: 'Sans piment', dur: 0.8 } },
      // Étape 4
      { t: at('envoyer', 0.40), d: 'save', m: 'save', tip: 'Touchez « Enregistrer »', fn: (s) => { s.focus = null; s.toast = true; }, chime: true },
      { t: at('envoyer', 0.74), fn: (s) => { s.toast = false; s.deskPage = s.mobPage = 'kitchen'; s.sheet = false; } },
    ];
  }


  window.TUTO = {
    produit: 'Restaurant',
    road: [[1, 'Ouvrir'], [2, 'Les plats'], [3, 'Le client'], [4, 'Envoyer']],
    recap: [['Commandes', '› Nouvelle commande'], ['Les plats', 'un toucher, un plat'], ['Le client', 'type, nom, note'], ['Enregistrer', 'la cuisine la reçoit']],
    recapAt: [0.06, 0.26, 0.46, 0.64],
    tagline: 'De la commande à la cuisine, sans un papier perdu.',
    hook: {
      ring: true,
      slip: '<b>Tél. — Awa</b><br>2 poulet yassa<br><s>1 mafé</s> 1 thieb ?<br>+ poisson ??<br>1 bouye<br>— sans piment',
      lost: 'Le papier <em>se perd.</em>',
    },
    toast: 'Commande enregistrée, elle est partie en cuisine.',
    initState: () => ({ deskPage: 'overview', mobPage: 'overview', drawer: false, lines: [], config: null, opts: [], ful: 'DINE_IN',
      name: '', note: '', focus: null, sheet: false, toast: false }),
    events,
    deskHTML,
    mobHTML,
    focus: {
      plein: { x: 0, y: 0, w: 1280, h: 800 },
      plats: { x: 250, y: 70, w: 690, h: 470 },
      panneau: { x: 895, y: 80, w: 375, h: 470 },
      panneauBas: { x: 895, y: 300, w: 375, h: 470 },
    },
    zoneOf: (id) => (['plats', 'choix'].includes(id) ? 'plats' : id === 'client' ? 'panneau' : ['note', 'envoyer'].includes(id) ? 'panneauBas' : 'plein'),
    afterPaint: (s) => {
      const scroll = document.getElementById('mobscroll');
      if (scroll && s.mobPage === 'new' && !s.sheet) scroll.style.transform = `translateY(${s.config === 'thieb' ? -60 : 0}px)`;
    },
  };
})();
