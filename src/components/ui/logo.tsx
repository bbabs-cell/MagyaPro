/**
 * Marque Magyapro : un « M » formé de fourchette, surmonté d'un dôme (cloche
 * à plat) en dégradé orange. Vectorielle pour rester nette à toute taille
 * (en-têtes, favicon, écrans HiDPI) sans dépendre d'un fichier image externe.
 */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Magyapro">
      <rect width="40" height="40" rx="10" fill="#0f2043" />
      <path
        d="M9 28.5V12.5L20 22.5L31 12.5V28.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 12.5C6.5 7.5 12.5 3.5 20 3.5C27.5 3.5 33.5 7.5 33.5 12.5C29.5 9.3 25 7.6 20 7.6C15 7.6 10.5 9.3 6.5 12.5Z"
        fill="url(#magyapro-dome)"
      />
      <defs>
        <linearGradient id="magyapro-dome" x1="6.5" y1="3.5" x2="33.5" y2="12.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff9a4d" />
          <stop offset="1" stopColor="#ff5e2e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({
  className = 'h-8 w-8',
  textClassName = 'text-lg',
  showText = true,
}: {
  className?: string;
  textClassName?: string;
  showText?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark className={className} />
      {showText && (
        <span className={`font-semibold tracking-tight ${textClassName}`}>
          Magya<span className="text-[#ff5e2e]">pro</span>
        </span>
      )}
    </span>
  );
}
