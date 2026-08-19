/**
 * Politique de mot de passe.
 *
 * Isolée du module de hachage, qui dépend de `node:crypto` : les formulaires
 * du navigateur ont besoin de la règle, pas de l'implémentation.
 *
 * Volontairement simple : la longueur est le facteur qui compte le plus.
 * Imposer des classes de caractères pousse surtout les utilisateurs vers
 * « Motdepasse1! », qui n'est pas plus solide.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Le mot de passe ne peut pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`;
  }
  if (/^\s+$/.test(password)) {
    return "Le mot de passe ne peut pas être composé uniquement d'espaces.";
  }
  return null;
}
