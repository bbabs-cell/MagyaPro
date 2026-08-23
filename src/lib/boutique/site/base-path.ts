/**
 * Préfixe de chemin pour les liens internes du site public d'une boutique.
 *
 * Deux façons d'atteindre ce site, avec des URL visibles différentes :
 *   - `boutique.magyapro.com/s/<slug>` — le préfixe `/s/<slug>` fait partie
 *     de l'adresse réelle, il doit rester dans tous les liens ;
 *   - un domaine personnalisé vérifié (`ma-boutique.com`) — réécrit en
 *     interne vers `/s/<hostname>` par le middleware, mais de façon
 *     invisible : l'adresse vue par le client reste `ma-boutique.com/...`,
 *     donc les liens ne doivent PAS porter ce préfixe.
 *
 * Le paramètre `host` (venant de la route `/s/[host]`) permet de distinguer
 * les deux cas sans configuration supplémentaire : un slug ne contient
 * jamais de point, un nom d'hôte complet en contient toujours au moins un.
 */
export function sitePathBase(host: string): string {
  return host.includes('.') ? '' : `/s/${host}`;
}
