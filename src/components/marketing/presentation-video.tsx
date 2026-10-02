/**
 * Vidéo de présentation de MagyaPro Restaurant.
 *
 * Une commande suivie de bout en bout : le client ajoute un plat depuis la
 * vitrine, le bon s'imprime, la cuisine la retrouve à l'écran. Les écrans du
 * film sont des captures de l'application, et la vidéo est rendue en code
 * (`scripts/motion/`), sans aucun service d'IA.
 *
 * ## Lancée au clic, jamais toute seule
 *
 * `DESIGN.md` n'autorise sur les pages de présentation qu'**un** moment animé
 * qui ne réponde pas à un geste : l'impression du ticket du hero. Une vidéo en
 * lecture automatique en serait un second, et le plus bruyant des deux. Elle
 * démarre donc quand le visiteur le décide.
 *
 * ## Rien n'est téléchargé avant le clic
 *
 * `preload="none"` : au chargement de la page, seule l'affiche part — 43 Ko en
 * WebP. Les 1,2 Mo de vidéo attendent que le visiteur appuie sur lecture. Le
 * produit vise des connexions mobiles irrégulières ; une vidéo préchargée pour
 * quelqu'un qui ne la regardera pas lui coûte de la donnée qu'il paie.
 *
 * ## Le lecteur natif, sans JavaScript
 *
 * Les commandes du navigateur sont accessibles au clavier, lues par les
 * lecteurs d'écran, et connues de tout le monde. Un lecteur sur mesure
 * referait moins bien ce qu'elles font déjà.
 *
 * WebM d'abord, plus léger ; MP4 ensuite, pour les navigateurs qui ne lisent
 * pas le VP9. `width` et `height` réservent la place avant que l'affiche
 * n'arrive : la page ne saute pas.
 */
export function PresentationVideo() {
  return (
    <figure className="mt-10">
      <video
        controls
        preload="none"
        playsInline
        poster="/videos/magyapro-restaurant-affiche.webp"
        width={1920}
        height={1080}
        aria-describedby="presentation-video-description"
        className="aspect-video w-full rounded-3xl bg-[#0b1730] shadow-elev2"
      >
        <source src="/videos/magyapro-restaurant.webm" type="video/webm" />
        <source src="/videos/magyapro-restaurant.mp4" type="video/mp4" />
        {/* Affiché seulement par un navigateur qui ne lit aucun des deux. */}
        Votre navigateur ne lit pas cette vidéo.{' '}
        <a href="/videos/magyapro-restaurant.mp4">Télécharger la vidéo (1,7 Mo)</a>.
      </video>
      {/* La vidéo est muette et son texte est à l'image : la légende dit ce
          qu'elle montre, pour qui ne la lance pas comme pour qui ne la voit
          pas. Et elle le dit — sans son — pour que personne ne cherche à
          monter le volume. */}
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
