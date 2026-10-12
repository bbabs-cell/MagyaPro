'use client';

import { encodeEscPos, type TicketData, type TicketWidth } from '@/lib/boutique/ticket';

/**
 * Imprimante de tickets, côté navigateur.
 *
 * Deux façons d'imprimer, au choix de chaque appareil :
 *
 * - **Bluetooth** (Chrome sur Android, ordinateur) : le ticket part en
 *   ESC/POS directement vers l'imprimante, sans fenêtre d'impression. C'est le
 *   cas le plus courant : un téléphone et une petite imprimante 58 mm.
 * - **Système** : la page du ticket s'ouvre et le navigateur imprime avec
 *   l'imprimante installée (USB sur ordinateur, application d'impression sur
 *   Android, AirPrint sur iPhone). Marche partout, au prix d'une confirmation.
 *
 * Les réglages vivent sur l'appareil : chaque caisse a sa propre imprimante.
 */

export type PrinterMode = 'bluetooth' | 'system';

export type PrinterSettings = {
  mode: PrinterMode;
  width: TicketWidth;
  /** Désactivé pour les imprimantes qui ne connaissent pas la page de code PC850. */
  accents: boolean;
  /** Imprime le ticket dès que la vente est enregistrée. */
  autoPrint: boolean;
  /** Nom de la dernière imprimante Bluetooth connectée, pour l'afficher. */
  deviceName?: string | null;
};

const SETTINGS_KEY = 'magyapro:imprimante';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  mode: 'system',
  width: 58,
  accents: true,
  autoPrint: false,
  deviceName: null,
};

export function readPrinterSettings(): PrinterSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_PRINTER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PrinterSettings>;
    return {
      mode: parsed.mode === 'bluetooth' ? 'bluetooth' : 'system',
      width: parsed.width === 80 ? 80 : 58,
      accents: parsed.accents !== false,
      autoPrint: parsed.autoPrint === true,
      deviceName: typeof parsed.deviceName === 'string' ? parsed.deviceName : null,
    };
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function writePrinterSettings(settings: PrinterSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Stockage bloqué : les réglages valent pour cette visite seulement.
  }
}

// --- Bluetooth -------------------------------------------------------------

// Types minimaux de Web Bluetooth : l'API n'est pas dans la bibliothèque DOM
// standard de TypeScript.
type Characteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
  writeValueWithResponse?(data: BufferSource): Promise<void>;
};
type Service = { getCharacteristics(): Promise<Characteristic[]> };
type Server = { connected: boolean; getPrimaryServices(): Promise<Service[]> };
type Device = {
  id: string;
  name?: string;
  gatt?: { connected: boolean; connect(): Promise<Server> };
};
type Bluetooth = {
  requestDevice(options: unknown): Promise<Device>;
  getDevices?(): Promise<Device[]>;
};

/**
 * Services d'impression des modèles courants. Web Bluetooth n'autorise que
 * les services déclarés à l'avance ; ceux-ci couvrent les imprimantes
 * chinoises génériques (0x18f0, 0xff00, 0xffe0), Xprinter et Sunmi.
 */
const PRINTER_SERVICES = [
  0x18f0,
  0xff00,
  0xffe0,
  0xfee7,
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ae30-0000-1000-8000-00805f9b34fb',
];

function bluetooth(): Bluetooth | null {
  if (typeof navigator === 'undefined') return null;
  return ((navigator as unknown as { bluetooth?: Bluetooth }).bluetooth ?? null);
}

export function isBluetoothSupported(): boolean {
  return bluetooth() !== null;
}

let device: Device | null = null;
let characteristic: Characteristic | null = null;

async function findWritable(server: Server): Promise<Characteristic> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const characteristics = await service.getCharacteristics().catch(() => []);
    const writable = characteristics.find(
      (candidate) => candidate.properties.writeWithoutResponse || candidate.properties.write,
    );
    if (writable) return writable;
  }
  throw new Error("Cette imprimante n'accepte pas l'impression Bluetooth depuis le navigateur.");
}

async function connect(target: Device): Promise<Characteristic> {
  if (!target.gatt) throw new Error("Cette imprimante n'est pas joignable en Bluetooth.");
  const server = await target.gatt.connect();
  device = target;
  characteristic = await findWritable(server);
  return characteristic;
}

/**
 * Choix d'une imprimante. Doit être appelé depuis un geste de l'utilisateur
 * (un toucher) : le navigateur l'exige pour ouvrir la liste des appareils.
 */
export async function pairBluetoothPrinter(): Promise<string> {
  const api = bluetooth();
  if (!api) throw new Error("Ce navigateur ne gère pas le Bluetooth. Utilisez Chrome sur Android ou sur ordinateur.");
  const chosen = await api.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
  await connect(chosen);
  return chosen.name ?? 'Imprimante Bluetooth';
}

/** Reprend la connexion à l'imprimante déjà choisie, sans rien demander. */
async function ensureConnected(): Promise<Characteristic> {
  if (device?.gatt?.connected && characteristic) return characteristic;
  if (device) return connect(device);

  // Navigateurs qui se souviennent des appareils autorisés : on reprend le
  // premier sans redemander. Ailleurs, il faut rechoisir après un rechargement.
  const known = await bluetooth()?.getDevices?.().catch(() => []);
  if (known && known.length > 0) return connect(known[0]!);

  throw new PrinterNotConnectedError();
}

export class PrinterNotConnectedError extends Error {
  constructor() {
    super('Imprimante non connectée : touchez « Connecter l’imprimante ».');
    this.name = 'PrinterNotConnectedError';
  }
}

export function isBluetoothPrinterConnected(): boolean {
  return Boolean(device?.gatt?.connected && characteristic);
}

/**
 * Les imprimantes bon marché ont un petit tampon : au-delà d'environ 200
 * octets par paquet, ou envoyés trop vite, la fin du ticket se perd.
 */
async function send(target: Characteristic, bytes: Uint8Array) {
  const chunkSize = 180;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    if (target.properties.writeWithoutResponse && target.writeValueWithoutResponse) {
      await target.writeValueWithoutResponse(chunk);
      await new Promise((resolve) => setTimeout(resolve, 25));
    } else if (target.writeValueWithResponse) {
      await target.writeValueWithResponse(chunk);
    } else {
      await target.writeValue(chunk);
    }
  }
}

// --- Impression ------------------------------------------------------------

/** URL de la page du ticket, imprimée par le navigateur. */
export function systemTicketUrl(saleId: string, width: TicketWidth): string {
  return `/boutique/ticket/${encodeURIComponent(saleId)}?largeur=${width}&imprimer=1`;
}

/**
 * Imprime un ticket selon les réglages de l'appareil. En mode système, ouvre
 * la page du ticket (il faut alors l'identifiant de la vente) ; le ticket
 * peut donc être passé sous forme de fonction, appelée seulement en
 * Bluetooth — une réimpression n'a pas à le télécharger pour rien.
 */
export async function printTicket(
  ticket: TicketData | (() => Promise<TicketData>),
  options: { saleId?: string | null; settings?: PrinterSettings } = {},
): Promise<void> {
  const settings = options.settings ?? readPrinterSettings();

  if (settings.mode === 'bluetooth') {
    const target = await ensureConnected();
    const data = typeof ticket === 'function' ? await ticket() : ticket;
    await send(target, encodeEscPos(data, { width: settings.width, accents: settings.accents }));
    return;
  }

  if (!options.saleId) throw new Error('Ticket indisponible pour cette vente.');
  const opened = window.open(systemTicketUrl(options.saleId, settings.width), '_blank');
  if (!opened) throw new Error('Le navigateur a bloqué la fenêtre du ticket. Autorisez les fenêtres pour ce site.');
}
