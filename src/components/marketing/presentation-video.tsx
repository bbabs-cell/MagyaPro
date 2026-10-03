'use client';

import { useEffect, useRef } from 'react';

/**
 * Vidéo de présentation, sur les pages Restaurant et Boutique.
 *
 * Depuis le choix du propriétaire, ce sont les **publicités de 30 secondes**
 * (`scripts/motion/pub.html`) qui tournent ici : plus denses que la première
 * vidéo, elles montrent le parcours principal puis les fonctionnalités qui
 * comptent. Les écrans animés y sont reconstitués d'après l'application
 * (couleurs, polices, libellés, produits des démos) — la légende le dit.
 * Rendu en code, sans aucun service d'IA ; réencodées plus légères pour le
 * site par `render.mjs --pub --publier`.
 *
 * ## Lecture automatique, en boucle — par décision du propriétaire
 *
 * Une première version se lançait au clic, conformément à la règle de
 * `DESIGN.md` qui ne tolérait qu'une animation autonome par page. Le
 * propriétaire a choisi la lecture automatique en boucle ; la règle a été
 * réécrite en conséquence. Ce composant tient la décision **sans en faire
 * payer le prix à ceux qui ne regardent pas** :
 *
 * - **Muette.** Les navigateurs refusent la lecture automatique d'une vidéo
 *   sonore ; celle-ci n'a de toute façon pas de piste son.
 * - **Seulement à l'écran.** La vidéo est sous la ligne de flottaison : elle
 *   démarre quand elle entre dans la fenêtre et s'arrête quand elle en sort.
 *   `preload="none"` garantit que rien n'est téléchargé avant — un visiteur
 *   qui ne descend pas jusque-là ne paie pas un octet de vidéo.
 * - **Jamais pour qui a demandé moins de mouvement** (réglage système) **ni
 *   pour qui économise ses données** (`Save-Data`). Ceux-là gardent le
 *   bouton lecture.
 * - **Le geste du visiteur l'emporte.** S'il met en pause, la vidéo ne
 *   repart plus toute seule au défilement suivant : relancer une vidéo
 *   qu'on vient d'arrêter serait désobéir.
 * - **Les commandes restent visibles.** Un contenu qui bouge seul plus de cinq
 *   secondes doit pouvoir être mis en pause (WCAG 2.2.2).
 *
 * Sans JavaScript, rien de tout cela ne s'active : la vidéo reste à lancer
 * d'un clic. C'est le bon sens de la dégradation — une vidéo qui démarre sans
 * qu'on puisse contrôler pourquoi ne l'est pas.
 *
 * ## Deux formats, un seul élément
 *
 * En 16:9 sur un téléphone, les écrans du produit dans le film devenaient
 * des vignettes illisibles. Sous 768 px, le navigateur choisit donc la
 * version verticale, la même scène recomposée en hauteur.
 *
 * Le choix passe par l'attribut `media` des `<source>`, pas par deux vidéos
 * dont l'une serait masquée : une vidéo masquée télécharge quand même son
 * affiche. Les sources 16:9 viennent en premier, avec leur condition ; un
 * navigateur ancien qui ignore `media` les prend partout, ce qui est le
 * comportement d'avant — jamais pire.
 *
 * ## Une seule affiche, pensée pour être rognée
 *
 * Une affiche par format a été essayée deux fois, et les deux ont échoué en
 * navigateur :
 *
 * - en arrière-plan CSS, elle était bien téléchargée mais **recouverte** :
 *   tant qu'aucune image de la vidéo n'est chargée, le lecteur peint un fond
 *   gris opaque. En mouvement réduit ou en économie de données — justement
 *   les cas où la vidéo ne démarre pas — le visiteur voyait un rectangle
 *   gris vide ;
 * - deux vidéos dont l'une masquée : mesuré, le navigateur télécharge
 *   l'affiche d'une vidéo masquée. Deux affiches payées pour une vue.
 *
 * L'affiche est donc un carré unique d'une cinquantaine de Ko, affiché en `object-cover` :
 * le lecteur en garde une bande horizontale en 16:9, une bande verticale en
 * 9:16. Seul le carré central survit aux deux cadrages, et c'est là qu'est
 * posée la carte finale de la publicité (marque, promesse, offre).
 */
/**
 * Ce qui distingue les deux vidéos. Tout le reste — lecture automatique,
 * garde-fous, choix du format — est commun : deux comportements différents
 * pour la même promesse finiraient par diverger.
 */
const VIDEOS = {
  restaurant: {
    background: 'bg-[#0b1730]',
    // Le bleu nuit se détache seul du fond clair de la page.
    frame: '',
    captionClass: 'text-ink-muted',
    size: '3,1 Mo',
    caption:
      'MagyaPro Restaurant en 30 secondes, sans son : le client commande depuis votre site, le bon s’imprime, la cuisine suit chaque commande avec son temps d’attente ; puis le QR code à table, le comptoir et le téléphone, les livreurs et la fidélité. Écrans reconstitués d’après l’application, sur un restaurant de démonstration.',
  },
  boutique: {
    background: 'bg-[#1c1712]',
    // Même brun que la page : sans filet, la vidéo n'a plus de bord, et sa
    // première légende se lit comme un titre du site. Le filet est celui de
    // toutes les cartes de la page Boutique.
    frame: 'ring-1 ring-white/10',
    // La page Boutique est sombre : l'encre atténuée des pages claires y
    // serait illisible.
    captionClass: 'text-[#f3ece1]/60',
    size: '2,8 Mo',
    caption:
      'MagyaPro Boutique en 30 secondes, sans son : un carton d’eau vendu au prix du carton, une vente encaissée sans réseau puis synchronisée, la rupture annoncée avant ; puis la commande vocale, le crédit client, les dates de péremption et plusieurs boutiques. Écrans reconstitués d’après l’application, sur une boutique de démonstration.',
  },
} as const;

export function PresentationVideo({ product }: { product: keyof typeof VIDEOS }) {
  const video = VIDEOS[product];
  const base = `/videos/magyapro-${product}`;
  const descriptionId = `presentation-video-${product}`;
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reduceMotion || connection?.saveData) return;

    // La propriété, pas seulement l'attribut : React n'écrit pas `muted`
    // dans le HTML rendu côté serveur, et c'est la propriété que le
    // navigateur consulte pour autoriser la lecture automatique.
    video.muted = true;

    let pausingOurselves = false;
    let stoppedByVisitor = false;

    const onPause = () => {
      if (pausingOurselves) {
        pausingOurselves = false;
        return;
      }
      // Une pause que nous n'avons pas demandée vient du visiteur — sauf en
      // fin de lecture, que `loop` rend de toute façon impossible.
      stoppedByVisitor = true;
    };
    video.addEventListener('pause', onPause);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (stoppedByVisitor || !entry) return;
        if (entry.isIntersecting) {
          // Un refus (politique du navigateur, mode économie d'énergie) n'est
          // pas une erreur : la vidéo reste simplement à lancer d'un clic.
          video.play().catch(() => {});
        } else if (!video.paused) {
          pausingOurselves = true;
          video.pause();
        }
      },
      // Un bon tiers visible : assez pour qu'on la voie démarrer, pas au
      // premier pixel qui affleure en bas d'écran.
      { threshold: 0.35 },
    );
    observer.observe(video);

    return () => {
      observer.disconnect();
      video.removeEventListener('pause', onPause);
    };
  }, []);

  return (
    <figure>
      <video
        ref={ref}
        controls
        loop
        muted
        playsInline
        preload="none"
        poster={`${base}-affiche.webp`}
        width={1920}
        height={1080}
        aria-describedby={descriptionId}
        className={`aspect-[9/16] w-full rounded-3xl ${video.background} ${video.frame} object-cover shadow-elev2 md:aspect-video`}
      >
        <source src={`${base}.webm`} type="video/webm" media="(min-width: 768px)" />
        <source src={`${base}.mp4`} type="video/mp4" media="(min-width: 768px)" />
        <source src={`${base}-vertical.webm`} type="video/webm" />
        <source src={`${base}-vertical.mp4`} type="video/mp4" />
        {/* Affiché seulement par un navigateur qui ne lit aucune source. */}
        Votre navigateur ne lit pas cette vidéo.{' '}
        <a href={`${base}.mp4`}>Télécharger la vidéo ({video.size})</a>.
      </video>
      {/* La vidéo est muette et son texte est à l'image : la légende dit ce
          qu'elle montre, pour qui ne la voit pas, et qu'elle est sans son,
          pour que personne ne cherche le volume. */}
      <figcaption
        id={descriptionId}
        className={`mt-4 max-w-[65ch] text-sm leading-relaxed ${video.captionClass}`}
      >
        {video.caption}
      </figcaption>
    </figure>
  );
}
