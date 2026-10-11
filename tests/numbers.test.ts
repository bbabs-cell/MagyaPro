import { describe, expect, it } from 'vitest';

import { formatDecimal, formatPercent } from '@/lib/numbers';
import { slugify } from '@/lib/slug';

const NBSP = ' ';

/**
 * Les pourcentages et les notes s'affichaient à l'anglaise — « +172.3 % »,
 * « 4.5/5 » — parce qu'ils étaient interpolés tels quels ou passés par
 * `toFixed()`. Ces tests fixent l'écriture française.
 */
describe('Nombres affichés', () => {
  it('écrit une décimale avec une virgule en français', () => {
    expect(formatDecimal(4.5)).toBe('4,5');
  });

  it('garde le point en anglais, et les chiffres latins en arabe', () => {
    expect(formatDecimal(4.5, 1, 'en')).toBe('4.5');
    expect(formatDecimal(4.5, 1, 'ar')).toMatch(/^4.5$/);
  });

  it('signe une variation positive et colle « % » par une espace insécable', () => {
    expect(formatPercent(172.3, { signed: true })).toBe(`+172,3${NBSP}%`);
    expect(formatPercent(-12.5, { signed: true })).toBe(`-12,5${NBSP}%`);
  });

  it('ne signe ni zéro ni une valeur non signée, et omet une décimale nulle', () => {
    expect(formatPercent(0, { signed: true })).toBe(`0${NBSP}%`);
    expect(formatPercent(25)).toBe(`25${NBSP}%`);
  });
});

describe('Identifiants d’URL', () => {
  it('ne perd plus les ligatures', () => {
    // « Œufs » donnait « ufs ».
    expect(slugify('Œufs frais')).toBe('oeufs-frais');
    expect(slugify('Cæsar')).toBe('caesar');
  });
});
