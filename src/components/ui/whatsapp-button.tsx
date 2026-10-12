import { cx } from '@/components/ui';

/**
 * Lien vers WhatsApp, message déjà rédigé : c'est le commerçant qui envoie,
 * d'un geste, depuis son propre compte. Gratuit, sans fournisseur, et le
 * client reçoit le message d'un numéro qu'il connaît.
 */
export function WhatsAppButton({
  href,
  children,
  size = 'sm',
  className,
}: {
  href: string;
  children: React.ReactNode;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-surface-border bg-surface font-medium text-ink transition-colors hover:bg-surface-sunken',
        size === 'xs' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm',
        className,
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className={size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4'} fill="#25D366">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.5-.3Z" />
      </svg>
      {children}
    </a>
  );
}
