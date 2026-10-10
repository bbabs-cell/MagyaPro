---
format: 1080x1920
duration: 45s
message: "Le soir, il sait ce qu'il a vendu, ce qui marche, et ce qui lui reste vraiment — sans payer la moindre IA."
arc: Hook → Promise → Proof ×3 (Demo Loop) → Risk reversal (ticket) → Brand + CTA
audience: Restaurateurs d'Afrique de l'Ouest francophone, sur téléphone
mode: autonomous
music: warm evening afrobeat-lounge, soft percussion and mellow keys, calm confident build, no vocals
captions: skipped (no narration — on-screen type carries the copy)
---

## Video direction

- **palette system** (frame.md, MagyaPro remix of broadside): ground `ink-black` #0b1730 (night blue) on every frame — one register only (dark); `cream` #fbf8f2 for type; `fire-orange` slot = braise #ff5e2e, the SOLE accent (one braise word / number per frame); `cream-muted` #b3a894 for kickers and captions. The phone's app surface is the real MagyaPro light UI (#fbf8f2 surface, #211d16 ink, braise accent) — it is a reconstructed product screen, not a palette breach. The logo's electric blue exists ONLY inside `assets/logo-magyapro.png` in Frame 7 — never as a CSS color anywhere.
- **type**: display = Bricolage Grotesque, lowercase, heavy, negative tracking (frame.md `display` / `h1` / `stat-value`); body + phone UI = Manrope; kickers / ticket = IBM Plex Mono uppercase 0.14em (`label`). French copy, exactly as written in each frame's `on_screen`; numbers in FCFA with a thin space as thousands separator ("487 500 F"), `tabular-nums`.
- **motion grammar**: smooth long-tail settles (`power3`; `expo.out` on fast arrivals), never bouncy. Reveal model: no voiceover — each frame's `on_screen` copy IS the cue list; reveal one cue at a time across the frame, back half included; nothing front-loaded. Holds stay still; at most subtle jitter (`sine-wave-loop`, low amplitude, finite).
- **texture**: a faint warm film-grain + soft vignette over the two footage frames (1, 7) only, so the filmed restaurateur and the type frames feel like one evening; type frames are clean flat night-blue with a very soft braise radial glow low behind the hero (static, `ambient-glow-bloom`).
- **rhythm / held frames**: F1 slow and human; F2 fast staccato; F3–F5 the steady demo run (each ends on a ~1s held read of its number); F5 is the climax and holds longest; F6 is the playful breather (mechanical print rhythm); F7 slows down and lands still.
- **negative list**: no slideshow (front-load then freeze); no screensaver (things floating independently); no lazy breathing; no back-half slow push except the deliberate single portrait push-in in F7; no bokeh / purple-blue "AI" gradients; no robot / sparkle / "AI" iconography; no flags, maps or city names; Wave and Orange Money never differ in size, weight or color, and neither is emphasised; no real cursor; no stock-photo props; content stays in the top ~83% (bottom band kept clear).

## Frame 1 — Combien ?

- scene: The restaurateur in golden evening light turns to the camera; a single typed line asks the question
- voiceover: ""
- duration: 7s
- poster: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/01-combien.html
- type: hook
- persuasion: Pain validation (the question every owner hears and can't answer without counting)
- beat: tension + curiosity
- asset_candidates: assets/restaurateur-plan.mp4 — 6 s vertical clip, he turns from profile to look straight into camera (play at ~0.85× to fill 7 s)
- on_screen: « combien tu as vendu aujourd'hui ? » — typed live in the lower third as he faces camera; "aujourd'hui" lands last.

- blueprint: typewriter-reveal (Adapt)
- focal: assets/restaurateur-plan.mp4
- roles: restaurateur-plan = background (full-bleed, graded warm, darkened ~35% at the bottom third for type)

Adapt: keep the type-on-with-caret signature; the canvas is live footage instead of a flat field, and the line types once (no backspace).
Scene 1 (0.0–3.4s): full-bleed footage only, cover-cropped 9:16, playing at ~0.85× so his turn lands near 3.4s; warm grade + film grain + vignette; a soft dark gradient rises over the lower third. No type yet — let the turn breathe.
Scene 2 (3.4–6.0s): as he meets the lens, « combien tu as vendu aujourd'hui ? » types on with a braise caret (`discrete-text-sequence` + `context-sensitive-cursor`), lower third, left-aligned at the pad, display `h1` lowercase cream, 2 lines; "aujourd'hui" types last and takes braise.
Scene 3 (6.0–7.0s): line complete, caret blinks twice then stops; hold still on his gaze.

narrativeRole: Opens on a real person and the everyday question that, without a tool, means an evening of counting.
keyMessage: You don't know your day until you've counted it.

## Frame 2 — Le soir, il sait

- scene: Bare night-blue field; three questions stack, then the promise lands in braise
- voiceover: ""
- duration: 5s
- poster: 4.2s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/02-il-sait.html
- type: product_intro
- persuasion: Rule of three → promise
- beat: clarity
- asset_candidates:
- on_screen: « qu'ai-je vendu ? » / « qu'est-ce qui marche ? » / « qu'est-ce qui me reste ? » — each lands solo, then they dim and « le soir, il sait. » punches in (braise on "il sait").

- blueprint: kinetic-type-beats (Adapt)

Adapt: keep the escalating multi-beat statement landing a payoff; three questions stack instead of a word swap.
Scene 1 (0.0–0.8s): flat night-blue field, soft braise glow low-center; « qu'ai-je vendu ? » slams in centered-left upper third (`kinetic-beat-slam`, `h2` lowercase cream).
Scene 2 (0.8–2.4s): « qu'est-ce qui marche ? » then « qu'est-ce qui me reste ? » land beneath it one by one on the same beat spacing, left-aligned stack, ~60% of width.
Scene 3 (2.4–3.4s): the three questions dim to `cream-hint` and compress upward (smooth `power3`) as « le soir, » enters at `display` size mid-frame.
Scene 4 (3.4–5.0s): « il sait. » punches in beside/below it in braise (`spring-pop-entrance` smooth settle, no overshoot); hold still — subtle jitter at most.

narrativeRole: States the value claim by beat 2 — the three answers, without mental arithmetic.
keyMessage: MagyaPro answers the three questions for you.

## Frame 3 — Qu'ai-je vendu ?

- scene: A phone shows MagyaPro's "Aujourd'hui" screen; the day's revenue counts up
- voiceover: ""
- duration: 7s
- poster: 5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-vendu.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: relief
- asset_candidates:
- on_screen: kicker « 01 / qu'ai-je vendu ? ». Phone UI (light app surface #fbf8f2, ink #211d16, braise accent, Manrope): header « Aujourd'hui », card « Chiffre d'affaires » counting 0 → 487 500 F CFA, then « Commandes 63 » and « Panier moyen 7 740 F » pop in beneath. Caption under phone: « sans calculer de tête. »

- blueprint: dataviz-countup (Adapt)
- focal: device-frame-stage (registry component) — a phone prop holding the reconstructed MagyaPro « Aujourd'hui » screen

Adapt: keep the value-counting hero metric as the signature; it lives inside the phone screen instead of a card grid, and the camera stays locked (Key_Feature montage mode — no push).
Scene 1 (0.0–1.0s): kicker « 01 / qu'ai-je vendu ? » types in top-left (`label`, cream-muted); the phone rises from below into center, ~62% of frame height, slight 3D tilt settling to flat (`device-frame-stage`, smooth settle). Layered depth: glow behind, phone mid, kicker front.
Scene 2 (1.0–4.2s): inside the screen, header « Aujourd'hui » and the « Chiffre d'affaires » card are already there at 0 F; the number counts 0 → 487 500 F CFA (`counting-dynamic-scale`) — the count is the shot.
Scene 3 (4.2–5.6s): « Commandes 63 » and « Panier moyen 7 740 F » pop in beneath, one then the other (`spring-pop-entrance`, smooth).
Scene 4 (5.6–7.0s): caption « sans calculer de tête. » fades up under the phone (Manrope lead, cream); hold still.

narrativeRole: Proof 1 — the day's total is just there.
keyMessage: Your day's revenue, already added up.

## Frame 4 — Qu'est-ce qui marche ?

- scene: Same phone, "Plats les plus commandés" — ranked bars grow
- voiceover: ""
- duration: 6s
- poster: 4.5s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/04-marche.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: control
- asset_candidates:
- on_screen: kicker « 02 / qu'est-ce qui marche ? ». List « Plats les plus commandés » : Poulet braisé 21 · Attiéké poisson 17 · Riz gras 12 · Alloco 8 — bars grow in rank order, the top one in braise. Caption: « tu sais quoi préparer demain. »

- blueprint: device-surface-showcase (Reproduce)
- focal: device-frame-stage (registry component) — same phone, « Plats les plus commandés » screen

Scene 1 (0.0–0.8s): kicker « 02 / qu'est-ce qui marche ? » top-left; phone already centered at the same size and position as Frame 3 (it arrives with the push-slide); screen shows the list header « Plats les plus commandés » with four empty rows.
Scene 2 (0.8–4.0s): rows fill in rank order — Poulet braisé 21 · Attiéké poisson 17 · Riz gras 12 · Alloco 8 — each dish name fades in as its bar grows left→right with its count ticking (`stat-bars-and-fills`); the top bar is braise, the others ink at low opacity.
Scene 3 (4.0–6.0s): caption « tu sais quoi préparer demain. » fades up under the phone; the top row gets a brief braise highlight sweep (`css-marker-patterns`); hold.

narrativeRole: Proof 2 — the owner sees what sells, so he plans tomorrow.
keyMessage: You know what works, dish by dish.

## Frame 5 — Qu'est-ce qui me reste ?

- scene: Revenue minus expenses assembles into what's really left
- voiceover: ""
- duration: 7s
- poster: 5.5s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/05-reste.html
- type: benefit_highlight
- persuasion: Value stacking (the subtraction is done for you)
- beat: peace of mind
- asset_candidates:
- on_screen: kicker « 03 / qu'est-ce qui me reste ? ». Phone « Finances » : « Chiffre d'affaires 487 500 F » − « Dépenses 212 000 F » (rule draws) = « Il vous reste 275 500 F » counting up large in braise. Caption: « vraiment. »

- blueprint: dataviz-countup (Adapt)
- focal: device-frame-stage (registry component) — same phone, « Finances » screen

Adapt: keep the count-up hero as the signature; the number is the RESULT of a visible subtraction that assembles line by line, and it bursts out of the phone at the end (`coordinate-target-zoom` single punch — the one camera move of the demo run).
Scene 1 (0.0–1.2s): kicker « 03 / qu'est-ce qui me reste ? » top-left; phone centered; screen « Finances » with line « Chiffre d'affaires 487 500 F » present.
Scene 2 (1.2–2.6s): « − Dépenses 212 000 F » slides in under it; a rule draws across (`svg-path-draw`).
Scene 3 (2.6–5.0s): « Il vous reste » appears and the result counts 0 → 275 500 F in braise, large (`counting-dynamic-scale`); at the end of the count the camera punches in once toward the number (`coordinate-target-zoom`, expo.out) so it reads at near full width.
Scene 4 (5.0–7.0s): caption « vraiment. » lands below in display lowercase cream; hold dead still — the climax holds longest.

narrativeRole: Proof 3 and emotional peak — not just sales, what's actually left.
keyMessage: What's really left, after expenses.

## Frame 6 — Le ticket à 0 F

- scene: A thermal ticket prints line by line: everything MagyaPro does not charge
- voiceover: ""
- duration: 7s
- poster: 6s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/06-ticket.html
- type: benefit_highlight
- persuasion: Risk reversal + negative contrast (vs. tools billed per AI request)
- beat: trust + ease
- asset_candidates:
- sfx: ticket printer feed under the print
- on_screen: Kicker « ce que magyapro ne vous facture pas ». White thermal ticket (IBM Plex Mono, dotted leaders) feeds up from a slot: « IA payante ........ 0 F » / « carte bancaire ..... 0 F » / « coût à l'usage ..... 0 F » / dashed rule / « réglé par : Wave · Orange Money » (both same size, same weight, neither first-emphasised) / « merci ! ». A final braise stamp « 0 F de surprise ».

- blueprint: compose
- focal: a hand-built thermal ticket (no registry match for a receipt print)

Compose: the print IS the motion. A dark slot (a thin horizontal bar, ink-black-alt with a hairline) sits upper-center; the white ticket feeds DOWN out of it line by line, like a real printer, its top edge staying in the slot.
Scene 1 (0.0–1.0s): kicker « ce que magyapro ne vous facture pas » (label, cream-muted) above the slot; the ticket's header « MAGYAPRO · REÇU » (mono) feeds out.
Scene 2 (1.0–4.4s): three lines print one at a time in stepped feed jolts (each ~1s, short mechanical step then still — `discrete-text-sequence`): « IA payante ........ 0 F » / « carte bancaire ..... 0 F » / « coût à l'usage ..... 0 F ». IBM Plex Mono, ink #211d16 on ticket white #fbf8f2, dotted leaders, right-aligned amounts.
Scene 3 (4.4–5.8s): dashed rule, then « réglé par : » and on one line « Wave · Orange Money » (identical size/weight/color), then « merci ! ».
Scene 4 (5.8–7.0s): a braise rubber stamp « 0 F de surprise » thumps onto the ticket at a slight angle (`spring-pop-entrance`, smooth — the one allowed small thump); hold.

narrativeRole: Removes the cost fear; the anti-"AI" positioning lands as a joke the viewer gets.
keyMessage: No paid AI, no card, no per-use bill — pay by mobile money.

## Frame 7 — MagyaPro

- scene: The restaurateur's portrait, slow push-in; the neon logo lights up over the dark top; wordmark and CTA settle
- voiceover: ""
- duration: 6s
- poster: 4.5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/07-magyapro.html
- type: cta
- persuasion: Future pacing (this evening could be yours)
- beat: confidence + motivation
- asset_candidates: assets/restaurateur-portrait.png — golden-light portrait, slow push-in, darkened toward the top; assets/logo-magyapro.png — neon M + cloche on black, composite with mix-blend-mode screen
- on_screen: logo flickers on like a neon sign (blue M first, then the orange cloche with a glow), « magyapro » wordmark below, then « le restaurant, tenu au téléphone. » and the CTA pill « essai gratuit · sans carte bancaire » + « magyapro.app ». Small last line: « existe aussi pour les boutiques ».

- blueprint: logo-assemble-lockup (Adapt)
- focal: assets/logo-magyapro.png
- roles: restaurateur-portrait = background (full-bleed, darkened toward the top ~55%, warm grade + grain) · logo-magyapro = supporting hero mark (mix-blend-mode: screen so its black disappears)

Adapt: Brand_Outro "parts-arrive / settled-reveal" variant — the mark lights up in its two parts, then the wordmark completes the lockup; static frame except the single slow portrait push-in.
Scene 1 (0.0–1.2s): portrait full-bleed, slow single push-in starts and runs the whole frame (the one sanctioned slow push); the top half is darkened by a gradient to night blue.
Scene 2 (1.2–2.6s): the logo, upper third centered ~70% width, lights up like a neon sign: the blue M flickers on in two short deterministic steps, then the orange cloche glows on with a bloom (`ambient-glow-bloom`); realized with opacity/brightness steps on two masked copies of the logo (left M region / right cloche region).
Scene 3 (2.6–4.0s): « magyapro » wordmark (display lowercase cream, "pro" braise) reveals beneath the mark, then « le restaurant, tenu au téléphone. » (lead, cream).
Scene 4 (4.0–6.0s): the CTA pill « essai gratuit · sans carte bancaire » (braise fill, cream text) and « magyapro.app » settle; finally « existe aussi pour les boutiques » (caption, cream-muted). Hold still; the video's only exit is a short fade to night blue in the last 0.4s.

narrativeRole: Brand lockup and the action to take, back on the human.
keyMessage: MagyaPro — try it free, no card.
