/**
 * Tutoriel « L'écran de cuisine » (MagyaPro Restaurant).
 *
 * L'ordinateur montre l'écran Cuisine (`components/dashboard/kitchen-board.tsx`) :
 * trois colonnes « À préparer », « En préparation », « Prêtes » ; une fiche
 * par commande avec son numéro, son temps d'attente (orange passé quinze
 * minutes), le type (table, à emporter), les plats, les options en orange et
 * la note du client ; « Démarrer », puis « Marquer prête ».
 *
 * Le téléphone montre le suivi de commande du client
 * (`app/r/[host]/commande/[orderId]` et `components/site/order-status-tracker.tsx`) :
 * la frise Nouvelle → Confirmée → En préparation → Prête → Terminée suit les
 * gestes de la cuisine, sans que le client recharge la page.
 */
(() => {
  const ORDERS = {
    10: { n: 10, wait: 17, where: 'Table 4', items: [['2', 'Poulet yassa'], ['1', 'Jus de bissap']] },
    11: { n: 11, wait: 0, where: 'À emporter', items: [['2', 'Poulet yassa', 'Accompagnement : Alloco'], ['1', 'Thieboudienne']], note: 'Sans piment, s’il vous plaît.' },
    9: { n: 9, wait: 12, where: 'Table 2', items: [['1', 'Thieboudienne'], ['1', 'Mafé bœuf']] },
    8: { n: 8, wait: 9, where: 'À emporter', items: [['2', 'Dibi mouton', null, 'Grande portion']] },
  };
  const COLS = [['CONFIRMED', 'À préparer'], ['PREPARING', 'En préparation'], ['READY', 'Prêtes']];
  const STEPS = [['NEW', 'Nouvelle'], ['CONFIRMED', 'Confirmée'], ['PREPARING', 'En préparation'], ['READY', 'Prête'], ['COMPLETED', 'Terminée']];

  function side() {
    const item = (label, on) => `<div class="nav ${on ? 'on' : ''}"><i></i>${label}</div>`;
    return `<div class="side"><div class="logo">Magya<b>pro</b></div><div class="resto">Chez Aminata<small>Restaurant</small></div><h6>Service</h6>
      ${item('Vue d’ensemble')}${item('À traiter')}${item('Commandes')}${item('Cuisine', true)}${item('Réservations')}</div>`;
  }

  // ------------------------------------------------------------ La cuisine
  function card(o, status) {
    const late = o.wait >= 15;
    const items = o.items.map(([q, nm, opt, v]) => `<li><b>${q}×</b><span>${nm}${v ? `<em> (${v})</em>` : ''}${opt ? `<i>${opt}</i>` : ''}</span></li>`).join('');
    const btn = status === 'CONFIRMED' ? 'Démarrer' : status === 'PREPARING' ? 'Marquer prête' : '';
    return `<div class="card kc" data-t="card-${o.n}" ${o.n === 11 ? `data-born="k11-${status}"` : ''}>
      <div class="kh"><span class="num">n°${o.n}</span><span class="wt ${late ? 'late' : ''}" data-t="wait-${o.n}">${o.wait} min</span></div>
      <div class="kw">${o.where}</div><ul>${items}</ul>
      ${o.note ? `<div class="knote">${o.note}</div>` : ''}
      ${btn ? `<div class="kbtn" data-t="${status === 'CONFIRMED' ? 'go' : 'ready'}-${o.n}">${btn}</div>` : ''}</div>`;
  }
  function deskHTML(s) {
    const cols = COLS.map(([st, title]) => {
      const list = Object.values(ORDERS).filter((o) => s.status[o.n] === st).sort((a, b) => b.wait - a.wait);
      return `<div><div class="kt">${title}<span data-pop="cnt-${st}-${list.length}">${list.length}</span></div>
        ${list.length ? list.map((o) => card(o, st)).join('') : '<div class="kempty">Rien ici</div>'}</div>`;
    }).join('');
    return `<div class="app">${side()}<div class="main"><h1>Cuisine</h1><div class="lead">Commandes confirmées, dans l'ordre d'arrivée. Les plus anciennes d'abord.</div>
      <div class="kgrid">${cols}</div></div></div>`;
  }

  // ------------------------------------------------------------ Le client
  function mobHTML(s) {
    const cur = STEPS.findIndex(([k]) => k === s.client);
    const steps = STEPS.map(([k, label], i) => {
      const done = i < cur, on = i === cur;
      return `<div class="st ${done || on ? 'on' : ''} ${on ? 'cur' : ''}" data-t="trk-${k}"><span ${on ? `data-pop="trk-${k}"` : ''}>${done ? '✓' : i + 1}</span><small>${label}</small></div>${i < STEPS.length - 1 ? `<i class="${done ? 'on' : ''}"></i>` : ''}`;
    }).join('');
    return `<div class="site"><div class="demo">Restaurant de démonstration — les commandes passées ici sont fictives.</div>
      <div class="shead"><span class="slogo">C</span><b>Chez Aminata</b><span class="scart">Panier</span></div>
      <div class="sbody"><div class="okc">✓</div><div class="ttl">Commande enregistrée</div>
        <div class="thx">Merci Awa. Votre commande n°11 a bien été transmise à Chez Aminata.</div>
        <div class="sbox" data-t="trk"><div class="bh"><b>Suivi de la commande</b><span><em></em>Mise à jour automatique</span></div>
          <div class="steps">${steps}</div><div class="pay">Paiement : <b>En attente</b></div></div>
        <div class="sbox"><div class="dl"><div><small>Mode</small><b>Retrait sur place</b></div><div><small>Préparation estimée</small><b>environ 20 minutes</b></div></div></div>
        <div class="sbox"><b style="font-size:14px">Détail</b><div class="li"><span>2 × Poulet yassa<small>Accompagnement : Alloco</small></span><span>11 000 F CFA</span></div><div class="li"><span>1 × Thieboudienne</span><span>5 000 F CFA</span></div></div></div></div>`;
  }

  // ------------------------------------------------------------ Le temps
  let T = {};
  function events(at) {
    T = { arrive: at('arrive', 0.22), go: at('demarrer', 0.34), ready: at('prete', 0.36) };
    return [
      // Étape 1 : la commande arrive seule, on la lit d'un coup d'œil.
      { t: T.arrive, fn: (s) => { s.status[11] = 'CONFIRMED'; s.client = 'CONFIRMED'; } },
      { t: at('arrive', 0.66), d: 'card-11', look: true, hold: 1.6, tip: 'Plats, options, note', fn: () => {} },
      { t: at('lecture', 0.62), d: 'wait-10', look: true, hold: 1.4, tip: 'Plus de 15 min : en orange', fn: () => {} },
      // Étape 2 : Démarrer — le client le voit.
      { t: T.go, d: 'go-11', tip: 'Démarrer', fn: (s) => { s.status[11] = 'PREPARING'; } },
      // Le suivi du client se met à jour de lui-même, peu après le geste.
      { t: T.go + 1.0, fn: (s) => { s.client = 'PREPARING'; } },
      { t: T.go + 1.6, m: 'trk-PREPARING', look: true, hold: 1.4, tip: 'Le client le voit', fn: () => {} },
      // Étape 3 : Marquer prête.
      { t: T.ready, d: 'ready-11', tip: 'Marquer prête', chime: true, fn: (s) => { s.status[11] = 'READY'; } },
      { t: T.ready + 1.0, fn: (s) => { s.client = 'READY'; } },
      { t: T.ready + 1.6, m: 'trk-READY', look: true, hold: 1.6, tip: 'Prête !', fn: () => {} },
    ];
  }
  function afterPaint(s, t) {
    const glow = (el, a) => el && Object.assign(el.style, { boxShadow: `0 0 0 ${3 * a}px rgba(255,94,46,${a}), 0 0 24px rgba(255,94,46,${0.45 * a})` });
    glow(document.querySelector('#desk [data-t="card-11"]'), s.status[11] === 'CONFIRMED' ? 1 - span(T.arrive + 2.2, T.arrive + 3.2, t) : 0);
  }

  window.TUTO = {
    produit: 'Restaurant',
    road: [[1, 'Elle arrive'], [2, 'Démarrer'], [3, 'Prête']],
    recap: [['Elle arrive', 'seule, avec ses options et la note'], ['Démarrer', 'elle passe en préparation'], ['Marquer prête', 'le client le voit']],
    recapAt: [0.06, 0.3, 0.55],
    tagline: 'La cuisine voit tout, le client aussi.',
    hook: {
      ring: false,
      slip: '<b>BON n°11</b><br>2 yassa<br><s>1 mafé</s> thieb ?<br>n°9 prête ??<br>— sans piment',
      lost: 'Les bons <em>s’empilent.</em>',
    },
    labels: { pc: 'En cuisine', tel: 'Ce que voit le client' },
    toast: null,
    initState: () => ({ status: { 10: 'CONFIRMED', 9: 'PREPARING', 8: 'READY', 11: null }, client: 'NEW' }),
    events,
    deskHTML,
    mobHTML,
    afterPaint,
    focus: {
      plein: { x: 0, y: 0, w: 1280, h: 800 },
      tableau: { x: 240, y: 10, w: 1030, h: 620 },
      c12: { x: 250, y: 20, w: 680, h: 610 },
      c23: { x: 580, y: 0, w: 690, h: 580 },
    },
    zoneOf: (id) => (id === 'arrive' || id === 'lecture' || id === 'demarrer' ? 'c12' : id === 'prete' ? 'c23' : 'plein'),
    zoneAfterChime: 'tableau',
    css: `
      .kgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .kt { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-weight: 600; font-size: 15px; }
      .kt span { padding: 2px 10px; border-radius: 99px; background: var(--app-bg); color: var(--ink-muted); font-size: 13px; }
      .kempty { padding: 18px; border: 1.5px dashed var(--border); border-radius: 14px; text-align: center; color: var(--ink-faint); font-size: 14px; }
      .kc { padding: 14px 16px; margin-bottom: 12px; border-radius: 16px; }
      .kh { display: flex; justify-content: space-between; align-items: baseline; }
      .kh .num { font: 700 22px/1 Manrope; }
      .wt { padding: 3px 10px; border-radius: 99px; background: var(--app-bg); color: var(--ink-muted); font-size: 13px; font-weight: 600; }
      .wt.late { background: var(--warn-soft); color: var(--warn); }
      .kw { margin-top: 4px; color: var(--ink-faint); font-size: 13px; }
      .kc ul { margin: 10px 0 0; padding: 0; list-style: none; }
      .kc li { display: flex; gap: 8px; margin-bottom: 6px; font-size: 15px; }
      .kc li b { flex: none; }
      .kc li em { font-style: normal; color: var(--ink-muted); }
      .kc li i { display: block; margin-top: 2px; font-style: normal; font-size: 13px; font-weight: 600; color: var(--warn); }
      .knote { margin-top: 10px; padding: 8px 10px; border-radius: 10px; background: var(--warn-soft); color: var(--warn); font-size: 13px; font-weight: 600; }
      .kbtn { margin-top: 12px; height: 44px; border-radius: 10px; background: var(--ink); color: #fff; display: grid; place-items: center; font-weight: 600; font-size: 15px; }

      .site { position: absolute; inset: 0; background: #faf6ef; color: #211d16; font: 400 14px/1.4 'Poppins'; }
      .site .demo { background: #211d16; color: #fff; text-align: center; font-size: 12.5px; line-height: 1.35; padding: 8px 18px; }
      .site .shead { display: flex; align-items: center; gap: 10px; height: 58px; padding: 0 14px; border-bottom: 1px solid #e3dccf; }
      .site .shead b { font-weight: 600; font-size: 16px; flex: 1; }
      .site .slogo { width: 34px; height: 34px; border-radius: 9px; background: #c2410c; color: #fff; display: grid; place-items: center; font-weight: 600; }
      .site .scart { font-size: 13.5px; font-weight: 500; padding: 8px 13px; border-radius: 11px; background: #c2410c; color: #fff; }
      .site .sbody { padding: 22px 16px; }
      .site .okc { width: 52px; height: 52px; margin: 0 auto; border-radius: 50%; background: #ecfdf5; color: #047857; display: grid; place-items: center; font-size: 24px; }
      .site .ttl { margin-top: 12px; text-align: center; font: 600 23px/1.2 'Poppins'; }
      .site .thx { margin-top: 6px; text-align: center; color: #6a6153; font-size: 13.5px; }
      .site .sbox { margin-top: 16px; padding: 16px; border: 1px solid #e3dccf; border-radius: 18px; }
      .site .bh { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; }
      .site .bh b { font-weight: 500; }
      .site .bh span { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #948b7b; }
      .site .bh em { width: 6px; height: 6px; border-radius: 50%; background: #10b981; }
      .site .steps { display: flex; align-items: flex-start; margin-top: 16px; }
      .site .st { display: flex; flex-direction: column; align-items: center; width: 58px; flex: none; }
      .site .st span { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 500; background: #efe8db; color: #948b7b; }
      .site .st.on span { background: #211d16; color: #faf6ef; }
      .site .st small { margin-top: 6px; text-align: center; font-size: 10.5px; line-height: 1.2; color: #948b7b; }
      .site .st.cur small { color: #211d16; font-weight: 600; }
      .site .steps i { flex: 1; height: 2px; margin-top: 14px; background: #efe8db; }
      .site .steps i.on { background: #211d16; }
      .site .pay { margin-top: 16px; font-size: 13px; color: #6a6153; }
      .site .pay b { font-weight: 500; color: #211d16; }
      .site .dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .site .dl small { display: block; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #948b7b; }
      .site .dl b { font-weight: 500; font-size: 13.5px; }
      .site .li { display: flex; justify-content: space-between; gap: 10px; padding: 10px 0 0; font-size: 13px; }
      .site .li small { display: block; color: #6a6153; font-size: 11.5px; }
    `,
  };
})();
