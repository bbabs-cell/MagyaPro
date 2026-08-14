import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma, resetDatabase } from './helpers';
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '@/lib/auth/password';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import {
  authenticate,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from '@/lib/auth/service';
import { RATE_LIMITS, hit, resetAll } from '@/lib/rate-limit';

describe('Mots de passe', () => {
  it('produit un hash différent pour un même mot de passe', async () => {
    // Le sel aléatoire empêche de reconnaître deux comptes partageant le même
    // mot de passe à partir de la base.
    const a = await hashPassword('MonMotDePasse!1');
    const b = await hashPassword('MonMotDePasse!1');
    expect(a).not.toBe(b);
  });

  it('ne stocke jamais le mot de passe en clair', async () => {
    const hash = await hashPassword('MonMotDePasse!1');
    expect(hash).not.toContain('MonMotDePasse!1');
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('valide le bon mot de passe et rejette les autres', async () => {
    const hash = await hashPassword('MonMotDePasse!1');
    await expect(verifyPassword('MonMotDePasse!1', hash)).resolves.toBe(true);
    await expect(verifyPassword('MonMotDePasse!2', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('rejette un hash malformé sans lever d\'exception', async () => {
    await expect(verifyPassword('peu importe', 'nimportequoi')).resolves.toBe(false);
    await expect(verifyPassword('peu importe', '')).resolves.toBe(false);
  });

  it('refuse un mot de passe trop court', () => {
    expect(validatePasswordStrength('court')).not.toBeNull();
    expect(validatePasswordStrength('assez-long-pour-passer')).toBeNull();
  });
});

describe('Jetons', () => {
  it('génère des jetons uniques et imprévisibles', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken()));
    expect(tokens.size).toBe(200);
  });

  it('ne permet pas de retrouver le jeton depuis son empreinte', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
    expect(hashToken(token)).toBe(hash);
  });
});

describe('Inscription et connexion', () => {
  beforeAll(async () => {
    await resetDatabase();
    resetAll();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('crée un utilisateur, son restaurant et son adhésion propriétaire', async () => {
    const { user, restaurant } = await registerAccount({
      name: 'Fatou Diallo',
      email: 'fatou@test.magyapro',
      password: 'MotDePasse!2345',
      restaurantName: 'Chez Fatou',
    });

    expect(user.email).toBe('fatou@test.magyapro');
    expect(restaurant.slug).toBe('chez-fatou');
    expect(restaurant.status).toBe('DRAFT');

    const membership = await prisma.restaurantUser.findFirst({
      where: { userId: user.id, restaurantId: restaurant.id },
    });
    expect(membership!.role).toBe('OWNER');

    // Le restaurant est utilisable dès l'inscription : réglages, horaires et
    // sous-domaine sont créés dans la même transaction.
    const settings = await prisma.restaurantSettings.findUnique({
      where: { restaurantId: restaurant.id },
    });
    const hours = await prisma.openingHour.count({
      where: { restaurantId: restaurant.id },
    });
    const domain = await prisma.domain.findFirst({
      where: { restaurantId: restaurant.id },
    });

    expect(settings).not.toBeNull();
    expect(hours).toBe(7);
    expect(domain!.hostname).toBe('chez-fatou');
    expect(domain!.status).toBe('VERIFIED');
  });

  it('refuse une seconde inscription avec le même email', async () => {
    await expect(
      registerAccount({
        name: 'Autre personne',
        email: 'fatou@test.magyapro',
        password: 'MotDePasse!2345',
        restaurantName: 'Autre restaurant',
      }),
    ).rejects.toThrow(/existe déjà/i);
  });

  it('attribue un slug distinct à deux restaurants homonymes', async () => {
    const { restaurant } = await registerAccount({
      name: 'Second propriétaire',
      email: 'second@test.magyapro',
      password: 'MotDePasse!2345',
      restaurantName: 'Chez Fatou',
    });

    expect(restaurant.slug).toBe('chez-fatou-2');
  });

  it('authentifie avec les bons identifiants', async () => {
    const user = await authenticate({
      email: 'fatou@test.magyapro',
      password: 'MotDePasse!2345',
    });
    expect(user.email).toBe('fatou@test.magyapro');
  });

  it('rejette un mauvais mot de passe', async () => {
    await expect(
      authenticate({ email: 'fatou@test.magyapro', password: 'MauvaisMotDePasse' }),
    ).rejects.toThrow(/incorrect/i);
  });

  it('renvoie le même message pour un email inconnu, sans révéler son absence', async () => {
    // Deux messages différents permettraient d'énumérer les comptes existants.
    const unknown = await authenticate({
      email: 'inconnu@test.magyapro',
      password: 'peu importe',
    }).catch((error: Error) => error.message);

    const wrongPassword = await authenticate({
      email: 'fatou@test.magyapro',
      password: 'MauvaisMotDePasse',
    }).catch((error: Error) => error.message);

    expect(unknown).toBe(wrongPassword);
  });

  it('refuse la connexion d\'un compte suspendu', async () => {
    await prisma.user.update({
      where: { email: 'second@test.magyapro' },
      data: { status: 'SUSPENDED' },
    });

    await expect(
      authenticate({ email: 'second@test.magyapro', password: 'MotDePasse!2345' }),
    ).rejects.toThrow(/suspendu/i);
  });
});

describe('Réinitialisation de mot de passe', () => {
  beforeAll(async () => {
    await resetDatabase();
    await registerAccount({
      name: 'Awa Koné',
      email: 'awa@test.magyapro',
      password: 'AncienMotDePasse!1',
      restaurantName: 'Chez Awa',
    });
  });

  it("n'échoue pas — et ne révèle rien — pour une adresse inconnue", async () => {
    await expect(requestPasswordReset('inconnu@test.magyapro')).resolves.toBeUndefined();

    const tokens = await prisma.verificationToken.count({
      where: { type: 'PASSWORD_RESET' },
    });
    expect(tokens).toBe(0);
  });

  it('change le mot de passe et révoque toutes les sessions', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'awa@test.magyapro' } });

    // Session ouverte avant la réinitialisation.
    await prisma.session.create({
      data: {
        userId: user!.id,
        tokenHash: hashToken(generateToken()),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    // Le service ne renvoie pas le jeton en clair (il part par email) : on le
    // génère donc ici comme le ferait `issueVerificationToken`.
    const token = generateToken();
    await prisma.verificationToken.create({
      data: {
        userId: user!.id,
        type: 'PASSWORD_RESET',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await resetPassword({ token, password: 'NouveauMotDePasse!2' });

    await expect(
      authenticate({ email: 'awa@test.magyapro', password: 'NouveauMotDePasse!2' }),
    ).resolves.toBeTruthy();

    await expect(
      authenticate({ email: 'awa@test.magyapro', password: 'AncienMotDePasse!1' }),
    ).rejects.toThrow();

    const sessions = await prisma.session.count({ where: { userId: user!.id } });
    expect(sessions).toBe(0);
  });

  it('refuse de réutiliser un jeton déjà consommé', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'awa@test.magyapro' } });
    const token = generateToken();

    await prisma.verificationToken.create({
      data: {
        userId: user!.id,
        type: 'PASSWORD_RESET',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await resetPassword({ token, password: 'EncoreUnAutre!3' });

    await expect(
      resetPassword({ token, password: 'TentativeDeRejeu!4' }),
    ).rejects.toThrow(/invalide ou a expiré/i);
  });

  it('refuse un jeton expiré', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'awa@test.magyapro' } });
    const token = generateToken();

    await prisma.verificationToken.create({
      data: {
        userId: user!.id,
        type: 'PASSWORD_RESET',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(
      resetPassword({ token, password: 'NouveauMotDePasse!5' }),
    ).rejects.toThrow(/invalide ou a expiré/i);
  });

  it("refuse d'utiliser un jeton de vérification d'email pour changer le mot de passe", async () => {
    const user = await prisma.user.findUnique({ where: { email: 'awa@test.magyapro' } });
    const token = generateToken();

    await prisma.verificationToken.create({
      data: {
        userId: user!.id,
        type: 'EMAIL_VERIFICATION',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await expect(
      resetPassword({ token, password: 'DetournementDeJeton!6' }),
    ).rejects.toThrow(/invalide ou a expiré/i);
  });
});

describe("Vérification d'email", () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it("marque l'adresse comme vérifiée", async () => {
    const { user } = await registerAccount({
      name: 'Marc Kouassi',
      email: 'marc@test.magyapro',
      password: 'MotDePasse!2345',
      restaurantName: 'Chez Marc',
    });

    expect(user.emailVerifiedAt).toBeNull();

    const token = generateToken();
    await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await verifyEmail(token);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.emailVerifiedAt).not.toBeNull();
  });
});

describe('Limitation de débit', () => {
  it('bloque après le nombre de tentatives autorisé', () => {
    resetAll();
    const key = 'test:login';

    for (let attempt = 0; attempt < RATE_LIMITS.login.limit; attempt++) {
      expect(() => hit(key, RATE_LIMITS.login)).not.toThrow();
    }

    expect(() => hit(key, RATE_LIMITS.login)).toThrow(/trop de tentatives/i);
  });

  it('compte séparément deux clés distinctes', () => {
    resetAll();

    for (let attempt = 0; attempt < RATE_LIMITS.login.limit; attempt++) {
      hit('ip:1.2.3.4', RATE_LIMITS.login);
    }

    // Une autre IP ne doit pas être pénalisée par la première.
    expect(() => hit('ip:5.6.7.8', RATE_LIMITS.login)).not.toThrow();
  });
});
