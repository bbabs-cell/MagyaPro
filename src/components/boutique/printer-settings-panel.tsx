'use client';

import { useEffect, useState } from 'react';

import { Button, Card, cx } from '@/components/ui';
import { buildTicket } from '@/lib/boutique/ticket';
import {
  DEFAULT_PRINTER_SETTINGS,
  isBluetoothPrinterConnected,
  isBluetoothSupported,
  pairBluetoothPrinter,
  printTicket,
  readPrinterSettings,
  writePrinterSettings,
  type PrinterSettings,
} from '@/lib/client/thermal-printer';

/**
 * Réglage de l'imprimante de tickets — propre à cet appareil (chaque caisse a
 * la sienne). Accessible depuis la caisse comme depuis Réglages : un caissier
 * doit pouvoir rebrancher son imprimante sans droits d'administration.
 */
export function PrinterSettingsPanel({
  storeName,
  currency,
  className,
  onChange,
}: {
  storeName: string;
  currency: string;
  className?: string;
  onChange?: (settings: PrinterSettings) => void;
}) {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
  const [supported, setSupported] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState<'pair' | 'test' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Lu après le montage : le serveur ne connaît ni l'appareil ni ses réglages.
  useEffect(() => {
    setSettings(readPrinterSettings());
    setSupported(isBluetoothSupported());
    setConnected(isBluetoothPrinterConnected());
  }, []);

  function update(patch: Partial<PrinterSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    writePrinterSettings(next);
    onChange?.(next);
  }

  async function pair() {
    setBusy('pair');
    setMessage(null);
    try {
      const name = await pairBluetoothPrinter();
      update({ mode: 'bluetooth', deviceName: name });
      setConnected(true);
      setMessage({ ok: true, text: `${name} connectée.` });
    } catch (error) {
      // Fermer la liste sans choisir n'est pas une erreur.
      if (error instanceof Error && error.name === 'NotFoundError') return;
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Connexion impossible.' });
    } finally {
      setBusy(null);
    }
  }

  async function testPrint() {
    setBusy('test');
    setMessage(null);
    try {
      await printTicket(
        buildTicket({
          store: { name: storeName },
          currency,
          paymentLabel: () => 'Espèces',
          footer: 'Ticket d’essai — accents : é è à ç ô',
          sale: {
            number: 0,
            createdAt: new Date(),
            subtotal: 1500,
            discount: 0,
            taxAmount: 0,
            total: 1500,
            creditAmount: 0,
            items: [
              { productName: 'Article d’essai', quantity: 2, unitLabel: null, unitPrice: 500, total: 1000 },
              { productName: 'Café Touba', quantity: 1, unitLabel: null, unitPrice: 500, total: 500 },
            ],
            payments: [{ method: 'cash', amount: 1500 }],
          },
        }),
        { settings },
      );
      setConnected(isBluetoothPrinterConnected());
      setMessage({ ok: true, text: 'Ticket d’essai envoyé.' });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Impression impossible.' });
    } finally {
      setBusy(null);
    }
  }

  const option = (active: boolean) =>
    cx(
      'flex-1 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
      active ? 'border-brand-strong bg-brand-soft text-ink' : 'border-surface-border bg-surface text-ink hover:border-ink-faint',
    );

  return (
    <Card className={cx('p-4 sm:p-5', className)}>
      <h2 className="text-sm font-medium">Imprimante de tickets</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Réglage propre à cet appareil. Fonctionne avec les imprimantes thermiques 58 et 80 mm.
      </p>

      <div className="mt-4 space-y-4">
        <fieldset>
          <legend className="text-xs font-medium text-ink-muted">Connexion</legend>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className={option(settings.mode === 'bluetooth')}
              aria-pressed={settings.mode === 'bluetooth'}
              disabled={!supported}
              onClick={() => update({ mode: 'bluetooth' })}
            >
              <span className="block font-medium">Bluetooth</span>
              <span className="block text-xs text-ink-muted">
                {supported ? 'Impression directe, sans fenêtre.' : 'Non disponible sur ce navigateur (Chrome requis).'}
              </span>
            </button>
            <button
              type="button"
              className={option(settings.mode === 'system')}
              aria-pressed={settings.mode === 'system'}
              onClick={() => update({ mode: 'system' })}
            >
              <span className="block font-medium">Imprimante de l&apos;appareil</span>
              <span className="block text-xs text-ink-muted">USB, Wi-Fi ou application d&apos;impression.</span>
            </button>
          </div>
        </fieldset>

        {settings.mode === 'bluetooth' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-sunken px-3 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              {connected
                ? `Connectée : ${settings.deviceName ?? 'imprimante'}`
                : settings.deviceName
                  ? `${settings.deviceName} — à reconnecter`
                  : 'Aucune imprimante choisie'}
            </span>
            <Button type="button" size="sm" variant="secondary" onClick={pair} loading={busy === 'pair'}>
              {connected ? 'Changer' : 'Connecter l’imprimante'}
            </Button>
          </div>
        )}

        <fieldset>
          <legend className="text-xs font-medium text-ink-muted">Largeur du rouleau</legend>
          <div className="mt-1.5 flex gap-2">
            {([58, 80] as const).map((width) => (
              <button
                key={width}
                type="button"
                className={option(settings.width === width)}
                aria-pressed={settings.width === width}
                onClick={() => update({ width })}
              >
                <span className="block font-medium">{width} mm</span>
                <span className="block text-xs text-ink-muted">{width === 58 ? 'Petite imprimante' : 'Imprimante de comptoir'}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={settings.autoPrint}
            onChange={(event) => update({ autoPrint: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-brand-strong"
          />
          <span>
            Imprimer le ticket à chaque vente
            <span className="block text-xs text-ink-muted">Sinon, un bouton « Imprimer le ticket » apparaît après la vente.</span>
          </span>
        </label>

        {settings.mode === 'bluetooth' && (
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={settings.accents}
              onChange={(event) => update({ accents: event.target.checked })}
              className="mt-0.5 h-4 w-4 accent-brand-strong"
            />
            <span>
              Imprimer les accents
              <span className="block text-xs text-ink-muted">
                Décochez si le ticket d&apos;essai montre des symboles à la place de « é è à ç ».
              </span>
            </span>
          </label>
        )}

        {settings.mode === 'bluetooth' ? (
          <Button type="button" variant="secondary" size="sm" onClick={testPrint} loading={busy === 'test'}>
            Imprimer un ticket d&apos;essai
          </Button>
        ) : (
          <p className="text-xs text-ink-muted">
            Le ticket s&apos;ouvre dans une page au format du rouleau : choisissez votre imprimante, marges « aucune ».
          </p>
        )}

        {message && (
          <p role="status" className={cx('text-sm', message.ok ? 'text-state-ok' : 'text-state-bad')}>
            {message.text}
          </p>
        )}
      </div>
    </Card>
  );
}
