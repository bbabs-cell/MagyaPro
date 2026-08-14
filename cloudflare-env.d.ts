// Complète le type `CloudflareEnv` (déclaré par @opennextjs/cloudflare) avec
// nos bindings propres — ceux que `wrangler types` ne connaît pas déjà via
// `Env` (voir worker-configuration.d.ts, régénéré par `npm run cf:typegen`).
export {};

declare global {
  interface CloudflareEnv {
    HYPERDRIVE: Hyperdrive;
  }
}
