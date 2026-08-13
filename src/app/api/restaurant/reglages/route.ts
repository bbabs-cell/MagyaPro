import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { restaurantSettingsSchema, restaurantSeoSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/errors';
import { getProvider } from '@/lib/payments/registry';

export const PATCH = route(async (request) => {
  const context = await requireTenant('settings:manage');
  const input = parseOrThrow(restaurantSettingsSchema, await readJson(request));

  // On n'enregistre que des fournisseurs qui existent et sont réellement
  // configurés : activer un moyen de paiement inopérant reviendrait à
  // promettre au client un règlement qui échouerait au moment de payer.
  for (const providerId of input.paymentProviders) {
    const provider = getProvider(providerId);
    if (!provider) {
      throw new ValidationError(`Moyen de paiement inconnu : ${providerId}.`);
    }
    if (!provider.isAvailable()) {
      throw new ValidationError(
        `${provider.label} n'est pas encore disponible sur cette instance.`,
      );
    }
  }

  if (input.paymentProviders.length === 0) {
    throw new ValidationError(
      'Activez au moins un moyen de paiement pour pouvoir recevoir des commandes.',
      { paymentProviders: 'Au moins un moyen de paiement est requis.' },
    );
  }

  if (!input.deliveryEnabled && !input.pickupEnabled) {
    throw new ValidationError(
      'Activez la livraison ou le retrait sur place : sans les deux, aucune commande ne peut aboutir.',
    );
  }

  const settings = await prisma.restaurantSettings.upsert({
    where: { restaurantId: context.restaurant.id },
    create: {
      restaurantId: context.restaurant.id,
      orderingEnabled: input.orderingEnabled,
      deliveryEnabled: input.deliveryEnabled,
      pickupEnabled: input.pickupEnabled,
      tableOrderingEnabled: input.tableOrderingEnabled,
      minOrderAmount: input.minOrderAmount,
      prepTimeMinutes: input.prepTimeMinutes,
      paymentProviders: input.paymentProviders,
      notificationEmail: input.notificationEmail ?? null,
    },
    update: {
      orderingEnabled: input.orderingEnabled,
      deliveryEnabled: input.deliveryEnabled,
      pickupEnabled: input.pickupEnabled,
      tableOrderingEnabled: input.tableOrderingEnabled,
      minOrderAmount: input.minOrderAmount,
      prepTimeMinutes: input.prepTimeMinutes,
      paymentProviders: input.paymentProviders,
      notificationEmail: input.notificationEmail ?? null,
    },
  });

  return ok({ settings });
});

/** Métadonnées de référencement du site public. */
export const PUT = route(async (request) => {
  const context = await requireTenant('settings:manage');
  const input = parseOrThrow(restaurantSeoSchema, await readJson(request));

  const restaurant = await prisma.restaurant.update({
    where: { id: context.restaurant.id },
    data: {
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      seoImageUrl: input.seoImageUrl ?? null,
    },
  });

  return ok({ restaurant });
});
