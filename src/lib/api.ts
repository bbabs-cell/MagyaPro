import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { Prisma } from '@prisma/client';

import { AppError, RateLimitError, ValidationError } from '@/lib/errors';

/**
 * Enveloppe unique des réponses d'API.
 *
 * Le client n'a ainsi qu'une seule forme à interpréter, et la construction des
 * réponses d'erreur passe par un point unique — c'est là qu'on garantit
 * qu'aucune trace d'exécution ni message de base de données ne fuit.
 */
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
  };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data }, { status });
}

export function fail(
  message: string,
  status: number,
  code = 'ERROR',
  fieldErrors?: Record<string, string>,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { ok: false as const, error: { code, message, fieldErrors } },
    { status },
  );
}

/** Aplatit les erreurs Zod en `{ champ: message }` exploitable par un formulaire. */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    if (!fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

/** Valide un corps de requête, ou lève une `ValidationError` exploitable. */
export function parseOrThrow<T>(schema: ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      'Certains champs sont invalides.',
      zodFieldErrors(result.error),
    );
  }
  return result.data;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError('Corps de requête JSON invalide.');
  }
}

/**
 * Convertit n'importe quelle exception en réponse HTTP.
 *
 * Les erreurs applicatives portent un message écrit pour l'utilisateur. Tout
 * le reste devient un 500 générique : le détail part dans les logs serveur,
 * jamais dans la réponse, car il contiendrait requêtes SQL, chemins de
 * fichiers et structure interne.
 */
export function toErrorResponse(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof AppError) {
    const response = fail(error.message, error.status, error.code, error.fieldErrors);
    if (error instanceof RateLimitError) {
      response.headers.set('Retry-After', String(error.retryAfterSeconds));
    }
    return response;
  }

  if (error instanceof ZodError) {
    return fail(
      'Certains champs sont invalides.',
      400,
      'VALIDATION_ERROR',
      zodFieldErrors(error),
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 : violation de contrainte d'unicité. Le seul cas où l'on peut
    // formuler un message utile sans révéler le schéma.
    if (error.code === 'P2002') {
      return fail(
        'Cette valeur est déjà utilisée.',
        409,
        'CONFLICT',
      );
    }
    if (error.code === 'P2025') {
      return fail('Ressource introuvable.', 404, 'NOT_FOUND');
    }
  }

  console.error('[api] Erreur non gérée :', error);
  return fail(
    "Une erreur inattendue s'est produite. Réessayez dans un instant.",
    500,
    'INTERNAL_ERROR',
  );
}

/**
 * Enrobe un handler de route : le corps métier n'a plus qu'à lever des
 * erreurs typées, la conversion HTTP est faite ici une fois pour toutes.
 */
export function route<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<NextResponse>,
) {
  return async (request: Request, ...args: Args): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
