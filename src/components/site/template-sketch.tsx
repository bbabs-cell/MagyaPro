import { TEMPLATES } from '@/lib/templates/registry';

/**
 * Croquis d'un modèle de vitrine, dessiné en CSS.
 *
 * Il remplace l'aperçu quand aucune capture n'a été téléversée depuis
 * l'administration. Avant lui, les six cartes de la page de présentation
 * portaient le même dégradé bleu, et l'écran Apparence une simple pastille de
 * couleur : rien ne disait en quoi les modèles différaient, alors que c'est
 * exactement la question qu'on se pose en les comparant.
 *
 * Le croquis reprend la **structure** de chaque modèle — héros scindé, plein
 * cadre, colonne unique, bandeau défilant — avec ses couleurs suggérées. Il
 * ne contient aucun texte ni aucune donnée : des blocs, comme un plan.
 */
export function TemplateSketch({
  templateKey,
  primary,
  className = 'h-full w-full',
}: {
  templateKey: string;
  /** Couleur principale ; à défaut, celle que le modèle suggère. */
  primary?: string;
  className?: string;
}) {
  const definition = TEMPLATES.find((template) => template.key === templateKey);
  const color = primary ?? definition?.suggestedColors.primary ?? '#ff5e2e';
  const dark = definition?.suggestedColors.secondary ?? '#1c1712';

  return (
    <div aria-hidden="true" className={`relative overflow-hidden ${className}`}>
      {renderSketch(templateKey, color, dark)}
    </div>
  );
}

/** Barre de texte simulée. */
function Bar({ w, h = 6, c, o = 1 }: { w: string; h?: number; c: string; o?: number }) {
  return <span className="block rounded-full" style={{ width: w, height: h, backgroundColor: c, opacity: o }} />;
}

function renderSketch(key: string, color: string, dark: string) {
  switch (key) {
    case 'african-premium':
      return (
        <div className="flex h-full items-center gap-[8%] px-[8%]" style={{ backgroundColor: '#1c1512' }}>
          <div className="flex flex-1 flex-col gap-2">
            <Bar w="30%" h={2} c={color} />
            <Bar w="85%" h={10} c="#ffffff" o={0.9} />
            <Bar w="60%" h={10} c="#ffffff" o={0.9} />
            <Bar w="70%" c="#ffffff" o={0.35} />
            <span className="mt-2 block h-4 w-[45%] rounded-full" style={{ backgroundColor: color }} />
          </div>
          <div className="relative h-[62%] flex-1">
            <span className="absolute -inset-1.5 rounded-xl border opacity-50" style={{ borderColor: color }} />
            <span className="absolute inset-0 rounded-lg" style={{ backgroundColor: color, opacity: 0.55 }} />
          </div>
        </div>
      );
    case 'fast-food':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2" style={{ backgroundColor: color }}>
          <span className="block h-8 w-8 rounded-full border-[3px] border-white" />
          <Bar w="55%" h={12} c="#ffffff" />
          <Bar w="40%" c="#ffffff" o={0.7} />
          <span className="mt-1 block h-5 w-[38%] rounded-full bg-black shadow-[3px_3px_0_rgba(0,0,0,0.25)]" />
        </div>
      );
    case 'traditional':
      return (
        <div className="flex h-full flex-col justify-end" style={{ background: `linear-gradient(to top, #000000d9, ${dark}66), ${color}` }}>
          <div className="flex flex-col gap-2 px-[8%] pb-[8%]">
            <Bar w="65%" h={12} c="#ffffff" />
            <Bar w="45%" c="#ffffff" o={0.6} />
            <div className="mt-2 flex gap-1.5">
              {[0, 1, 2, 3].map((index) => (
                <span key={index} className="block h-3 w-[14%] rounded-full" style={{ backgroundColor: index === 0 ? color : '#ffffff55' }} />
              ))}
            </div>
          </div>
        </div>
      );
    case 'elegant':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2" style={{ backgroundColor: '#f7f4ee' }}>
          <span
            className="absolute right-3 top-0 font-serif text-[7rem] leading-[0.8]"
            style={{ color, opacity: 0.12 }}
          >
            E
          </span>
          <Bar w="10%" h={2} c={color} />
          <Bar w="45%" h={9} c={dark} o={0.85} />
          <div className="mt-2 flex w-[50%] flex-col gap-2">
            {[0, 1, 2].map((index) => (
              <span key={index} className="flex items-center gap-2">
                <Bar w="45%" h={4} c={dark} o={0.5} />
                <span className="flex-1 border-b border-dotted" style={{ borderColor: `${dark}55` }} />
                <Bar w="15%" h={4} c={color} />
              </span>
            ))}
          </div>
        </div>
      );
    case 'street-food':
      return (
        <div className="flex h-full flex-col" style={{ backgroundColor: '#fbf8f2' }}>
          <div className="flex flex-[1.3] items-center gap-[6%] px-[7%]" style={{ backgroundColor: color }}>
            <div className="flex flex-1 flex-col gap-1.5">
              <Bar w="80%" h={11} c="#ffffff" />
              <Bar w="55%" h={11} c="#ffffff" />
            </div>
            <span className="block h-[70%] flex-[0.8] rounded-2xl border-2 border-white/40 bg-black/15" />
          </div>
          <div className="flex h-4 items-center gap-2 bg-black px-2">
            {[0, 1, 2, 3, 4].map((index) => (
              <span key={index} className="flex items-center gap-1">
                <span className="block h-1 w-1 rounded-full" style={{ backgroundColor: dark }} />
                <Bar w="20px" h={3} c="#ffffff" o={0.8} />
              </span>
            ))}
          </div>
          <div className="flex flex-1 items-center gap-2 px-[7%]">
            {[0, 1, 2].map((index) => (
              <span key={index} className="block h-[60%] flex-1 rounded-lg border-2 border-black bg-white" />
            ))}
          </div>
        </div>
      );
    case 'prestige':
      return (
        <div className="flex h-full flex-col" style={{ backgroundColor: '#0c0b09' }}>
          <span className="block flex-1" style={{ background: `linear-gradient(to bottom, ${color}55, #0c0b09)` }} />
          <div className="flex flex-col items-center gap-2 pb-[9%] pt-2">
            <Bar w="8%" h={2} c={color} />
            <Bar w="50%" h={9} c="#ffffff" o={0.9} />
            <Bar w="34%" h={4} c={color} o={0.8} />
          </div>
        </div>
      );
    case 'modern':
    default:
      return (
        <div className="flex h-full items-center gap-[7%] px-[8%]" style={{ backgroundColor: '#fbf8f2' }}>
          <span
            className="absolute -left-6 -top-6 h-24 w-24 rounded-full blur-2xl"
            style={{ backgroundColor: color, opacity: 0.25 }}
          />
          <div className="relative flex flex-1 flex-col gap-2">
            <span className="block h-2.5 w-[35%] rounded-full border" style={{ borderColor: `${dark}33` }} />
            <Bar w="90%" h={12} c={dark} />
            <Bar w="60%" h={12} c={dark} />
            <Bar w="75%" c={dark} o={0.3} />
            <span className="mt-1 block h-4 w-[50%] rounded-full" style={{ backgroundColor: color }} />
          </div>
          <div className="grid h-[70%] flex-1 grid-cols-2 grid-rows-2 gap-1.5">
            <span className="row-span-2 rounded-lg" style={{ backgroundColor: color, opacity: 0.8 }} />
            <span className="rounded-lg" style={{ backgroundColor: color, opacity: 0.45 }} />
            <span className="rounded-lg" style={{ backgroundColor: dark, opacity: 0.15 }} />
          </div>
        </div>
      );
  }
}
