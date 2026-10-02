/**
 * Production de la publicité « Le papier perdu ».
 *
 * Exécute la séquence décrite dans `docs/PUBLICITE.md` : un portrait de
 * référence, puis chaque plan parlé animé à partir de ce portrait. Les
 * inserts d'écran ne sont pas générés — ce sont les captures réelles du
 * produit (`scripts/capture-pub.mjs`), incrustées au montage. Une interface
 * inventée par un modèle ressemblerait au produit sans en être un, et chaque
 * détail faux se verrait.
 *
 * ## Reprenable, et ce n'est pas un confort
 *
 * Chaque plan coûte des crédits, et un solde peut s'épuiser au milieu d'une
 * série. Le manifeste (`MANIFEST`) est donc écrit après **chaque** plan
 * réussi, et une exécution suivante saute ce qui est déjà produit. Perdre six
 * plans payés parce que le septième a échoué serait la dépense la plus
 * stupide possible.
 *
 * C'est aussi pour cela que le portrait de référence est conservé : il fixe le
 * visage, et le régénérer donnerait un autre visage, donc une publicité où le
 * restaurateur change de tête d'un plan à l'autre.
 *
 * ## Emploi
 *
 *   npm run higgsfield:publicite -- --devis     # n'appelle rien, chiffre
 *   npm run higgsfield:publicite -- --plans 1,2 # seulement ces plans
 *   npm run higgsfield:publicite                # toute la série
 *
 * ## Attention : chaque exécution est facturée
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { config, higgsfield, type V2Response } from '@higgsfield/client/v2';

/** Même hôte que celui du client ; voir la référence d'API. */
const API_BASE = 'https://api.higgsfield.ai';

const SOUL = 'higgsfield-ai/soul/v2/standard';
const SEEDANCE = 'bytedance/seedance-2.5/image-to-video';

const OUT_DIR = process.env.OUT_DIR ?? 'publicite';
const MANIFEST = `${OUT_DIR}/manifeste.json`;

/** Format vertical : la publicité est destinée aux réseaux. */
const ASPECT_RATIO = '9:16';
const RESOLUTION = '1080p';

/**
 * Le portrait de référence.
 *
 * Généré une seule fois, puis réemployé comme image de départ de tous les
 * plans : c'est lui, et lui seul, qui tient la continuité du visage.
 *
 * Les interdits du décor sont dans l'invite plutôt que dans un prompt négatif
 * séparé, que ce modèle n'expose pas. Ils ne sont pas décoratifs : le marché
 * est la zone franc CFA entière, et un drapeau ou un nom de ville y
 * désignerait un pays en excluant les sept autres.
 */
const PORTRAIT_PROMPT = [
  'Portrait photographique réaliste d’un restaurateur ouest-africain',
  'd’environ quarante-cinq ans, debout dans la salle de son restaurant en fin',
  'de service. Chemise de travail propre à manches retroussées, tablier sombre',
  'noué à la taille. Expression posée, fatiguée mais sûre d’elle. Lumière',
  'chaude de fin de journée venant d’une fenêtre hors champ à gauche.',
  'Arrière-plan : tables en bois, chaises, un comptoir flou.',
  'Aucun drapeau, aucune enseigne lisible, aucun logo de marque, aucun texte.',
  'Rendu documentaire et non publicitaire : grain léger, profondeur de champ',
  'naturelle, peau non retouchée.',
].join(' ');

interface Shot {
  /** Numéro de plan, tel que le tableau du §4 du dossier. */
  id: number;
  /** Durée en secondes. */
  duration: number;
  /** Mouvement, cadre et jeu — plus la réplique, que le modèle fait dire. */
  prompt: string;
}

/**
 * Les huit plans filmés.
 *
 * Le plan 9 du dossier est un carton, monté hors Higgsfield : il n'a rien à
 * faire ici. Les répliques sont citées entre guillemets dans l'invite, ce qui
 * est la façon dont ce modèle comprend qu'elles doivent être prononcées.
 */
const SHOTS: Shot[] = [
  {
    id: 1,
    duration: 4,
    prompt:
      'Gros plan sur ses mains refermant un carnet de commandes écorné posé ' +
      'sur une table en bois. La caméra reste fixe. Il ne parle pas. ' +
      'Lumière chaude de fin de service.',
  },
  {
    id: 2,
    duration: 6,
    prompt:
      'Il relève la tête vers la caméra et dit, posément, en français : ' +
      '« Hier soir, j’ai perdu deux commandes. » Plan taille, caméra fixe, ' +
      'léger mouvement naturel des épaules.',
  },
  {
    id: 3,
    duration: 6,
    prompt:
      'Il repose le carnet sur la table et poursuit en français : ' +
      '« Pas parce qu’on cuisine mal. Parce que le papier s’est perdu entre ' +
      'la salle et la cuisine. » Plan taille, caméra fixe.',
  },
  {
    id: 4,
    duration: 4,
    prompt:
      'Il sort un téléphone de la poche de son tablier et le tient devant lui, ' +
      'écran face à la caméra mais hors de la mise au point. Il dit en ' +
      'français : « Maintenant la commande arrive là. »',
  },
  {
    id: 5,
    duration: 5,
    prompt:
      'Plan rapproché sur son visage et son pouce qui balaie l’écran du ' +
      'téléphone. Il dit en français : « Le bon part en cuisine tout seul. ' +
      'Personne ne recopie rien. »',
  },
  {
    id: 6,
    duration: 6,
    prompt:
      'Il regarde son téléphone puis la caméra et dit en français : ' +
      '« Le poisson est fini ? Je le marque épuisé. » Léger sourire en coin.',
  },
  {
    id: 7,
    duration: 6,
    prompt:
      'Plan taille, il range le téléphone et dit en français : ' +
      '« Il disparaît du site tout de suite. Je ne prends plus de commande ' +
      'que je ne peux pas servir. »',
  },
  {
    id: 8,
    duration: 6,
    prompt:
      'Il est derrière son comptoir, un client de dos au premier plan, flou. ' +
      'Il dit en français : « Et quand on m’appelle, ou qu’on vient commander ' +
      'ici, je la saisis moi-même. Elle compte comme les autres. »',
  },
];

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
 * génération vidéo dépasse régulièrement ce seuil. Vingt minutes, sondées
 * toutes les dix secondes : assez long pour un plan de trente secondes en
 * 1080p, assez court pour qu'une panne du service ne bloque pas la série.
 */
const MAX_WAIT_MS = 20 * 60 * 1000;
const POLL_INTERVAL_MS = 10_000;

/** Statuts après lesquels plus rien ne change. */
const TERMINAL = new Set(['completed', 'failed', 'nsfw']);

/**
 * État d'une requête, lu directement.
 *
 * Le client n'expose pas de lecture d'état isolée du sondage, et sa réponse
 * typée omet le champ `error` que l'API renvoie pourtant. On interroge donc
 * le point d'accès nous-mêmes : c'est quelques lignes, et cela rend les deux
 * choses qui manquaient — le motif d'un échec, et la main sur l'attente.
 */
async function status(requestId: string): Promise<V2Response> {
  const response = await fetch(`${API_BASE}/requests/${requestId}/status`, {
    headers: { Authorization: `Key ${process.env.HF_CREDENTIALS ?? ''}` },
  });
  if (!response.ok) {
    throw new Error(
      `Lecture d’état impossible pour ${requestId} : HTTP ${response.status}.`,
    );
  }
  return (await response.json()) as V2Response;
}

interface Manifest {
  portrait?: string;
  shots: Record<string, string>;
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST)) return { shots: {} };
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
}

function writeManifest(manifest: Manifest): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

function readCredentials(): string {
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials) {
    throw new Error(
      'HF_CREDENTIALS absent. Renseignez-le dans .env.local au format ' +
        '« identifiant:secret », ou déclarez-le comme secret d’environnement. ' +
        'La valeur n’est jamais affichée.',
    );
  }
  const parts = credentials.split(':');
  if (parts.length !== 2 || parts.some((part) => part.trim().length === 0)) {
    throw new Error(
      'HF_CREDENTIALS est mal formé : deux parties non vides séparées par un ' +
        'deux-points sont attendues. La valeur reçue n’est pas affichée.',
    );
  }
  return credentials;
}

/**
 * Un appel, et le refus de confondre « terminé » avec « réussi ».
 *
 * Les cinq statuts déclarés par le client sont traités nommément, tout statut
 * inconnu — une annulation, par exemple, que le type n'énumère pas bien que
 * le service expose une adresse d'annulation — est un échec, et une réponse
 * « completed » sans fichier joint en est un aussi.
 */
async function run(
  endpoint: string,
  input: Record<string, unknown>,
  label: string,
): Promise<{ url: string }> {
  /**
   * Lancer d'abord, attendre ensuite — et jamais l'inverse.
   *
   * `withPolling: true` enchaîne les deux et ne rend rien tant que ce n'est
   * pas fini : si l'attente expire, le client lève une erreur qui ne porte
   * **pas** l'identifiant de la requête. Or cette requête-là est acceptée, en
   * cours, et facturée. Elle se termine quelques minutes plus tard, et son
   * résultat est irrécupérable faute de savoir comment le demander. C'est
   * arrivé une fois ; une fois suffit.
   *
   * En deux temps, l'identifiant est connu avant la moindre attente, et il
   * est affiché aussitôt : même si tout s'arrête ensuite, le plan payé reste
   * récupérable à la main.
   */
  const started = await higgsfield.subscribe(endpoint, { input, withPolling: false });
  const id = started.request_id;
  console.log(`  requête ${id}`);

  const deadline = Date.now() + MAX_WAIT_MS;
  let result = started;

  while (!TERMINAL.has(result.status)) {
    if (Date.now() > deadline) {
      throw new Error(
        `${label} : toujours « ${result.status} » après ${MAX_WAIT_MS / 60_000} minutes. ` +
          `La requête ${id} se termine peut-être encore — son résultat reste ` +
          `consultable sur ${result.status_url}.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    result = await status(id);
  }

  switch (result.status) {
    case 'completed': {
      const url = result.video?.url ?? result.images?.[0]?.url;
      if (!url) {
        throw new Error(
          `${label} : requête ${id} déclarée terminée sans aucun fichier joint. ` +
            'Rien n’a été produit.',
        );
      }
      return { url };
    }
    case 'failed':
      throw new Error(`${label} : échec (requête ${id}).${failureReason(result)}`);
    case 'nsfw':
      throw new Error(
        `${label} : refusé par la modération (requête ${id}).` +
          `${failureReason(result)} Reformulez l’invite de ce plan.`,
      );
    default: {
      const unexpected: string = result.status;
      throw new Error(
        `${label} : statut inattendu « ${unexpected} » (requête ${id}). ` +
          'Traité comme un échec.',
      );
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--devis');

  const only = (() => {
    const index = args.indexOf('--plans');
    if (index === -1) return null;
    const list = args[index + 1];
    if (!list) throw new Error('--plans attend une liste, par exemple « --plans 1,2 ».');
    return new Set(list.split(',').map((value) => Number(value.trim())));
  })();

  const planned = SHOTS.filter((shot) => !only || only.has(shot.id));
  const manifest = readManifest();

  if (dryRun) {
    const todo = planned.filter((shot) => !manifest.shots[shot.id]);
    const seconds = todo.reduce((sum, shot) => sum + shot.duration, 0);
    console.log(`Portrait de référence : ${manifest.portrait ? 'déjà produit' : 'à produire'}`);
    console.log(`Plans à produire      : ${todo.length} sur ${planned.length}`);
    console.log(`Secondes de vidéo     : ${seconds}`);
    console.log(`Résolution            : ${RESOLUTION}, ${ASPECT_RATIO}`);
    console.log(
      '\nAucun appel n’a été fait. Le coût en crédits n’est pas publié par le ' +
        'service : relevez-le sur la console du compte portant la clé d’API ' +
        'après un premier plan.',
    );
    return;
  }

  config({ credentials: readCredentials() });

  // --- Le portrait, une seule fois pour toute la publicité.
  if (!manifest.portrait) {
    console.log('Portrait de référence…');
    const portrait = await run(
      SOUL,
      {
        prompt: PORTRAIT_PROMPT,
        batch_size: 1,
        resolution: '1080p',
        aspect_ratio: ASPECT_RATIO,
        enhance_prompt: true,
      },
      'portrait',
    );
    manifest.portrait = portrait.url;
    writeManifest(manifest);
    console.log(`  ✓ ${portrait.url}`);
  } else {
    console.log(`Portrait de référence : réemployé (${manifest.portrait})`);
  }

  // --- Les plans, un par un, le manifeste écrit après chacun.
  for (const shot of planned) {
    if (manifest.shots[shot.id]) {
      console.log(`Plan ${shot.id} : déjà produit, ignoré.`);
      continue;
    }

    console.log(`Plan ${shot.id} (${shot.duration} s)…`);
    const clip = await run(
      SEEDANCE,
      {
        image_url: manifest.portrait,
        prompt: shot.prompt,
        duration: shot.duration,
        resolution: RESOLUTION,
        output_format: 'mp4',
        generate_audio: true,
      },
      `plan ${shot.id}`,
    );

    manifest.shots[shot.id] = clip.url;
    writeManifest(manifest);
    console.log(`  ✓ ${clip.url}`);
  }

  console.log(`\nManifeste : ${MANIFEST}`);
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  console.error(
    'Les plans déjà produits sont conservés dans le manifeste : relancer la ' +
      'commande reprend là où elle s’est arrêtée.',
  );
  process.exitCode = 1;
});
