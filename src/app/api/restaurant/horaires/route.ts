import { ok, parseOrThrow, readJson, route } from '@/lib/api';
import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { openingHoursSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/errors';

export const GET = route(async () => {
  const { restaurant } = await requireTenant('restaurant:view');
  const hours = await prisma.openingHour.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { dayOfWeek: 'asc' },
  });
  return ok({ hours });
});

export const PUT = route(async (request) => {
  const context = await requireTenant('restaurant:update');
  const { hours } = parseOrThrow(openingHoursSchema, await readJson(request));

  const days = new Set(hours.map((hour) => hour.dayOfWeek));
  if (days.size !== 7) {
    throw new ValidationError('Chaque jour de la semaine doit apparaître une seule fois.');
  }

  for (const hour of hours) {
    // Une plage qui se termine avant de commencer serait acceptée par le
    // format « HH:MM » mais n'a aucun sens pour un service.
    if (!hour.isClosed && hour.closesAt <= hour.opensAt) {
      throw new ValidationError(
        "L'heure de fermeture doit être postérieure à l'heure d'ouverture.",
      );
    }
  }

  await prisma.$transaction(
    hours.map((hour) =>
      prisma.openingHour.upsert({
        where: {
          restaurantId_dayOfWeek: {
            restaurantId: context.restaurant.id,
            dayOfWeek: hour.dayOfWeek,
          },
        },
        create: { ...hour, restaurantId: context.restaurant.id },
        update: {
          isClosed: hour.isClosed,
          opensAt: hour.opensAt,
          closesAt: hour.closesAt,
        },
      }),
    ),
  );

  return ok({ hours });
});
