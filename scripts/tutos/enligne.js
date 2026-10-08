/**
 * Tutoriel « Recevoir les commandes de son site » (MagyaPro Restaurant).
 *
 * Le téléphone montre le client, sur le site de « Chez Aminata » : la carte
 * (« + Ajouter », bouton « Panier » et son compteur), la page « Votre
 * commande » (`components/site/checkout-flow.tsx` : « Retrait sur place »,
 * « Nom complet », « Téléphone », « Paiement sur place », « Valider ma
 * commande · … »), puis la page de suivi.
 *
 * L'ordinateur montre le restaurant, page Commandes
 * (`components/dashboard/orders-board.tsx`) : la commande arrive seule, avec le
 * bip de l'application (`alert-watcher.tsx`, relevé toutes les 5 secondes) et
 * la pastille rouge de « À traiter » ; on la confirme d'un geste — le bouton
 * porte le libellé du statut suivant, « Confirmée ».
 */
(() => {
  const MENU = [
    ['Grillades', [['dibi', 'Dibi mouton', 'Mouton grillé, oignons confits, moutarde.', 6000], ['yassa', 'Poulet yassa', 'Poulet mariné au citron, oignons fondants, riz blanc.', 5500]]],
    ['Plats mijotés', [['thieb', 'Thieboudienne', 'Riz au poisson, légumes du marché, sauce tomate.', 5000], ['mafe', 'Mafé bœuf', 'Bœuf mijoté à la pâte d’arachide, riz blanc.', 5500]]],
    ['Boissons', [['bissap', 'Jus de bissap', 'Fleurs d’hibiscus, menthe fraîche.', 1000], ['bouye', 'Bouye', 'Jus de pain de singe, onctueux.', 1000]]],
  ];
  const ROWS = [
    { n: 11, when: '12:31', items: 3, mode: 'Retrait', who: 'Awa Ndiaye', tel: '77 208 14 66', st: ['En préparation', 'warn'], pay: 'En attente', tot: 16000, next: ['Prête'] },
    { n: 10, when: '12:24', items: 3, mode: 'Sur place · Table 4', who: 'Table 4', tel: null, st: ['Confirmée', 'info'], pay: 'En attente', tot: 12000, next: ['En préparation'] },
    { n: 9, when: '12:12', items: 2, mode: 'Sur place · Table 2', who: 'Table 2', tel: null, st: ['En préparation', 'warn'], pay: 'Payé', tot: 10500, next: ['Prête'], paid: true },
  ];
  const caret = (s, f) => (s.focus === f ? '<span class="caret"></span>' : '');
  const count = (s) => s.cart.length;
  const total = (s) => s.cart.reduce((a, k) => a + MENU.flatMap((c) => c[1]).find((p) => p[0] === k)[3], 0);

  function side(s) {
    const item = (label, on, badge) => `<div class="nav ${on ? 'on' : ''}"><i></i>${label}${badge ? `<span class="nbad" data-t="badge" data-pop="badge-${badge}">${badge}</span>` : ''}</div>`;
    return `<div class="side"><div class="logo">Magya<b>pro</b></div><div class="resto">Chez Aminata<small>Restaurant</small></div><h6>Service</h6>
      ${item('Vue d’ensemble')}${item('À traiter', false, s.arrived && !s.confirmed ? 1 : 0)}${item('Notifications')}${item('Commandes', true)}${item('Cuisine')}${item('Réservations')}</div>`;
  }

  // ------------------------------------------------------------ Le restaurant
  function deskHTML(s) {
    const row = (o, fresh) => {
      const btns = [!o.paid ? '<span class="btn sec sm">Marquer payé</span>' : '', ...o.next.map((n) => `<span class="btn sec sm" ${fresh ? `data-t="conf-${o.n}"` : ''}>${n}</span>`), '<span class="btn ghost sm">Annuler</span>'].join('');
      return `<tr ${fresh ? `data-born="r-${o.n}" data-t="row-${o.n}"` : ''}><td><b class="u">n°${o.n}</b><small>${o.when} · ${o.items} article${o.items > 1 ? 's' : ''} · ${o.mode}</small></td>
        <td>${o.who}<small class="${o.tel ? '' : 'faint'}">${o.tel ?? 'Sans numéro'}</small></td>
        <td><span class="badge ${o.st[1]}" ${fresh ? `data-t="st-${o.n}" data-pop="st-${o.st[0]}"` : ''}>${o.st[0]}</span></td><td class="mu">${o.pay}</td>
        <td class="r"><b>${fmt(o.tot)}</b></td><td class="r"><div class="acts">${btns}</div></td></tr>`;
    };
    const fresh = s.arrived ? row({ n: 12, when: '12:38', items: 2, mode: 'Retrait', who: 'Moussa Diop', tel: '77 412 58 03',
      st: s.confirmed ? ['Confirmée', 'info'] : ['Nouvelle', 'b'], pay: 'En attente', tot: 6500, next: [s.confirmed ? 'En préparation' : 'Confirmée'] }, true) : '';
    const n = 3 + (s.arrived ? 1 : 0);
    const pills = [['En cours', n, true], ['Nouvelle', s.arrived && !s.confirmed ? 1 : 0], ['Confirmée', 1 + (s.confirmed ? 1 : 0)], ['En préparation', 2], ['Prête', 0], ['En livraison', 0], ['Livrée', 0], ['Terminée', 18], ['Annulée', 1], ['Toutes', 19 + n]];
    return `<div class="app">${side(s)}<div class="main"><div class="row" style="align-items:flex-start"><div><h1>Commandes</h1><div class="lead">Les commandes à traiter, de la plus récente à la plus ancienne.</div></div><span class="btn">Nouvelle commande</span></div>
      <div class="pills">${pills.map(([l, c, on]) => `<span class="${on ? 'on' : ''}">${l}<b class="${c ? 'has' : ''}">${c}</b></span>`).join('')}</div>
      <div class="card" style="padding:4px 18px"><table class="ot"><thead><tr><th>Commande</th><th>Client</th><th>Statut</th><th>Paiement</th><th class="r">Total</th><th></th></tr></thead>
        <tbody>${fresh}${ROWS.map((o) => row(o)).join('')}</tbody></table></div></div></div>`;
  }

  // ------------------------------------------------------------ Le client
  function head(s) {
    return `<div class="demo">Restaurant de démonstration — les commandes passées ici sont fictives.</div>
      <div class="shead"><span class="slogo">C</span><b>Chez Aminata</b><span class="scart" data-t="m-cart">Panier${count(s) && s.page !== 'done' ? `<em data-pop="cc-${count(s)}">${count(s)}</em>` : ''}</span></div>`;
  }
  function menuHTML(s) {
    const row = ([k, nm, desc, pr], i) => `<div class="srow"><span class="no">${String(i + 1).padStart(2, '0')}</span>
      <div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;gap:6px"><span class="snm">${nm}</span><i></i></div><div class="sds">${desc}</div></div>
      <div style="text-align:right;flex:none"><div class="spr">${fmt(pr)}</div><div class="sadd ${s.cart.includes(k) ? 'ok' : ''}" data-t="add-${k}">${s.cart.includes(k) ? 'Ajouté ✓' : '+ Ajouter'}</div></div></div>`;
    return `<div class="snav"><span>Accueil</span><b>Menu</b><span>Réserver</span><span>Informations</span></div>
      <div class="sbody"><div class="shd" style="margin-top:6px">${MENU[1][0]}</div>${MENU[1][1].map(row).join('')}<div class="shd">${MENU[2][0]}</div>${MENU[2][1].map(row).join('')}<div class="shd">${MENU[0][0]}</div>${MENU[0][1].map(row).join('')}</div>`;
  }
  function cartHTML(s) {
    const lines = s.cart.map((k) => MENU.flatMap((c) => c[1]).find((p) => p[0] === k)).map(([, nm, , pr]) => `<div class="cl"><span class="ph"></span><div style="flex:1"><b>${nm}</b>
      <div class="row" style="margin-top:6px"><span class="qt"><i>−</i>1<i>+</i></span><span>${fmt(pr)}</span></div></div><span class="faint">✕</span></div>`).join('');
    const field = (label, f, key) => `<div class="flab">${label}</div><div class="input ${s.focus === f ? 'focus' : ''}" data-t="${key}">${s[f] || ''}${caret(s, f)}</div>`;
    return `<div class="sbody" style="padding-top:18px"><div class="ttl" style="text-align:left">Votre commande</div>
      <div class="lines">${lines}</div>
      <div class="flab" style="margin-top:18px">Comment souhaitez-vous être servi ?</div>
      <div class="ful"><span class="${s.pickup ? '' : 'on'}">Livraison</span><span class="${s.pickup ? 'on' : ''}" data-t="m-pickup">Retrait sur place</span></div>
      <div class="hint2">Préparation estimée : environ 20 minutes.</div>
      <div class="sbox"><b>Récapitulatif</b><div class="row"><span>Sous-total</span><span>${fmt(total(s))}</span></div><div class="row tot"><span>Total</span><span>${fmt(total(s))}</span></div></div>
      <div class="ttl2">Vos coordonnées</div>${field('Nom complet', 'name', 'm-name')}${field('Téléphone', 'tel', 'm-tel')}<div class="hint2">Le restaurant vous contactera à ce numéro.</div>
      <div class="flab">Moyen de paiement</div><div class="pay"><span class="radio"></span><span><b>Paiement sur place</b><small>Le client règle au comptoir lors du retrait.</small></span></div>
      <div class="valid" data-t="m-valid">Valider ma commande · ${fmt(total(s))}</div>
      <div class="hint2" style="text-align:center">Le montant final est calculé par le restaurant à la validation.</div></div>`;
  }
  function doneHTML(s) {
    const STEPS = [['NEW', 'Nouvelle'], ['CONFIRMED', 'Confirmée'], ['PREPARING', 'En préparation'], ['READY', 'Prête'], ['COMPLETED', 'Terminée']];
    const cur = s.confirmedSeen ? 1 : 0;
    const steps = STEPS.map(([k, label], i) => `<div class="st ${i <= cur ? 'on' : ''} ${i === cur ? 'cur' : ''}" data-t="trk-${k}"><span ${i === cur ? `data-pop="trk-${k}"` : ''}>${i < cur ? '✓' : i + 1}</span><small>${label}</small></div>${i < 4 ? `<i class="${i < cur ? 'on' : ''}"></i>` : ''}`).join('');
    return `<div class="sbody" data-born="done"><div class="okc">✓</div><div class="ttl">Commande enregistrée</div>
      <div class="thx">Merci Moussa Diop. Votre commande n°12 a bien été transmise à Chez Aminata.</div>
      <div class="sbox" data-t="trk"><div class="bh"><b>Suivi de la commande</b><span><em></em>Mise à jour automatique</span></div><div class="steps">${steps}</div><div class="paym">Paiement : <b>En attente</b></div></div>
      <div class="sbox"><div class="dl"><div><small>Mode</small><b>Retrait sur place</b></div><div><small>Préparation estimée</small><b>environ 20 minutes</b></div></div></div></div>`;
  }
  function mobHTML(s) {
    const body = s.page === 'menu' ? menuHTML(s) : s.page === 'cart' ? cartHTML(s) : doneHTML(s);
    return `<div class="site">${head(s)}<div class="mwin"><div id="mscroll" class="mscroll">${body}</div></div></div>`;
  }

  // ------------------------------------------------------------ Le temps
  let T = {};
  function events(at) {
    T = { cart: at('valider', 0.10), valid: at('valider', 0.86), arrive: at('sonne', 0.20), conf: at('confirmer', 0.30) };
    // Défilement de la page panier, jusqu'aux coordonnées puis au bouton.
    T.scroll = [{ t: T.cart + 0.3, key: 'm-pickup', off: 120 }, { t: at('valider', 0.42) - 0.9, key: 'm-name', off: 150 }, { t: T.valid - 1.1, key: 'm-valid', off: 380 }];
    return [
      // Étape 1 : le client compose et valide, seul.
      { t: at('client', 0.46), m: 'add-mafe', tip: '+ Ajouter', fn: (s) => { s.cart.push('mafe'); } },
      { t: at('client', 0.76), m: 'add-bissap', tip: '+ Ajouter', fn: (s) => { s.cart.push('bissap'); } },
      { t: T.cart, m: 'm-cart', tip: 'Panier', fn: (s) => { s.page = 'cart'; } },
      { t: at('valider', 0.26), m: 'm-pickup', tip: 'Retrait sur place', fn: (s) => { s.pickup = true; } },
      { t: at('valider', 0.42), m: 'm-name', tip: 'Son nom', fn: (s) => { s.focus = 'name'; }, type: { field: 'name', text: 'Moussa Diop', dur: 0.6 } },
      { t: at('valider', 0.62), m: 'm-tel', tip: 'Son téléphone', fn: (s) => { s.focus = 'tel'; }, type: { field: 'tel', text: '77 412 58 03', dur: 0.6 } },
      { t: T.valid, m: 'm-valid', tip: 'Valider ma commande', fn: (s) => { s.focus = null; s.page = 'done'; } },
      // Étape 2 : chez le restaurant, le bip, la pastille, la ligne.
      { t: T.arrive, sound: 'bip', fn: (s) => { s.arrived = true; } },
      { t: T.arrive + 0.7, d: 'row-12', look: true, hold: 1.6, tip: 'Nouvelle commande', fn: () => {} },
      { t: at('sonne', 0.80), d: 'badge', look: true, hold: 0.8, tip: 'À traiter', fn: () => {} },
      // Étape 3 : confirmer — le client le voit.
      { t: T.conf, d: 'conf-12', tip: 'Confirmer', chime: true, fn: (s) => { s.confirmed = true; } },
      { t: T.conf + 1.0, fn: (s) => { s.confirmedSeen = true; } },
      { t: T.conf + 1.6, m: 'trk-CONFIRMED', look: true, hold: 1.4, tip: 'Confirmée', fn: () => {} },
    ];
  }
  function offsetIn(root, key, stop) {
    let el = root.querySelector(`[data-t="${key}"]`), y = 0;
    while (el && el !== stop) { y += el.offsetTop; el = el.offsetParent; }
    return el ? y : 0;
  }
  function afterPaint(s, t) {
    const mob = document.getElementById('mob');
    const sc = mob.querySelector('#mscroll');
    if (s.page === 'cart') {
      const max = Math.max(0, sc.scrollHeight - sc.parentElement.clientHeight);
      let y = 0;
      for (const kf of T.scroll) {
        if (t < kf.t) break;
        const target = Math.min(max, Math.max(0, offsetIn(mob, kf.key, sc) - kf.off));
        y = mix(y, target, smooth(span(kf.t, kf.t + 0.6, t)));
      }
      sc.style.transform = `translateY(${-y}px)`;
    } else sc.style.transform = 'none';
    const glow = (el, a) => el && Object.assign(el.style, { boxShadow: `inset 0 0 0 ${2 * a}px rgba(255,94,46,${a})`, background: `rgba(255,94,46,${0.1 * a})` });
    glow(document.querySelector('#desk [data-t="row-12"]'), s.confirmed ? 0 : 1 - span(T.arrive + 3, T.arrive + 4, t));
  }

  window.TUTO = {
    produit: 'Restaurant',
    road: [[1, 'Le client commande'], [2, 'Ça sonne'], [3, 'Confirmer']],
    recap: [['Le client commande', 'seul, depuis votre site'], ['Ça sonne', 'la commande s’affiche toute seule'], ['Confirmer', 'elle part en cuisine']],
    recapAt: [0.06, 0.3, 0.55],
    tagline: 'Vos clients commandent seuls. Vous confirmez.',
    hook: {
      ring: true,
      slip: '<b>Appels manqués</b><br>12:04 — 3 appels<br>12:11 — 2 appels<br>12:19 — ???<br>— client perdu',
      lost: 'Les appels <em>se perdent.</em>',
    },
    labels: { pc: 'Au restaurant', tel: 'Le client, sur votre site' },
    toast: null,
    initState: () => ({ page: 'menu', cart: [], pickup: false, name: '', tel: '', focus: null, arrived: false, confirmed: false, confirmedSeen: false }),
    events,
    deskHTML,
    mobHTML,
    afterPaint,
    focus: {
      plein: { x: 0, y: 0, w: 1280, h: 800 },
      haut: { x: 0, y: 40, w: 980, h: 540 },
      action: { x: 500, y: 140, w: 780, h: 420 },
    },
    zoneOf: (id) => (id === 'sonne' ? 'haut' : id === 'confirmer' ? 'action' : 'plein'),
    zoneAfterChime: 'haut',
    css: `
      .btn.sm { height: 34px; padding: 0 12px; font-size: 13.5px; border-radius: 11px; }
      .nbad { margin-left: auto; padding: 2px 8px; border-radius: 99px; background: #ef4444; color: #fff; font-size: 12px; font-weight: 700; }
      .pills { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 18px; }
      .pills span { padding: 6px 12px; border-radius: 10px; background: var(--card); color: var(--ink-muted); font-size: 14px; }
      .pills span b { margin-left: 6px; font-weight: 400; color: var(--ink-faint); }
      .pills span b.has { font-weight: 600; color: var(--ink); }
      .pills span.on { background: var(--accent); color: #fff; } .pills span.on b { color: #fff; opacity: .85; }
      .badge.info { background: #e3ecfb; color: #2c5aa0; }
      .ot { width: 100%; border-collapse: collapse; font-size: 13.5px; }
      .ot td, .ot th, .ot .btn, .ot .badge { white-space: nowrap; }
      .ot th { text-align: left; padding: 12px 8px 10px 0; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-faint); border-bottom: 1px solid var(--border); }
      .ot td { padding: 12px 8px 12px 0; border-bottom: 1px solid var(--border); vertical-align: middle; }
      .ot tr:last-child td { border-bottom: 0; }
      .ot small { display: block; margin-top: 2px; font-size: 12px; color: var(--ink-muted); }
      .ot small.faint { color: var(--ink-faint); }
      .ot .r { text-align: right; } .ot .mu { color: var(--ink-muted); }
      .ot .acts { display: flex; justify-content: flex-end; gap: 6px; }

      .site { position: absolute; inset: 0; background: #faf6ef; color: #211d16; font: 400 14px/1.4 'Poppins'; }
      .site .demo { background: #211d16; color: #fff; text-align: center; font-size: 12.5px; line-height: 1.35; padding: 8px 18px; }
      .site .shead { display: flex; align-items: center; gap: 10px; height: 58px; padding: 0 14px; border-bottom: 1px solid #e3dccf; background: #faf6ef; }
      .site .shead b { font-weight: 600; font-size: 16px; flex: 1; }
      .site .slogo { width: 34px; height: 34px; border-radius: 9px; background: #c2410c; color: #fff; display: grid; place-items: center; font-weight: 600; }
      .site .scart { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 500; padding: 8px 13px; border-radius: 11px; background: #c2410c; color: #fff; }
      .site .scart em { font-style: normal; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 99px; background: rgba(255,255,255,.25); display: inline-grid; place-items: center; font-size: 12px; }
      .site .mwin { position: absolute; left: 0; right: 0; top: 104px; bottom: 0; overflow: hidden; }
      .site .mscroll { position: relative; }
      .site .snav { display: flex; gap: 20px; padding: 10px 16px; border-bottom: 1px solid #e3dccf; font-size: 14px; } .site .snav b { font-weight: 600; }
      .site .sbody { padding: 0 16px 24px; }
      .site .shd { font: 600 12.5px/1 'Playfair Display'; letter-spacing: .32em; text-transform: uppercase; color: #948b7b; margin: 22px 0 12px; }
      .site .srow { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
      .site .no { font: 400 13px/1 'Playfair Display'; color: #948b7b; margin-top: 7px; }
      .site .snm { font: 500 18px/1.2 'Playfair Display'; white-space: nowrap; }
      .site .srow i { flex: 1; border-top: 1.5px dotted #d6cdbd; }
      .site .sds { margin-top: 3px; font-size: 12.5px; color: #6a6153; line-height: 1.35; }
      .site .spr { font-weight: 600; font-size: 14.5px; white-space: nowrap; }
      .site .sadd { display: inline-block; margin-top: 5px; padding: 3px 0; font-size: 11.5px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: #6a6153; }
      .site .sadd.ok { color: #047857; }
      .site .ttl { margin-top: 12px; text-align: center; font: 600 23px/1.2 'Poppins'; }
      .site .ttl2 { margin-top: 22px; font: 600 17px/1.2 'Poppins'; }
      .site .lines { margin-top: 14px; border: 1px solid #e3dccf; border-radius: 18px; }
      .site .cl { display: flex; gap: 12px; padding: 12px; border-top: 1px solid #e3dccf; } .site .cl:first-child { border-top: 0; }
      .site .cl b { font-weight: 500; }
      .site .ph { width: 54px; height: 54px; flex: none; border-radius: 12px; background: #efe8db; }
      .site .qt { display: inline-flex; align-items: center; gap: 10px; border: 1px solid #e3dccf; border-radius: 9px; padding: 3px 10px; font-size: 13px; } .site .qt i { font-style: normal; color: #6a6153; }
      .site .faint { color: #948b7b; }
      .site .flab { margin: 14px 0 6px; font-size: 13.5px; font-weight: 500; }
      .site .ful { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .site .ful span { padding: 11px 8px; border: 1px solid #e3dccf; border-radius: 12px; text-align: center; font-size: 13.5px; font-weight: 500; }
      .site .ful span.on { border-color: #211d16; box-shadow: inset 0 0 0 1px #211d16; }
      .site .hint2 { margin-top: 6px; font-size: 12px; color: #6a6153; }
      .site .input { background: #fff; border-color: #e3dccf; height: 44px; font-family: 'Poppins'; font-size: 14px; }
      .site .pay { display: flex; gap: 12px; padding: 12px 14px; border: 1px solid #e3dccf; border-radius: 12px; font-size: 13px; }
      .site .pay b { display: block; font-weight: 500; } .site .pay small { display: block; color: #6a6153; font-size: 12px; }
      .site .radio { width: 16px; height: 16px; margin-top: 2px; flex: none; border-radius: 50%; border: 5px solid #211d16; }
      .site .valid { margin-top: 18px; height: 50px; border-radius: 14px; background: #c2410c; color: #fff; display: grid; place-items: center; font-weight: 500; font-size: 14.5px; }
      .site .sbox { margin-top: 16px; padding: 14px 16px; border: 1px solid #e3dccf; border-radius: 18px; font-size: 13.5px; }
      .site .sbox > b { font-weight: 500; } .site .sbox .row { margin-top: 8px; } .site .sbox .tot { font-weight: 600; font-size: 15px; }
      .site .okc { width: 52px; height: 52px; margin: 18px auto 0; border-radius: 50%; background: #ecfdf5; color: #047857; display: grid; place-items: center; font-size: 24px; }
      .site .thx { margin-top: 6px; text-align: center; color: #6a6153; font-size: 13.5px; }
      .site .bh { display: flex; justify-content: space-between; align-items: center; } .site .bh b { font-weight: 500; }
      .site .bh span { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #948b7b; }
      .site .bh em { width: 6px; height: 6px; border-radius: 50%; background: #10b981; }
      .site .steps { display: flex; align-items: flex-start; margin-top: 16px; }
      .site .st { display: flex; flex-direction: column; align-items: center; width: 58px; flex: none; }
      .site .st span { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 500; background: #efe8db; color: #948b7b; }
      .site .st.on span { background: #211d16; color: #faf6ef; }
      .site .st small { margin-top: 6px; text-align: center; font-size: 10.5px; line-height: 1.2; color: #948b7b; }
      .site .st.cur small { color: #211d16; font-weight: 600; }
      .site .steps i { flex: 1; height: 2px; margin-top: 14px; background: #efe8db; } .site .steps i.on { background: #211d16; }
      .site .paym { margin-top: 14px; font-size: 13px; color: #6a6153; } .site .paym b { font-weight: 500; color: #211d16; }
      .site .dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .site .dl small { display: block; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #948b7b; }
      .site .dl b { font-weight: 500; font-size: 13.5px; }
    `,
  };
})();
