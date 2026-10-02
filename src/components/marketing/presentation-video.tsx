'use client';

import { useEffect, useRef } from 'react';

/**
 * Vidéo de présentation de MagyaPro Restaurant.
 *
 * Une commande suivie de bout en bout : le client ajoute un plat depuis la
 * vitrine, le bon s'imprime, la cuisine la retrouve à l'écran. Les écrans du
 * film sont des captures de l'application, et la vidéo est rendue en code
 * (`scripts/motion/`), sans aucun service d'IA.
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
 * L'affiche est donc un carré unique de 33 Ko, affiché en `object-cover` :
 * le lecteur en garde une bande horizontale en 16:9, une bande verticale en
 * 9:16. Seul le carré central survit aux deux cadrages, et c'est là qu'est
 * posé le ticket — voir « Affiche » dans `scripts/motion/scene.html`.
 */
export function PresentationVideo() {
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
    <figure className="mt-10">
      <video
        ref={ref}
        controls
        loop
        muted
        playsInline
        preload="none"
        poster="/videos/magyapro-restaurant-affiche.webp"
        width={1920}
        height={1080}
        aria-describedby="presentation-video-description"
        className="aspect-[9/16] w-full rounded-3xl bg-[#0b1730] object-cover shadow-elev2 md:aspect-video"
      >
        <source
          src="/videos/magyapro-restaurant.webm"
          type="video/webm"
          media="(min-width: 768px)"
        />
        <source
          src="/videos/magyapro-restaurant.mp4"
          type="video/mp4"
          media="(min-width: 768px)"
        />
        <source src="/videos/magyapro-restaurant-vertical.webm" type="video/webm" />
        <source src="/videos/magyapro-restaurant-vertical.mp4" type="video/mp4" />
        {/* Affiché seulement par un navigateur qui ne lit aucune source. */}
        Votre navigateur ne lit pas cette vidéo.{' '}
        <a href="/videos/magyapro-restaurant.mp4">Télécharger la vidéo (1,7 Mo)</a>.
      </video>
      {/* La vidéo est muette et son texte est à l'image : la légende dit ce
          qu'elle montre, pour qui ne la voit pas, et qu'elle est sans son,
          pour que personne ne cherche le volume. */}
      <figcaption
        id="presentation-video-description"
        className="mt-4 max-w-[65ch] text-sm leading-relaxed text-ink-muted"
      >
        Une commande suivie de bout en bout, en 26 secondes et sans son : le
        client ajoute un plat depuis le site, le bon s’imprime, la cuisine la
        retrouve à l’écran. Les écrans sont ceux de l’application, sur un
        restaurant de démonstration.
      </figcaption>
    </figure>
  );
}
