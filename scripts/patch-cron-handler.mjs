// Ajoute un handler `scheduled` au worker généré par OpenNext, pour que le
// déclencheur cron Cloudflare (`wrangler.jsonc` → triggers.crons) puisse
// appeler /api/cron/verifier-abonnements chaque jour.
//
// OpenNext ne propose pas d'extension point pour un handler `scheduled`
// (voir defineCloudflareConfig) : ce script patche donc le fichier généré
// après coup, à chaque build. S'il échoue, c'est que le format généré par
// OpenNext a changé — mieux vaut casser le build que déployer un cron
// silencieusement inactif.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workerPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '.open-next',
  'worker.js',
);

const content = readFileSync(workerPath, 'utf8');

const marker = '    },\n};\n';
if (!content.endsWith(marker)) {
  throw new Error(
    `[patch-cron-handler] Fin de fichier inattendue dans ${workerPath} — le format généré par OpenNext a changé, ce patch doit être mis à jour.`,
  );
}

const scheduledHandler = `    },
    async scheduled(_event, env, ctx) {
        ctx.waitUntil(
            fetch(\`https://\${env.CRON_TARGET_HOST || "magyapro.com"}/api/cron/verifier-abonnements\`, {
                method: "POST",
                headers: { "x-cron-secret": env.CRON_SECRET || "" },
            }),
        );
    },
};
`;

const patched = content.slice(0, -marker.length) + scheduledHandler;
writeFileSync(workerPath, patched);

console.log('[patch-cron-handler] Handler scheduled ajouté à .open-next/worker.js');
