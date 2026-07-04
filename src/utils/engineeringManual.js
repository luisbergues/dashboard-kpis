// Transcribed reference knowledge base from "Manual Técnico de Ingeniería"
// (Especificaciones de Taller, Diseño y Documentación — JL Closets).
// Used by ProjectChatbot to answer engineering/shop-spec questions.
//
// Each entry: `keywords` are normalized (lowercase, no accents) trigger terms;
// `section` is the manual section number for citation; `answer` is the
// verbatim rule, kept in Spanish to match the source document.

export const ENGINEERING_MANUAL = [
  {
    section: '1.1',
    title: 'Cajones — valores predeterminados',
    keywords: ['cajon predeterminado', 'valores predeterminados cajon', 'frente slab', 'caja prfv', 'soft close', 'tiradores euro', 'corredera', 'panel height sheet', 'altura del frente del cajon', 'medida interior cajon'],
    answer: 'Valores predeterminados de cajones: frente slab, caja PRFV (hecha en casa) o Dovetail (pedido), correderas Soft Close, tiradores Euro (Chrome / Brushed Nickel / Matte Black). Dimensiones, cantidad, habitación e info de tiradores especiales deben especificarse. La altura del frente debe ajustarse a la Panel Height Sheet (ej. 6 1/8", 7 3/8", 9 7/8", 12 3/8"). Medida interior estándar: 24" o 30" (a medida si es necesario).',
  },
  {
    section: '1.2',
    title: 'Tubos de Colgar (Rods)',
    keywords: ['tubo de colgar', 'rods', 'oval chrome', 'tubo de colgar tamaño'],
    answer: 'Tubos de Colgar (Rods): tipo y color predeterminado Oval Chrome. Tamaño: el de la unidad de apertura menos 1/4". Los tubos de distintas habitaciones deben quedar claramente separados.',
  },
  {
    section: '1.3',
    title: 'Notas / Artículos Varios (ESS)',
    keywords: ['notas varias', 'hook board', 'hookboard', 'encimera countertop hoja de taller', 'edgeband eb countertop', 'no se incluyen accesorios'],
    answer: 'En Notas/Artículos Varios: incluir todo lo necesario para fabricación (muescas, modificaciones especiales); no se incluyen accesorios (los instaladores reciben la hoja de accesorios aparte). Enumerar todas las puertas (tipo, color, bisagras, tiradores, cantidad, dimensiones) y hook-boards. Escribir countertops con dimensiones, cantidad, color y color/tamaño del edgeband (EB). Una encimera de 1 1/2" figura como una sola unidad, aunque sea compuesta de dos piezas de 3/4" (la CNC solo corta 3/4"). Añadir espejos y piezas no estándar.\n\nFormato de ejemplo:\nSlab door, White, S/C hinges, Euro BN\n1) 15 3/16" W x 83 1/2" H\n\nHook-boards, White\n3) 15" W x 5 1/2" H',
  },
  {
    section: '2',
    title: 'Planos y Documentación (Drawings)',
    keywords: ['descargar del crm', 'hoja de accesorios', 'medidas finales', 'archivo kcd', 'guardar copia diaria', 'nombre de archivo apellido color fecha'],
    answer: 'Planos y Documentación: descargar del CRM la Hoja de Accesorios, las Medidas Finales y el archivo KCD. Guardar copia diaria del archivo con formato: (Apellido del cliente)_(Color)_(Fecha MM-DD-YYYY).',
  },
  {
    section: '3',
    title: 'Reglas Generales de Diseño',
    keywords: ['contactar al diseñador', 'medida final difiere', 'unidades simetricas', 'relleno filler pared', '5 5/8 profundidad', '16avos de pulgada', 'century gothic', 'fuente de las notas'],
    answer: 'Reglas Generales de Diseño:\n• Contactar al diseñador si la Medida Final de una pared difiere en 8" o más.\n• Simplificar y hacer las unidades simétricas si es posible.\n• Usar rellenos (fillers) en las paredes — profundidad por defecto 5 5/8", salvo indicación contraria.\n• Evitar el uso de 16avos de pulgada en el ancho y en general.\n• Usar fuente Century Gothic para todas las notas, claramente visibles.',
  },
  {
    section: '4.1',
    title: 'Puertas — tamaño y reveal',
    keywords: ['tamaño maximo de puerta', '24 x 84', 'holgura reveal', 'half overlay reveal', 'full overlay reveal', 'puerta 1/4 reveal', 'deformacion puerta'],
    answer: 'Puertas: tamaño máximo 24" × 84" para evitar deformaciones. Holgura (reveal): 1/2" para half overlay, 1/8" para full overlay. Las puertas no deben tener 1/4" de reveal, salvo excepciones.',
  },
  {
    section: '4.2',
    title: 'Puertas de Cajón',
    keywords: ['espacio entre cajones', 'cajon mas angosto', 'corredera de cajon', 'bisagra puerta espacio libre', 'ancho de apertura estandar 24 30', 'altura de cajon patron', '3 5/8 aumenta 1 1/4'],
    answer: 'Puertas de Cajón: debe haber 1/8" de espacio entre todos los cajones. El cajón debe ser 1" más angosto que la apertura (por la corredera). Con puertas: dejar 2" libres (una puerta) o 3" (dos puertas) para la bisagra. Anchos de apertura estándar: 24" y 30". Alturas de cajón: patrón que comienza en 3 5/8" y aumenta en incrementos de 1 1/4".',
  },
  {
    section: '4.3',
    title: 'Countertops (overhang)',
    keywords: ['overhang', 'countertop overhang', 'encimera 1 1/2 overhang', 'encimera 3/4 overhang', 'quartz top de soporte'],
    answer: 'Countertops: overhang total de 3/4" como estándar general. Encimeras de 1 1/2": overhang de 1". Encimeras de 3/4": overhang de 3/4" (si no se respeta, consultar al diseñador). Todos los countertops de Quartz llevan un top abajo como soporte.',
  },
  {
    section: '4.4',
    title: 'Pull-out Shelves',
    keywords: ['pull out shelves', 'pullout shelf', 'espaciadores de 1 pulgada', 'restar 1 sin puertas 2 con una puerta'],
    answer: 'Pull-out Shelves: restar 1" sin puertas, 2" con una puerta, o 3" con dos puertas (espacio de correderas). Pueden necesitarse espaciadores de 1" de grosor.',
  },
  {
    section: '4.5',
    title: 'Backing',
    keywords: ['backing secciones sin cajones', 'refuerzo separado profundidad estantes', 'backing 3/4 cajones', 'recordatorio backing'],
    answer: 'Backing: se usa solo detrás de secciones sin cajones. Si se añade un refuerzo separado, ajustar la profundidad de los estantes considerando el grosor del backing (3/4"). Recordatorio: si hay backing, restar 3/4" del mismo a los cajones — esto solo aplica en casos especiales, el backing normalmente no va detrás de cajones.',
  },
  {
    section: '4.6',
    title: 'Otros Componentes (Hampers, Tall Units)',
    keywords: ['hamper', 'contenedor de ropa sucia', '26 1/4 altura de puerta', 'tall units apilamiento', 'mas de 8 pies'],
    answer: 'Otros Componentes: Hampers (contenedores de ropa sucia) estandarizados a 26 1/4" de altura de puerta, 1" más angostos que la apertura de la unidad. Tall Units: revisar las de más de 8 pies para apilamiento.',
  },
  {
    section: '4.7',
    title: 'Seguridad y Códigos (Florida)',
    keywords: ['sprinkler', 'rociador', '18 pulgadas alrededor de rociadores', 'vent ventilacion', '16 pulgadas debajo de ventilaciones', 'codigo de florida'],
    answer: 'Seguridad y Códigos (Florida): espacio libre de 18" alrededor de rociadores (sprinklers). Mínimo 16" de espacio libre debajo de ventilaciones (vents).',
  },
  {
    section: '4.8',
    title: 'ESS Notes (ver Quote / IP)',
    keywords: ['ess notes', 'belt board', 'belt rack', 'custom bore holes', 'dovetail drawer', 'double panel', 'glass doors', 'hot tools organizer', 'mirror backing', 'piano hinges', 'special boring pattern', 'scar cleats', 'slanted shoe shelves', 'shoe fences', 'sliding belt rack', 'top molding ess', 'valet rod'],
    answer: 'Elementos que van en ESS Notes (ver Quote/IP): Belt board, Belt rack, Custom bore holes, Dovetail drawer, Double panel, Glass doors, Hot Tools Organizer, Mirror backing, Pull out shelves, Piano Hinges, Special boring pattern, Scar cleats, Slanted shoe shelves, Shoe fences, Sliding belt rack, Top molding, Valet rod.',
  },
  {
    section: '5.1',
    title: 'Checklist Inicial de Ingeniería',
    keywords: ['checklist inicial ingenieria', 'cut outs finals handles antes de empezar'],
    answer: 'Checklist Inicial (Ingeniería): consultar detalles antes de empezar — cut outs, finals, handles, accesorios, etc.',
  },
  {
    section: '5.2',
    title: 'Profundidades y Restas',
    keywords: ['estantes con backing agregado', 'cajon dovetail restar 1 profundidad', 'floating shelves 12', 'unidades sueltas fuera de unit configuration'],
    answer: 'Profundidades y Restas: los estantes en muebles con backing agregado como unidades sueltas (fuera de la unit configuration) deben restar 3/4" de profundidad por el backing. Cajones Dovetail: restar 1" de profundidad. Floating shelves: 12" D máximo.',
  },
  {
    section: '5.3',
    title: 'Materiales y Recubrimientos (estantes, thermofoil)',
    keywords: ['thermofoil', 'estantes 42 pulgadas closet', 'estante 16 pulgadas de profundidad', 'thermofoil puertas menores a 7 1/4'],
    answer: 'Materiales y Recubrimientos: permitir estantes de hasta 42" de ancho solo en closets, y no más de 16" de profundidad. Thermofoil: no puede colocarse en puertas menores a 7 1/4".',
  },
  {
    section: '5.4',
    title: 'Overlay y Reveal (puertas compartiendo panel)',
    keywords: ['full overlay half overlay hinge', 'puertas comparten panel', 'unidad izquierda unidad derecha reveal', '-1/4 1/8 half overlay', '-5/16 7/16 full overlay'],
    answer: 'Overlay y Reveal: Full Overlay o Half Overlay se define según el lado del hinge (bisagra). Puertas que comparten panel — Half Overlay: -1/4" la unidad izquierda, 1/8" la derecha (la unidad con el panel usa 1/8", la otra usa -1/4"). Puertas que comparten panel — Full Overlay: -5/16" y 7/16" respectivamente.',
  },
  {
    section: '5.5',
    title: 'Top Molding — medida estándar',
    keywords: ['top molding medida estandar', 'top molding 2 3/4'],
    answer: 'Top Molding: medida estándar 2 3/4" si no se indica otra cosa.',
  },
  {
    section: '5.6',
    title: 'Paneles y EB (Edgeband)',
    keywords: ['3 paneles seguidos double eb', 'mirror backing espejo 1/4', 'panel double eb'],
    answer: 'Paneles y EB (Edgeband): si hay 3 paneles seguidos en el diseño base, es un panel + uno con double EB. Mirror backing: lleva backing de 3/4" + espejo 1/4" (chequear en el diseño).',
  },
  {
    section: '5.7',
    title: 'Alturas y Bore Holes',
    keywords: ['fixed shelf tall units', 'tabla de 32mm', 'bore holes alturas'],
    answer: 'Alturas y Bore Holes: al hacer ingeniería, chequear las alturas de fixed shelf en tall units — deben coincidir siempre con las alturas de la tabla de 32mm y, por lo tanto, con los bore holes.',
  },
  {
    section: '5.8',
    title: 'Spanners en Paredes con Diagonales',
    keywords: ['spanner pared diagonal', 'top cabinets pared diagonal'],
    answer: 'Spanners en Paredes con Diagonales: los spanners entre módulos de base y los top cabinets en paredes con diagonales se hacen rectos y grandes, para que ajusten en el lugar.',
  },
  {
    section: '5.9',
    title: 'Corner Units y Lazy Susan',
    keywords: ['corner unit', 'lazy susan', 'cams cara compartida', 'gelfman fillers en l', 'dos puertas a 90 sin lazy susan'],
    answer: 'Corner Units y Lazy Susan: los shelves de una corner unit deben tener cams en la cara compartida con el otro lado: 1 1/2" del front y 2 1/4" del back. Lazy Susan: queda tocando justo entre puertas — 3/4" en vacío entre ambas puertas, tocando en la punta a 90°. Casos con dos puertas a 90° sin Lazy Susan (ej. Gelfman): dejar fillers en forma de L para que ambas puertas abran, mínimo 1 1/2" de cada lado.',
  },
  {
    section: '5.10',
    title: 'Cajones Desfasados',
    keywords: ['cajones desfasados', 'cajones desalineados', 'slanted drawer frentes en la instalacion'],
    answer: 'Cajones Desfasados: cajones desfasados / desalineados / slanted — indicar en el ESS que los frentes se colocan en la instalación.',
  },
  {
    section: '5.11',
    title: 'Shelf de Vidrio sobre Cajones',
    keywords: ['shelf de vidrio arriba de cajones', 'fixed arriba del top drawer', 'molding de soporte correderas', 'celat frente y fondo'],
    answer: 'Shelf de Vidrio sobre Cajones: si hay un shelf de vidrio arriba de cajones, el fixed que iba arriba del top drawer se mueve abajo del primer cajón para tapar el resto. Considerar un molding de soporte que tape las correderas. Se puede colocar un celat al frente y uno al fondo como soporte (2 3/4" D x 3/4" H).',
  },
  {
    section: '5.12',
    title: 'Fillers de 1 1/2"',
    keywords: ['filler de 1 1/2', 'dos piezas de 3/4 w x 5 5/8 d', 'filler como una sola unidad'],
    answer: 'Fillers: si hay un filler de 1 1/2" se produce como dos piezas de 3/4" W x 5 5/8" D, pero se indica como una sola unidad para que al instalar lo vean como una pieza en los drawings.',
  },
  {
    section: '6.1',
    title: 'Códigos de Producto (Zoho)',
    keywords: ['codigo de producto no estandar', 'zoho accessories sheet', 'codigo de zoho en el ess'],
    answer: 'Códigos de Producto: los códigos de productos no estándar se buscan en el Zoho o accessories sheet. Si tiene código, nunca es estándar. El código de Zoho siempre va en el ESS.',
  },
  {
    section: '6.2',
    title: 'Top Molding e Indicaciones de Color',
    keywords: ['top molding color distinto al room', 'indicar color y altura del top molding en ess', 'top molding 2 3/4 h white 300'],
    answer: 'Top Molding e Indicaciones de Color: si el top molding no es del mismo color que el room, indicarlo en IP y ESS. En el ESS, indicar color y altura del top molding.\nEjemplo: Top molding 2 3/4" H white 300',
  },
  {
    section: '6.3',
    title: 'Knobs y Tiradores',
    keywords: ['knob tirador ess', 'ultimo casillero de drawers'],
    answer: 'Knobs y Tiradores: el knob (tirador) se indica en el ESS, en las puertas donde vaya y en el último casillero de drawers.',
  },
  {
    section: '6.4',
    title: 'Edgeband (EB) en Backing',
    keywords: ['eb backing', '4s eb 2s eb', 'eb all panels and shelves'],
    answer: 'Edgeband (EB) en Backing: si el backing lleva EB, indicarlo así: "EB backing #38 (4S EB), #78 (2S EB)". Si hay EB en general: "EB all panels and shelves front and back".',
  },
  {
    section: '6.5',
    title: 'Formato de Puertas en ESS',
    keywords: ['formato de puertas en ess', 'natura slab door', 'hinges handle type ess'],
    answer: 'Formato de Puertas en ESS: con puertas de cualquier estilo, indicar color, tipo, hinges y handle type.\nEjemplo: NATURA Slab Door (color y tipo), S/C (soft close) half overlay, Finger Pull 3" Matte Nickel\n2) 16 3/4" W x 28 3/4" H',
  },
  {
    section: '6.6',
    title: 'Base Molding',
    keywords: ['base molding unir', 'seccion miscellaneous ess'],
    answer: 'Base Molding: ver si figura como "unir" para agregarlo al ESS, en la sección Miscellaneous.',
  },
  {
    section: '6.7',
    title: 'Criterio para Dividir ESS',
    keywords: ['dividir ess', 'combinaciones de color por cuarto', 'cuarto interior white classic 300', 'ess separados por color'],
    answer: 'Criterio para Dividir ESS: se divide en ESS distintos según combinaciones de color por cuarto. Ejemplo: si un cuarto tiene interior White Classic 300 y frentes Sand Linen, y un segundo cuarto tiene interior y frentes en un solo color Sand Linen, se generan dos ESS separados. Un tercer cuarto solo en white generaría un tercer ESS — manteniendo todo prolijamente dividido.',
  },
  {
    section: '6.8',
    title: 'Nomenclatura de Archivos',
    keywords: ['nomenclatura de archivos', 'ip ess kcd drawings nombre del proyecto', 'so number project name fecha'],
    answer: 'Nomenclatura de Archivos:\n• IP / ESS / KCD Drawings_(nombre del proyecto en Zoho)\n• File: SO Number_Project Name (Zoho)_Fecha (MM-DD-YY)',
  },
];

// Normalize: lowercase + strip accents, for tolerant matching.
export function normalizeText(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A query word and a vocab word "match" if they're identical, or if one is a
// prefix/substring of the other and the shorter side is long enough (5+
// chars) that it can't just be a coincidental fragment (e.g. "esta" inside
// "estandar") — short words must match exactly.
function wordsMatch(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 5 && longer.includes(shorter);
}

// Score every manual entry by counting overlap between the query's
// meaningful words (3+ chars) and the pooled vocabulary of its keyword
// phrases — a plain substring match on whole keyword phrases is too strict
// for free-form questions (word order/plurals/filler words vary), so this
// scores word-by-word instead. Requires at least 2 overlapping words so a
// single coincidental match doesn't hijack an unrelated question (e.g. a
// project-status query). Returns qualifying entries, best first.
export function searchEngineeringManual(rawQuery) {
  const query = normalizeText(rawQuery);
  if (query.length < 3) return [];
  const queryWords = query.split(' ').filter(w => w.length >= 3);
  if (queryWords.length === 0) return [];

  const scored = ENGINEERING_MANUAL.map(entry => {
    const vocab = new Set();
    entry.keywords.forEach(kw => {
      normalizeText(kw).split(' ').forEach(w => { if (w.length >= 3) vocab.add(w); });
    });

    let score = 0;
    queryWords.forEach(qw => {
      for (const w of vocab) {
        if (wordsMatch(qw, w)) { score++; break; }
      }
    });
    return { entry, score };
  }).filter(s => s.score >= 2);

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.entry);
}
