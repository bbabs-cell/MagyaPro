export type StoredFile = {
  /** Chemin interne, stable, servant de clé au pilote. */
  key: string;
  /** URL publiquement accessible du fichier. */
  url: string;
  contentType: string;
  size: number;
};

/**
 * Contrat que tout pilote de stockage doit honorer.
 *
 * Volontairement minimal : ajouter un pilote S3 ne demande que trois méthodes.
 * Le redimensionnement et la compression sont laissés au pilote, car les
 * services objets modernes les proposent nativement via leur CDN — les
 * réimplémenter côté application coûterait du CPU pour un résultat inférieur.
 */
export interface StorageDriver {
  readonly name: string;
  put(key: string, data: Uint8Array, contentType: string): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  /** URL publique d'une clé, sans accès réseau. */
  url(key: string): string;
}
