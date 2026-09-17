import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Non bundlés par Next : requis tels quels depuis node_modules, pour que
  // l'adaptateur Cloudflare d'OpenNext puisse copier le moteur WASM de
  // Prisma (query_compiler_bg.wasm) dans le bundle Worker final.
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  // Sur Vercel, le traceur de dépendances des fonctions serverless ne suit
  // pas automatiquement le moteur WASM de Prisma (chargé via un chemin de
  // fichier, pas un `require()` classique) : sans cette inclusion explicite,
  // le fichier .wasm manque au déploiement (`ENOENT ... query_compiler_bg.wasm`).
  outputFileTracingIncludes: {
    '/*': ['./node_modules/.prisma/client/**/*'],
  },
  images: {
    // Uploads are served from the storage abstraction; remote drivers are
    // declared through NEXT_PUBLIC_STORAGE_HOST when a CDN is configured.
    remotePatterns: process.env.NEXT_PUBLIC_STORAGE_HOST
      ? [{ protocol: 'https', hostname: process.env.NEXT_PUBLIC_STORAGE_HOST }]
      : [],
  },
  async headers() {
    /*
     * La politique de sécurité du contenu (CSP) **n'est plus ici**.
     *
     * Elle vit dans `src/lib/security/csp.ts` et c'est le middleware qui la
     * pose, parce qu'elle contient désormais un nonce : un jeton tiré au sort
     * pour chaque réponse, qui remplace `unsafe-inline`. Les en-têtes déclarés
     * dans ce fichier sont calculés une fois au démarrage et sont identiques
     * pour toutes les requêtes — un nonce y serait fixe, donc aussi permissif
     * qu'`unsafe-inline`, en moins lisible.
     *
     * Surtout, la laisser ici en plus ne serait pas neutre : deux en-têtes
     * `Content-Security-Policy` ne se remplacent pas, ils s'additionnent en
     * **intersection**. L'ancienne politique, dépourvue du nonce, interdirait
     * exactement les scripts que la nouvelle autorise — c'est-à-dire tous.
     *
     * Les autres en-têtes restent ici, et continuent de couvrir l'ensemble des
     * chemins, y compris ceux que le middleware ne traite pas.
     */
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Complète (sans le remplacer) le réglage HSTS de la zone Cloudflare :
          // l'en-tête applicatif garantit la protection même si ce réglage
          // venait à changer côté Cloudflare.
          //
          // `includeSubDomains` étend la règle à tout le groupe de domaines —
          // le sous-domaine Boutique, et un sous-domaine par restaurant. Sans
          // lui, ces sous-domaines n'étaient pas couverts : c'est précisément
          // là que vivent les sessions des commerçants.
          //
          // Ce n'est pas un réglage anodin, et il n'était pas à prendre seul :
          // un navigateur le **mémorise un an**, et tout sous-domaine créé
          // ensuite sans HTTPS devient inaccessible — sans message utile, et
          // sans qu'on puisse revenir en arrière pour les visiteurs déjà
          // venus. Il est activé sur confirmation explicite que l'ensemble des
          // sous-domaines, actuels et à venir, passe par Vercel — qui sert
          // exclusivement en HTTPS. Vérifié au moment de l'activation :
          // magyapro.com, www et boutique répondent tous en HTTPS.
          //
          // À retenir avant d'ajouter un sous-domaine hors Vercel (messagerie,
          // recette, outil tiers) : il devra être servi en HTTPS dès sa
          // création.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // `self` autorise nos propres pages à *demander* la permission —
          // il ne l'accorde pas : le navigateur affiche toujours sa fenêtre
          // de confirmation, et l'utilisateur reste libre de refuser.
          //
          // La caméra sert au scanner de codes-barres (Caisse et fiche
          // produit), le micro aux commandes vocales de la caisse. Tant que
          // cet en-tête valait `camera=(), microphone=()`, le navigateur
          // refusait les deux sans même poser la question, et les deux
          // fonctionnalités échouaient en silence.
          //
          // Pas de scope par chemin : le middleware réécrit
          // `boutique.magyapro.com/dashboard/...` vers `/boutique/dashboard/...`,
          // alors que les en-têtes sont évalués sur le chemin *entrant*. Une
          // règle par chemin laisserait donc passer une des deux formes
          // d'URL et pas l'autre — un piège silencieux. Aucune page ne
          // sollicite caméra ou micro sans un clic explicite.
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

// Ne s'exécute qu'en `next dev` local (aucun effet au build ni en
// production) : simule les bindings Cloudflare (env, ctx) pour que le code
// lisant `process.env` se comporte comme sur Workers pendant le développement.
initOpenNextCloudflareForDev();
