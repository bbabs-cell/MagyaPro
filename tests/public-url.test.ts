import { describe, expect, it } from 'vitest';

import {
  LOCALE_PARAM,
  OG_LOCALES,
  languageAlternates,
  localeUrl,
  pathWithinSite,
  publicSiteBase,
} from '@/lib/site/public-url';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/i18n/locales';

/**
 * Adresses publiques d'une vitrine.
 *
 * Ces règles décident de ce qu'un moteur de recherche indexe. Une erreur ici
 * ne casse aucun écran : elle fait disparaître des pages des résultats, ou en
 * fait indexer deux fois la même. C'est invisible pendant des mois.
 */

describe('Base publique de la vitrine', () => {
  it('reste sur la plateforme quand la requête vise /r/<slug>', () => {
    expect(publicSiteBase('magyapro.test', '/r/la-terrasse', 'la-terrasse')).toContain(
      '/r/la-terrasse',
    );
    expect(publicSiteBase('magyapro.test', '/r/la-terrasse/menu', 'la-terrasse')).toContain(
      '/r/la-terrasse',
    );
  });

  it("prend le domaine du restaurant quand la requête arrive par lui", () => {
    // Le middleware réécrit vers /r/<slug>, mais `x-pathname` conserve le
    // chemin demandé : c'est à cela qu'on distingue les deux cas.
    expect(publicSiteBase('la-terrasse.com', '/menu', 'la-terrasse')).toBe(
      'http://la-terrasse.com',
    );
  });

  it('normalise la casse du domaine', () => {
    expect(publicSiteBase('La-Terrasse.COM', '/', 'la-terrasse')).toBe('http://la-terrasse.com');
  });

  it('retombe sur la plateforme si aucun hôte n’est transmis', () => {
    // Mieux vaut une adresse de repli qu'une URL vide dans un `canonical`,
    // qui ferait ignorer la balise entière.
    expect(publicSiteBase('', '/menu', 'la-terrasse')).toContain('/r/la-terrasse');
    expect(publicSiteBase('   ', '/menu', 'la-terrasse')).toContain('/r/la-terrasse');
  });

  it('ne termine jamais par une barre oblique', () => {
    for (const host of ['la-terrasse.com', '', 'magyapro.test']) {
      for (const path of ['/', '/menu', '/r/la-terrasse']) {
        expect(publicSiteBase(host, path, 'la-terrasse').endsWith('/')).toBe(false);
      }
    }
  });
});

describe('Chemin à l’intérieur de la vitrine', () => {
  it('retire le préfixe de prévisualisation', () => {
    expect(pathWithinSite('/r/la-terrasse/menu', 'la-terrasse')).toBe('/menu');
    expect(pathWithinSite('/r/la-terrasse', 'la-terrasse')).toBe('');
  });

  it('laisse intact un chemin déjà nu', () => {
    expect(pathWithinSite('/menu', 'la-terrasse')).toBe('/menu');
  });

  it('réduit la racine à une chaîne vide, pour ne pas produire de double barre', () => {
    expect(pathWithinSite('/', 'la-terrasse')).toBe('');
    expect(pathWithinSite('/r/la-terrasse/', 'la-terrasse')).toBe('');
  });

  it('donne le même résultat par les deux chemins d’accès', () => {
    // C'est la propriété qui compte : la table `hreflang` d'une page doit être
    // identique qu'on y arrive par le domaine du restaurant ou par /r/<slug>.
    expect(pathWithinSite('/r/la-terrasse/plat/thieboudienne', 'la-terrasse')).toBe(
      pathWithinSite('/plat/thieboudienne', 'la-terrasse'),
    );
  });
});

describe('URL par langue', () => {
  const base = 'https://la-terrasse.com';

  it('laisse le français sur l’URL nue', () => {
    // Ajouter `?lang=fr` créerait un doublon de la page d'accueil.
    expect(localeUrl(base, '/menu', 'fr')).toBe('https://la-terrasse.com/menu');
    expect(localeUrl(base, '', 'fr')).toBe('https://la-terrasse.com');
  });

  it('marque les autres langues dans l’URL', () => {
    expect(localeUrl(base, '/menu', 'en')).toBe(`https://la-terrasse.com/menu?${LOCALE_PARAM}=en`);
    expect(localeUrl(base, '/menu', 'ar')).toBe(`https://la-terrasse.com/menu?${LOCALE_PARAM}=ar`);
  });

  it('respecte une chaîne de requête déjà présente', () => {
    expect(localeUrl(base, '/menu?cat=2', 'en')).toBe(
      `https://la-terrasse.com/menu?cat=2&${LOCALE_PARAM}=en`,
    );
  });

  it('produit une URL distincte par langue', () => {
    const urls = LOCALES.map((locale) => localeUrl(base, '/menu', locale));
    expect(new Set(urls).size).toBe(LOCALES.length);
  });
});

describe('Table hreflang', () => {
  const base = 'https://la-terrasse.com';

  it('couvre toutes les langues, plus x-default', () => {
    const alternates = languageAlternates(base, '/menu');
    for (const locale of LOCALES) expect(alternates[locale]).toBeDefined();
    expect(alternates['x-default']).toBeDefined();
    expect(Object.keys(alternates)).toHaveLength(LOCALES.length + 1);
  });

  it('fait pointer x-default sur la langue par défaut', () => {
    const alternates = languageAlternates(base, '/menu');
    expect(alternates['x-default']).toBe(alternates[DEFAULT_LOCALE]);
  });

  it('n’émet que des URL absolues', () => {
    // Un `hreflang` relatif est ignoré par les moteurs.
    for (const href of Object.values(languageAlternates(base, '/menu'))) {
      expect(href.startsWith('https://')).toBe(true);
    }
  });

  it('donne la même table pour les deux chemins d’accès à une page', () => {
    const bySlug = languageAlternates('https://x.test/r/la-terrasse', '/menu');
    expect(Object.keys(bySlug)).toEqual(Object.keys(languageAlternates(base, '/menu')));
  });
});

describe('Étiquettes Open Graph', () => {
  it('couvre chaque langue au format attendu par Open Graph', () => {
    for (const locale of LOCALES) {
      expect(OG_LOCALES[locale]).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    }
  });
});
