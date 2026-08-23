'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

/**
 * Documentation interactive de l'API publique (`/api/v1/*`), générée depuis
 * la spécification OpenAPI servie par le backend lui-même
 * (`/api/v1/openapi.json`) — jamais un document séparé qui pourrait dériver
 * des routes réelles.
 */
export function ApiDocs() {
  return <SwaggerUI url="/api/v1/openapi.json" />;
}
