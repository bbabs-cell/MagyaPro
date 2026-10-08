/**
 * Tutoriel « Créer sa carte » (MagyaPro Restaurant).
 *
 * L'ordinateur montre le gérant, le téléphone montre le client : à gauche la
 * page Menu (`components/dashboard/menu-manager.tsx` — catégories, plats,
 * « Nouveau plat », « Marquer épuisé »), à droite le site public de « Chez
 * Aminata » tel que le client le voit (modèle numéroté de
 * `components/site/templates/index.tsx` : un plat indisponible y passe en
 * grisé). Ce qui est enregistré d'un côté apparaît de l'autre.
 *
 * La photo du plat est une illustration dessinée ici : le restaurant de
 * démonstration n'a pas de vraie photo, et on n'en invente pas.
 */
(() => {
  const CATS = [
    { k: 'gril', nm: 'Grillades' },
    { k: 'mij', nm: 'Plats mijotés' },
    { k: 'bois', nm: 'Boissons' },
  ];
  const BASE = {
    gril: [
      { k: 'dibi', nm: 'Dibi mouton', desc: 'Mouton grillé, oignons confits, moutarde.', pr: 6000, vars: 2 },
      { k: 'yassa', nm: 'Poulet yassa', desc: 'Poulet mariné au citron, oignons fondants, riz blanc.', pr: 5500 },
    ],
    mij: [
      { k: 'thieb', nm: 'Thieboudienne', desc: 'Riz au poisson, légumes du marché, sauce tomate.', pr: 5000 },
      { k: 'mafe', nm: 'Mafé bœuf', desc: 'Bœuf mijoté à la pâte d’arachide, riz blanc.', pr: 5500 },
    ],
    bois: [
      { k: 'bissap', nm: 'Jus de bissap', desc: 'Fleurs d’hibiscus, menthe fraîche.', pr: 1000 },
      { k: 'bouye', nm: 'Bouye', desc: 'Jus de pain de singe, onctueux.', pr: 1000 },
      { k: 'ging', nm: 'Gingembre', desc: 'Gingembre frais pressé.', pr: 1000 },
      { k: 'eau', nm: 'Eau minérale', desc: '50 cl.', pr: 500 },
    ],
  };
  const NEW = { k: 'braise', nm: 'Poulet braisé', desc: 'Mariné, braisé au feu de bois, avec alloco.', pr: 4500, photo: true };

  /** Le plat, dessiné (bois, assiette, poulet braisé, alloco, oignons). */
  const dishSVG = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="display:block">
    <rect width="100" height="100" fill="#6b3f22"/>
    <path d="M0 18h100M0 41h100M0 66h100M0 88h100" stroke="#5a341b" stroke-width="2.5"/>
    <circle cx="50" cy="52" r="41" fill="#efe6d6"/><circle cx="50" cy="52" r="33" fill="#fffaf1"/>
    <g transform="rotate(-18 42 46)"><ellipse cx="42" cy="46" rx="20" ry="13" fill="#9a4f1c"/><ellipse cx="40" cy="44" rx="15" ry="8.5" fill="#b8642a"/>
      <path d="M28 41l8 9M34 38l9 11M41 37l9 11M48 39l6 8" stroke="#4a230c" stroke-width="2.2" stroke-linecap="round"/></g>
    <g transform="rotate(24 63 38)"><ellipse cx="63" cy="38" rx="11" ry="7.5" fill="#a85520"/><path d="M57 35l5 6M62 33l5 7" stroke="#4a230c" stroke-width="2" stroke-linecap="round"/>
      <rect x="72" y="36" width="9" height="4" rx="2" fill="#f1e2c4"/></g>
    ${[[30, 67, -20], [41, 72, 10], [53, 73, -5], [64, 68, 25], [71, 58, 60]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="7" ry="4.6" fill="#e39a2c"/><ellipse cx="${x}" cy="${y}" rx="4.6" ry="2.6" fill="#f2bf55"/></g>`).join('')}
    <ellipse cx="70" cy="49" rx="6" ry="3.4" fill="none" stroke="#a8466c" stroke-width="1.6"/><ellipse cx="66" cy="52" rx="5" ry="2.8" fill="none" stroke="#a8466c" stroke-width="1.4"/>
    <path d="M24 52q4-6 9-2M57 59q4-5 8-1" stroke="#4f8a3b" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <circle cx="35" cy="60" r="1.6" fill="#c0392b"/><circle cx="60" cy="47" r="1.4" fill="#c0392b"/>
  </svg>`;

  const productsOf = (s, cat) => [...BASE[cat], ...(cat === 'gril' && s.saved ? [NEW] : [])];
  const caret = (s, f) => (s.focus === f ? '<span class="caret"></span>' : '');
  const typed = (s, f, ph = '') => `${s[f] || ''}${caret(s, f)}${!s[f] && s.focus !== f ? `<span style="color:var(--ink-faint)">${ph}</span>` : ''}`;

  function side() {
    const item = (label, on) => `<div class="nav ${on ? 'on' : ''}"><i></i>${label}</div>`;
    return `<div class="side"><div class="logo">Magya<b>pro</b></div><div class="resto">Chez Aminata<small>Restaurant</small></div><h6>Service</h6>
      ${item('Vue d’ensemble')}${item('Commandes')}${item('Cuisine')}<h6 style="margin-top:16px">Carte &amp; salle</h6>${item('Menu', true)}${item('Atelier photo')}${item('Salle')}</div>`;
  }

  // ------------------------------------------------------------ Le gérant
  function listHTML(s) {
    const pill = (c) => {
      const n = productsOf(s, c.k).length;
      return `<span class="cpill ${s.cat === c.k ? 'on' : ''}" data-t="cat-${c.k}">${c.nm}<em ${c.k === 'gril' && s.saved ? 'data-pop="cnt"' : ''}>${n}</em></span>`;
    };
    const row = (p) => {
      const off = p.k === 'dibi' && s.dibiOff;
      const sub = [fmt(p.pr), p.vars ? `${p.vars} variantes` : '', p.k === 'braise' ? '1 variante' : ''].filter(Boolean).join(' · ');
      return `<div class="prow" ${p.k === 'braise' ? 'data-born="d-braise"' : ''} data-t="row-${p.k}">
        <span class="thumb">${p.photo ? dishSVG(56) : ''}</span>
        <div style="flex:1;min-width:0"><div style="font-weight:600">${p.nm}${off ? ' <span class="badge n" data-born="ind">Indisponible</span>' : ''}</div><div class="sub">${sub}</div></div>
        <span class="btn sec sm" data-t="ep-${p.k}">${off ? 'Remettre en vente' : 'Marquer épuisé'}</span><span class="btn ghost sm">Modifier</span><span class="btn ghost sm">Supprimer</span></div>`;
    };
    return `<h1>Menu</h1><div class="lead">Vos catégories et vos plats. Les modifications sont visibles immédiatement sur votre site.</div>
      <div class="card" style="padding:18px 20px;margin-bottom:18px"><div class="row"><b style="font-size:14.5px">Catégories</b><span class="btn sec sm">Nouvelle catégorie</span></div>
        <div style="display:flex;gap:8px;margin-top:14px">${CATS.map(pill).join('')}</div></div>
      <div class="card" style="padding:18px 20px"><div class="row"><b style="font-size:14.5px">Plats</b><span class="btn sm" data-t="new">Nouveau plat</span></div>
        <div style="margin-top:8px">${productsOf(s, s.cat).map(row).join('')}</div></div>`;
  }
  function formHTML(s) {
    const variant = s.variant ? `<div style="display:flex;gap:8px;margin-top:12px" data-born="var">
        <div class="input ${s.focus === 'vname' ? 'focus' : ''}" data-t="v-name" style="flex:1">${typed(s, 'vname', 'Grande')}</div>
        <div class="input ${s.focus === 'vprice' ? 'focus' : ''}" data-t="v-price" style="width:130px">${typed(s, 'vprice', '0')}</div><span class="btn ghost sm" style="height:44px">Retirer</span></div>` : '';
    return `<div class="card fcard"><div style="font:600 20px/1.2 Manrope">Nouveau plat</div>
      <div class="label">Catégorie <span class="req">*</span></div><div class="input" data-t="f-cat">Grillades<span style="margin-left:auto;color:var(--ink-faint)">▾</span></div>
      <div class="label">Nom <span class="req">*</span></div><div class="input ${s.focus === 'name' ? 'focus' : ''}" data-t="f-name">${typed(s, 'name')}</div>
      <div class="label">Description</div><div class="input ta ${s.focus === 'desc' ? 'focus' : ''}" data-t="f-desc">${typed(s, 'desc')}</div>
      <div class="label">Photo du plat</div>
      <div style="display:flex;align-items:center;gap:12px" data-t="f-photo-row">${s.photo ? `<span class="pthumb" data-born="photo">${dishSVG(64)}</span>` : '<span class="pthumb empty">Vide</span>'}
        <span class="btn sec sm" data-t="f-photo">${s.photo ? 'Remplacer' : 'Choisir une image'}</span>${s.photo ? '<span class="btn ghost sm">Retirer</span>' : ''}</div>
      <div class="hint">Format paysage recommandé. 5 Mo maximum.</div>
      <div class="grid2"><div><div class="label">Prix (F CFA) <span class="req">*</span></div><div class="input ${s.focus === 'price' ? 'focus' : ''}" data-t="f-price">${typed(s, 'price')}</div></div>
        <div><div class="label">Ancien prix (F CFA)</div><div class="input"></div><div class="hint">Affiché barré. Laissez vide s'il n'y a pas de remise.</div></div></div>
      <div class="label">Coût de revient (F CFA)</div><div class="input"></div>
      <div class="grid2"><div><div class="label">Badge</div><div class="input">Aucun<span style="margin-left:auto;color:var(--ink-faint)">▾</span></div></div>
        <div style="display:flex;align-items:flex-end;gap:10px;padding-bottom:12px;font-size:14px"><span class="box on"></span>Disponible à la commande</div></div>
      <div class="fs" data-t="var-box"><span class="lg">Variantes</span><div class="hint" style="margin:0">Tailles ou formats. Le prix d'une variante remplace le prix de base.</div>
        ${variant}<span class="btn sec sm" data-t="add-var" style="margin-top:12px">Ajouter une variante</span></div>
      <div class="fs"><span class="lg">Groupes d'options</span><div class="hint" style="margin:0">Suppléments et accompagnements. Un supplément peut ajouter un montant au prix.</div>
        <span class="btn sec sm" style="margin-top:12px">Ajouter un groupe d'options</span></div>
      <div style="display:flex;gap:10px;margin-top:22px"><span class="btn" data-t="save">Enregistrer</span><span class="btn ghost">Annuler</span></div></div>`;
  }
  function deskHTML(s) {
    return `<div class="app">${side()}<div class="main"><div class="scroller ${s.page}" id="scroller">${s.page === 'form' ? formHTML(s) : listHTML(s)}</div></div></div>`;
  }

  // ------------------------------------------------------------ Le client
  function mobHTML(s) {
    const row = (p, i) => `<div class="srow" data-t="m-${p.k}" ${p.k === 'braise' ? 'data-born="m-braise"' : ''}>
      <span class="no">${String(i + 1).padStart(2, '0')}</span>${p.photo ? `<span class="sth">${dishSVG(44)}</span>` : ''}
      <div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;gap:6px"><span class="snm">${p.nm}</span><i></i></div><div class="sds">${p.desc}</div></div>
      <div style="text-align:right;flex:none"><div class="spr">${fmt(p.pr)}</div><div class="sadd">+ Ajouter</div></div></div>`;
    const sec = (c) => `<div class="shd">${c.nm}</div>${productsOf(s, c.k).map(row).join('')}`;
    return `<div class="site"><div class="demo">Restaurant de démonstration — les commandes passées ici sont fictives.</div>
      <div class="shead"><span class="slogo">C</span><b>Chez Aminata</b><span class="slang">Français ▾</span><span class="scart">Panier</span></div>
      <div class="snav"><span>Accueil</span><b>Menu</b><span>Réserver</span><span>Informations</span></div>
      <div class="stitle">Notre carte</div>
      <div class="stabs">${CATS.map((c) => `<span>${c.nm}</span>`).join('')}</div>
      <div class="sbody" id="sbody">${sec(CATS[0])}${sec(CATS[1])}</div></div>`;
  }

  // ------------------------------------------------------------ Le temps
  let T = {};
  function events(at) {
    T = {
      price: at('fiche', 0.95), addVar: at('choix', 0.22), save: at('enregistrer', 0.32), ep: at('epuise', 0.45),
    };
    // Défilement du formulaire : vers le champ suivant, avant que le pointeur y aille.
    T.scroll = [
      { t: T.price - 1.2, key: 'f-price' },
      { t: T.addVar - 1.2, key: 'var-box' },
      { t: T.save - 1.2, key: 'save' },
    ];
    return [
      // Étape 1 : la catégorie, puis « Nouveau plat ».
      { t: at('nouveau', 0.44), d: 'cat-gril', tip: 'La catégorie', fn: (s) => { s.cat = 'gril'; } },
      { t: at('nouveau', 0.80), d: 'new', tip: 'Nouveau plat', fn: (s) => { s.page = 'form'; } },
      // Étape 2 : la fiche du plat.
      { t: at('fiche', 0.16), d: 'f-name', tip: 'Le nom', fn: (s) => { s.focus = 'name'; }, type: { field: 'name', text: NEW.nm, dur: 0.6 } },
      { t: at('fiche', 0.34), d: 'f-desc', tip: 'La description', fn: (s) => { s.focus = 'desc'; }, type: { field: 'desc', text: NEW.desc, dur: 0.7 } },
      { t: at('fiche', 0.58), d: 'f-photo', tip: 'Une photo', fn: (s) => { s.focus = null; s.photo = true; } },
      { t: T.price, d: 'f-price', tip: 'Le prix', fn: (s) => { s.focus = 'price'; }, type: { field: 'price', text: '4500', dur: 0.4 } },
      { t: T.addVar, d: 'add-var', tip: 'Ajouter une variante', fn: (s) => { s.focus = null; s.variant = true; } },
      { t: at('choix', 0.42), d: 'v-name', tip: 'La taille', fn: (s) => { s.focus = 'vname'; }, type: { field: 'vname', text: 'Grande portion', dur: 0.6 } },
      { t: at('choix', 0.62), d: 'v-price', tip: 'Son prix', fn: (s) => { s.focus = 'vprice'; }, type: { field: 'vprice', text: '7000', dur: 0.4 } },
      // Étape 3 : enregistrer — le site suit ; puis un plat épuisé.
      { t: T.save, d: 'save', tip: 'Enregistrer', chime: true,
        fn: (s) => { s.focus = null; s.page = 'list'; s.saved = true; s.toast = true; } },
      // La confirmation s'efface d'elle-même, comme dans l'application.
      { t: T.save + 2.6, fn: (s) => { s.toast = false; } },
      { t: T.ep, d: 'ep-dibi', tip: 'Marquer épuisé', fn: (s) => { s.dibiOff = true; s.toast = false; } },
    ];
  }

  /** Décalage d'un élément `data-t` dans le formulaire (hors transformations). */
  function offsetIn(root, key) {
    let el = root.querySelector(`[data-t="${key}"]`), y = 0;
    const stop = root.querySelector('#scroller');
    while (el && el !== stop) { y += el.offsetTop; el = el.offsetParent; }
    return el ? y : 0;
  }
  function afterPaint(s, t) {
    const desk = document.getElementById('desk');
    const sc = desk.querySelector('#scroller');
    if (s.page === 'form') {
      const max = Math.max(0, sc.scrollHeight - 744);
      const yOf = (k) => Math.min(max, Math.max(0, offsetIn(desk, k) - 190));
      let y = 0;
      for (const kf of T.scroll) {
        if (t < kf.t) break;
        y = mix(y, yOf(kf.key), smooth(span(kf.t, kf.t + 0.6, t)));
      }
      sc.style.transform = `translateY(${-y}px)`;
    } else sc.style.transform = 'none';

    // Côté client : le nouveau plat s'allume, le plat épuisé s'éteint.
    const mob = document.getElementById('mob');
    const glow = (el, a) => el && Object.assign(el.style, { boxShadow: `0 0 0 ${3 * a}px rgba(255,94,46,${a}), 0 0 24px rgba(255,94,46,${0.45 * a})` });
    const nb = mob.querySelector('[data-t="m-braise"]');
    glow(nb, 1 - span(T.save + 2.4, T.save + 3.4, t));
    const dibi = mob.querySelector('[data-t="m-dibi"]');
    if (dibi) {
      const k = s.dibiOff ? span(T.ep + 0.1, T.ep + 0.6, t) : 0;
      dibi.style.opacity = String(mix(1, 0.6, k));
      glow(dibi, s.dibiOff ? Math.sin(Math.PI * span(T.ep, T.ep + 2.2, t)) : 0);
    }
  }

  window.TUTO = {
    produit: 'Restaurant',
    road: [[1, 'Nouveau plat'], [2, 'La fiche'], [3, 'Enregistrer']],
    recap: [['Menu', 'la catégorie, puis Nouveau plat'], ['La fiche', 'nom, photo, prix, variantes'], ['Enregistrer', 'votre site suit aussitôt']],
    recapAt: [0.06, 0.3, 0.55],
    tagline: 'Votre carte à jour, votre site aussi.',
    hook: {
      ring: false,
      slip: '<b>MENU</b><br>Dibi <s>5 000</s> 6 000<br><s>Thieb 5 000</s><br>Yassa 5 500<br>+ braisé ???',
      lost: 'Le menu imprimé <em>est déjà faux.</em>',
    },
    labels: { pc: 'Sur ordinateur', tel: 'Ce que voit le client' },
    toast: 'Plat enregistré.',
    toastOn: ['d'],
    toastAt: { d: { left: '470px', top: '22px' } },
    zoneAfterChime: 'liste',
    initState: () => ({ page: 'list', cat: 'mij', focus: null, name: '', desc: '', price: '', photo: false, variant: false, vname: '', vprice: '',
      saved: false, toast: false, dibiOff: false }),
    events,
    deskHTML,
    mobHTML,
    afterPaint,
    focus: {
      plein: { x: 0, y: 0, w: 1280, h: 800 },
      liste: { x: 244, y: 10, w: 800, h: 540 },
      form: { x: 244, y: 0, w: 720, h: 450 },
    },
    zoneOf: (id) => (id === 'nouveau' || id === 'epuise' ? 'liste' : ['fiche', 'choix', 'enregistrer'].includes(id) ? 'form' : 'plein'),
    css: `
      .scroller { position: relative; max-width: 760px; }
      /* Le formulaire défile jusqu'à « Enregistrer », même sous la caméra rapprochée. */
      .scroller.form { padding-bottom: 420px; }
      .btn.sm { height: 36px; padding: 0 14px; font-size: 14px; border-radius: 12px; }
      .badge.n { background: var(--app-bg); color: var(--ink-muted); margin-left: 6px; vertical-align: 2px; }
      .cpill { padding: 7px 13px; border-radius: 10px; background: var(--app-bg); color: var(--ink-muted); font-size: 14.5px; }
      .cpill em { font-style: normal; margin-left: 7px; opacity: .7; }
      .cpill.on { background: var(--accent); color: #fff; }
      .prow { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--border); }
      .prow:first-child { border-top: 0; }
      .prow .sub { color: var(--ink-muted); font-size: 14px; margin-top: 2px; }
      .thumb { width: 56px; height: 56px; flex: none; border-radius: 12px; overflow: hidden; background: var(--app-bg); }
      .fcard { width: 680px; padding: 22px 24px 26px; }
      .fcard .label { margin-top: 16px; }
      .input.ta { height: 66px; align-items: flex-start; padding-top: 11px; }
      .hint { font-size: 12.5px; color: var(--ink-muted); margin-top: 6px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .pthumb { width: 64px; height: 64px; flex: none; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
      .pthumb.empty { border-style: dashed; display: grid; place-items: center; font-size: 12px; color: var(--ink-faint); }
      .fs { position: relative; margin-top: 22px; padding: 16px; border: 1px solid var(--border); border-radius: 14px; }
      .fs .lg { position: absolute; top: -10px; left: 12px; padding: 0 5px; background: var(--card); font-size: 13.5px; font-weight: 600; }
      .fs .btn { display: flex; width: fit-content; }

      .site { position: absolute; inset: 0; background: #faf6ef; color: #211d16; font: 400 14px/1.4 'Poppins'; }
      .site .demo { background: #211d16; color: #fff; text-align: center; font-size: 12.5px; line-height: 1.35; padding: 8px 18px; }
      .site .shead { display: flex; align-items: center; gap: 10px; height: 60px; padding: 0 14px; border-bottom: 1px solid #e3dccf; }
      .site .shead b { font-weight: 600; font-size: 16px; flex: 1; }
      .site .slogo { width: 34px; height: 34px; border-radius: 9px; background: #c2410c; color: #fff; display: grid; place-items: center; font-weight: 600; }
      .site .slang { font-size: 12px; padding: 5px 8px; border: 1px solid #e3dccf; border-radius: 8px; }
      .site .scart { font-size: 13.5px; font-weight: 500; padding: 8px 13px; border-radius: 11px; background: #c2410c; color: #fff; }
      .site .snav { display: flex; gap: 20px; padding: 10px 16px; border-bottom: 1px solid #e3dccf; font-size: 14px; }
      .site .snav b { font-weight: 600; }
      .site .stitle { font: 600 27px/1 'Poppins'; letter-spacing: -.01em; padding: 24px 16px 18px; }
      .site .stabs { display: flex; gap: 30px; padding: 0 26px 14px; border-bottom: 1px solid #e3dccf; color: #6a6153; font-size: 14px; }
      .site .sbody { padding: 0 16px; }
      .site .shd { font: 600 12.5px/1 'Playfair Display'; letter-spacing: .32em; text-transform: uppercase; color: #948b7b; margin: 24px 0 14px; }
      .site .srow { display: flex; align-items: flex-start; gap: 10px; margin: 0 -8px 10px; padding: 6px 8px; border-radius: 12px; }
      .site .no { font: 400 13px/1 'Playfair Display'; color: #948b7b; margin-top: 7px; }
      .site .sth { width: 44px; height: 44px; flex: none; border-radius: 10px; overflow: hidden; }
      .site .snm { font: 500 18px/1.2 'Playfair Display'; white-space: nowrap; }
      .site .srow i { flex: 1; border-top: 1.5px dotted #d6cdbd; }
      .site .sds { margin-top: 3px; font-size: 12.5px; color: #6a6153; line-height: 1.35; }
      .site .spr { font-weight: 600; font-size: 14.5px; white-space: nowrap; }
      .site .sadd { margin-top: 5px; font-size: 11px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: #6a6153; }
    `,
  };
})();
