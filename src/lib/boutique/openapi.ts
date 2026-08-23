import { rootHostname } from '@/lib/env';

/**
 * Spécification OpenAPI 3.0 de l'API publique Boutique (`/api/v1/*`) —
 * tenue à jour à la main, à côté des routes qu'elle décrit. Générée plutôt
 * qu'écrite en JSON statique pour rester dans le même langage que le reste
 * du projet, mais le contenu ne change que si une route change.
 */
export function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'API MagyaPro Boutique',
      version: '1.0.0',
      description:
        "API publique en lecture seule pour intégrer votre boutique à un service externe (comptabilité, synchronisation de catalogue...). Authentifiée par clé d'API, générée depuis Réglages.",
    },
    servers: [{ url: `https://${rootHostname()}/api/v1` }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: "Clé d'API créée depuis Réglages, envoyée en en-tête Authorization.",
        },
      },
      schemas: {
        Boutique: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            currency: { type: 'string', example: 'XOF' },
            status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'SUSPENDED'] },
          },
        },
        VarianteProduit: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sku: { type: 'string', nullable: true },
            barcode: { type: 'string', nullable: true },
            price: { type: 'integer', description: 'Prix en unité mineure de la devise.' },
            stock: { type: 'number' },
          },
        },
        Produit: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string', nullable: true },
            unit: { type: 'string', enum: ['UNIT', 'KG', 'G', 'L', 'ML'] },
            variants: { type: 'array', items: { $ref: '#/components/schemas/VarianteProduit' } },
          },
        },
        LigneVente: {
          type: 'object',
          properties: {
            productName: { type: 'string' },
            quantity: { type: 'number' },
            unitPrice: { type: 'integer' },
            total: { type: 'integer' },
          },
        },
        Paiement: {
          type: 'object',
          properties: {
            method: { type: 'string', example: 'cash' },
            amount: { type: 'integer' },
          },
        },
        Vente: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            number: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            status: {
              type: 'string',
              enum: ['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED'],
            },
            subtotal: { type: 'integer' },
            discount: { type: 'integer' },
            taxAmount: { type: 'integer' },
            total: { type: 'integer' },
            items: { type: 'array', items: { $ref: '#/components/schemas/LigneVente' } },
            payments: { type: 'array', items: { $ref: '#/components/schemas/Paiement' } },
          },
        },
      },
    },
    paths: {
      '/boutique': {
        get: {
          summary: 'Informations de la boutique',
          responses: {
            '200': {
              description: 'Boutique authentifiée par la clé.',
              content: {
                'application/json': {
                  schema: wrapOk({ $ref: '#/components/schemas/Boutique' }),
                },
              },
            },
            '401': unauthorizedResponse,
          },
        },
      },
      '/produits': {
        get: {
          summary: 'Catalogue',
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', default: 1 },
              description: '100 produits par page.',
            },
          ],
          responses: {
            '200': {
              description: 'Page de produits actifs.',
              content: {
                'application/json': {
                  schema: wrapOk({
                    type: 'object',
                    properties: {
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                      total: { type: 'integer' },
                      products: { type: 'array', items: { $ref: '#/components/schemas/Produit' } },
                    },
                  }),
                },
              },
            },
            '401': unauthorizedResponse,
          },
        },
      },
      '/ventes': {
        get: {
          summary: 'Historique des ventes',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'du', in: 'query', schema: { type: 'string', format: 'date' }, description: 'AAAA-MM-JJ' },
            { name: 'au', in: 'query', schema: { type: 'string', format: 'date' }, description: 'AAAA-MM-JJ' },
          ],
          responses: {
            '200': {
              description: 'Page de ventes, plus récentes en premier.',
              content: {
                'application/json': {
                  schema: wrapOk({
                    type: 'object',
                    properties: {
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                      total: { type: 'integer' },
                      sales: { type: 'array', items: { $ref: '#/components/schemas/Vente' } },
                    },
                  }),
                },
              },
            },
            '401': unauthorizedResponse,
          },
        },
      },
    },
  };
}

/** Toute réponse passe par l'enveloppe unique `{ ok, data }` — voir `src/lib/api.ts`. */
function wrapOk(dataSchema: Record<string, unknown>) {
  return {
    type: 'object',
    properties: {
      ok: { type: 'boolean', enum: [true] },
      data: dataSchema,
    },
  };
}

const unauthorizedResponse = {
  description: "Clé d'API manquante, invalide ou révoquée.",
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', enum: [false] },
          error: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
    },
  },
};
