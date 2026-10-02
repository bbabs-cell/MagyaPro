/**
 * Exemple minimal de l'API Higgsfield — Seedance 2.5, texte vers vidéo.
 *
 * Point d'entrée de référence pour la production publicitaire décrite dans
 * `docs/PUBLICITE.md`. Il fait une seule chose : lancer une génération, en
 * attendre la fin, et afficher l'adresse de la vidéo produite.
 *
 * ## Ce fichier ne fait pas partie du produit
 *
 * `@higgsfield/client` est une dépendance de **développement**, et ce script
 * vit dans `scripts/`, hors de `src/`. C'est délibéré : la contrainte
 * fondatrice du produit est qu'aucune intelligence artificielle payante
 * n'entre dans ce qu'utilise un commerçant — pas d'abonnement à un tiers, pas
 * de facturation à la requête, donc aucun coût qui augmente avec l'usage.
 *
 * Fabriquer une publicité est un travail de studio, pas une fonctionnalité.
 * La séparation doit rester lisible : rien sous `src/` n'importe ce paquet, et
 * un `npm ci --omit=dev` en production ne l'installe même pas.
 *
 * ## Emploi
 *
 *   npm run higgsfield:exemple
 *
 * Les identifiants sont lus dans `.env.local` (ignoré par Git) sous
 * `HF_CREDENTIALS`, au format `identifiant:secret`. Ils ne sont jamais
 * affichés, ni journalisés, ni passés en argument de ligne de commande — un
 * argument est visible de tout le système par `ps`.
 *
 * ## Attention : chaque exécution est facturée
 *
 * Une exécution réussie consomme des crédits Higgsfield. Ce n'est pas un
 * script à relancer pour voir.
 */
import { config, higgsfield } from '@higgsfield/client/v2';

/**
 * Le motif d'échec rendu par le service.
 *
 * Le type `V2Response` du client n'expose pas de champ d'erreur, mais la
 * réponse en porte un — et il est la seule chose utile quand un plan échoue :
 * « Your credit balance is too low to complete this request » ne se devine
 * pas depuis un identifiant de requête.
 *
 * Il a fallu interroger l'API à la main pour l'obtenir la première fois. Le
 * lire ici évite ce détour à chaque panne suivante. L'accès est défensif :
 * le champ n'est pas typé, il peut disparaître, et son absence ne doit pas
 * masquer l'échec lui-même.
 */
function failureReason(result: unknown): string {
  const reason = (result as { error?: unknown }).error;
  return typeof reason === 'string' && reason.trim().length > 0
    ? ` Motif rendu par le service : ${reason}`
    : ' Le service n’a donné aucun motif.';
}

/**
 * Attente longue, assumée.
 *
 * Le client plafonne le sondage à cinq minutes par défaut. Mesuré : une
 * génération vidéo dépasse régulièrement ce seuil, et l'attente expire alors
 * sur une requête **acceptée et en cours** — donc facturée, mais dont le
 * résultat est perdu faute d'avoir conservé son identifiant. C'est le pire
 * des deux mondes.
 *
 * Vingt minutes, avec un sondage toutes les dix secondes : assez long pour un
 * plan de trente secondes en 1080p, assez court pour qu'une panne du service
 * ne bloque pas la série indéfiniment.
 */
const POLL = { maxPollTime: 20 * 60 * 1000, pollInterval: 10_000 };

/** Le modèle, tel que le nomme la référence d'API. */
const MODEL = 'bytedance/seedance-2.5/text-to-video';

/**
 * Validation des identifiants **sans jamais les exposer**.
 *
 * On vérifie la forme — deux parties séparées par deux-points, aucune vide —
 * et on ne rend que l'indication de validité. Un message d'erreur qui citerait
 * la valeur reçue, même tronquée, finirait dans un journal de terminal ou une
 * sortie d'intégration continue.
 */
function readCredentials(): string {
  const credentials = process.env.HF_CREDENTIALS;

  if (!credentials) {
    throw new Error(
      'HF_CREDENTIALS absent. Ajoutez-le à .env.local au format ' +
        '« identifiant:secret » (ce fichier est ignoré par Git), ou ' +
        'déclarez-le comme secret d’environnement.',
    );
  }

  const parts = credentials.split(':');
  if (parts.length !== 2 || parts.some((part) => part.trim().length === 0)) {
    throw new Error(
      'HF_CREDENTIALS est mal formé : deux parties non vides séparées par ' +
        'un deux-points sont attendues. La valeur reçue n’est volontairement ' +
        'pas affichée.',
    );
  }

  return credentials;
}

async function main(): Promise<void> {
  config({ credentials: readCredentials(), ...POLL });

  console.log(`Génération en cours — ${MODEL}`);
  console.log('Chaque exécution réussie consomme des crédits.\n');

  const result = await higgsfield.subscribe(MODEL, {
    input: {
      prompt: 'A cinematic scene at sunset',
      duration: 5,
      resolution: '720p',
      aspect_ratio: '16:9',
      output_format: 'mp4',
      generate_audio: true,
    },
    withPolling: true,
  });

  /**
   * Une requête terminée n'est pas une requête réussie.
   *
   * Le client déclare cinq statuts — `queued`, `in_progress`, `completed`,
   * `failed`, `nsfw` — et expose par ailleurs une adresse d'annulation, donc
   * un statut d'annulation peut apparaître sans figurer dans ce type. Chaque
   * cas est donc traité nommément, et tout statut inconnu est un échec : la
   * seule issue qui vaut succès est un `completed` **portant réellement une
   * adresse de vidéo**.
   */
  switch (result.status) {
    case 'completed': {
      const url = result.video?.url;
      if (!url) {
        // Un `completed` sans fichier est une anomalie, pas un succès. La
        // signaler vaut mieux que d'afficher « undefined » comme résultat.
        throw new Error(
          `Requête ${result.request_id} déclarée terminée, mais aucune vidéo ` +
            'n’est jointe. Rien n’a été produit.',
        );
      }
      console.log('Vidéo générée :');
      console.log(url);
      return;
    }

    case 'failed':
      throw new Error(
        `La génération a échoué (requête ${result.request_id}).${failureReason(result)}`,
      );

    case 'nsfw':
      throw new Error(
        `La génération a été refusée par la modération (requête ${result.request_id}).` +
          `${failureReason(result)} Reformulez l’invite.`,
      );

    case 'queued':
    case 'in_progress':
      throw new Error(
        `L’attente s’est terminée alors que la requête ${result.request_id} est ` +
          `toujours « ${result.status} ». Son état peut être suivi sur ` +
          `${result.status_url}. Aucune vidéo n’a été produite.`,
      );

    default: {
      // Couvre notamment une annulation, et tout statut ajouté au service
      // après l'écriture de ce script.
      const status: string = result.status;
      throw new Error(
        `Statut inattendu « ${status} » pour la requête ${result.request_id}. ` +
          'Traité comme un échec.',
      );
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
