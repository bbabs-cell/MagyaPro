'use client';

import type { ApiResponse } from '@/lib/api';

/**
 * Client HTTP du navigateur.
 *
 * Il traduit l'enveloppe `{ ok, data | error }` en valeur ou en exception, de
 * sorte que les composants écrivent `try/catch` plutôt que d'inspecter des
 * codes de statut.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    // Panne réseau : distinguée d'une erreur serveur, car l'action à mener
    // n'est pas la même pour l'utilisateur.
    throw new ApiError(
      'Connexion impossible. Vérifiez votre connexion internet et réessayez.',
      0,
      'NETWORK_ERROR',
    );
  }

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      "Réponse inattendue du serveur. Réessayez dans un instant.",
      response.status,
      'BAD_RESPONSE',
    );
  }

  if (!payload.ok) {
    throw new ApiError(
      payload.error.message,
      response.status,
      payload.error.code,
      payload.error.fieldErrors,
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body ?? {}),
  delete: <T>(url: string) => request<T>('DELETE', url),
};

/** Téléversement multipart — `fetch` doit fixer lui-même le Content-Type. */
export async function uploadFile<T>(url: string, formData: FormData): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiError(
      payload.error.message,
      response.status,
      payload.error.code,
      payload.error.fieldErrors,
    );
  }
  return payload.data;
}
