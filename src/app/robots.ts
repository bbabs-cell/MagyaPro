import type { MetadataRoute } from 'next';

import { env } from '@/lib/env';

/**
 * robots.txt du domaine principal.
 *
 * Les espaces authentifiés et les routes d'API n'ont rien à faire dans un
 * index de recherche. Les sites des restaurants ont leur propre robots.txt,
 * servi sur leur domaine.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard',
        '/admin',
        '/bienvenue',
        '/connexion',
        '/inscription',
        '/mot-de-passe-oublie',
        '/reinitialiser-mot-de-passe',
        '/verifier-email',
        // Les aperçus de sites sous /r/ dupliqueraient le contenu servi sur
        // les domaines propres des restaurants.
        '/r/',
        '/boutique/dashboard',
        '/boutique/connexion',
        '/boutique/inscription',
        '/boutique/bienvenue',
        // Le site public d'une boutique a son propre robots.txt, servi sur son
        // propre domaine/chemin — même logique que /r/ pour Restaurant.
        '/s/',
      ],
    },
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
