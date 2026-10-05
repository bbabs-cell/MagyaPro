/**
 * Squelette d'une page de tableau de bord, affiché par `loading.tsx` dès le
 * clic, pendant que le serveur prépare la page.
 *
 * Il reprend la silhouette d'une vraie page — titre, rangée de chiffres,
 * lignes — pour que l'arrivée du contenu ne fasse pas sauter la mise en
 * page, et il scintille (skill « animations vivantes ») : un rectangle
 * immobile se lit comme une panne, un reflet qui passe dit « ça arrive ».
 *
 * `role="status"` annonce le chargement aux lecteurs d'écran, sans rien
 * lire de plus : le squelette lui-même est décoratif.
 */
export function PageSkeleton({ stats = true, rows = 5 }: { stats?: boolean; rows?: number }) {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Chargement de la page…</span>
      <div aria-hidden="true" className="space-y-2">
        <div className="skeleton-shimmer h-8 w-52 rounded-lg" />
        <div className="skeleton-shimmer h-4 w-72 max-w-full rounded-md" />
      </div>
      {stats && (
        <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton-shimmer h-[104px] rounded-2xl" style={{ animationDelay: `${index * 90}ms` }} />
          ))}
        </div>
      )}
      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="skeleton-shimmer h-14 rounded-xl" style={{ animationDelay: `${index * 90}ms` }} />
        ))}
      </div>
    </div>
  );
}
