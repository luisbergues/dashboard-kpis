// Transcribed reference knowledge base from "Manual Técnico de Ingeniería"
// (Especificaciones de Taller, Diseño y Documentación — JL Closets).
// Used by ProjectChatbot to answer engineering/shop-spec questions.
//
// Each entry: `keywords` are normalized (lowercase, no accents) trigger terms
// (bilingual, since queries may come in Spanish or English); `section` is the
// manual section number for citation; `titleES`/`answerES` and
// `titleEN`/`answerEN` are the same rule in each language.

export const ENGINEERING_MANUAL = [
  {
    section: 'Anexo',
    titleES: 'Panel Height Sheet (tabla de tamaños de cajón)',
    titleEN: 'Panel Height Sheet (drawer size table)',
    keywords: ['panel height sheet', 'face height', 'box height', 'altura de frente de cajon tabla', 'tamaño xs cajon', 'tamaño s cajon', 'tamaño m cajon', 'tamaño l cajon', 'tamaño xl cajon', 'toh tilt out hamper', 'que talla de cajon uso', 'what drawer size', 'pencil drawer', 'flat jewelry drawer', 'jewelry insert drawer', 'file drawer altura', 'bulky clothing', 'underwear bras bathing suits', 'nylons lingerie drawer', 'folded nightgowns', 'workout clothes socks drawer', 'folded clothes drawer'],
    answerES: 'Panel Height Sheet — tamaños de cajón (Size / Face Height / Box Height / Uso recomendado):\n\n' +
      '• XS — Face 4 7/8" — Box 3" — Pencil drawer o flat jewelry\n' +
      '• S — Face 6 1/8" — Box 4" — Jewelry, underwear, bras, bathing suits, nylons, lingerie\n' +
      '• M — Face 7 3/8" — Box 6" — Jewelry insert, folded nightgowns, workout clothes, socks\n' +
      '• (sin talla) — Face 8 5/8" — Box —\n' +
      '• L — Face 9 7/8" — Box 8" — Folded clothes\n' +
      '• (sin talla) — Face 11 1/8" — Box —\n' +
      '• XL — Face 12 3/8" — Box 10" — Bulky clothing, file drawer\n' +
      '• TOH — Face 26 1/4" — Box NO BOX — Tilt-out hamper, laundry',
    answerEN: 'Panel Height Sheet — drawer sizes (Size / Face Height / Box Height / Recommended items):\n\n' +
      '• XS — Face 4 7/8" — Box 3" — Pencil drawer or flat jewelry\n' +
      '• S — Face 6 1/8" — Box 4" — Jewelry, underwear, bras, bathing suits, nylons, lingerie\n' +
      '• M — Face 7 3/8" — Box 6" — Jewelry insert, folded nightgowns, workout clothes, socks\n' +
      '• (no size) — Face 8 5/8" — Box —\n' +
      '• L — Face 9 7/8" — Box 8" — Folded clothes\n' +
      '• (no size) — Face 11 1/8" — Box —\n' +
      '• XL — Face 12 3/8" — Box 10" — Bulky clothing, file drawer\n' +
      '• TOH — Face 26 1/4" — Box NO BOX — Tilt-out hamper, laundry',
  },
  {
    section: '1.1',
    titleES: 'Cajones — valores predeterminados',
    titleEN: 'Drawers — default values',
    keywords: ['cajon predeterminado', 'valores predeterminados cajon', 'default drawer values', 'frente slab', 'slab front', 'caja prfv', 'soft close', 'tiradores euro', 'euro pulls', 'corredera', 'drawer slide', 'panel height sheet', 'altura del frente del cajon', 'drawer front height', 'medida interior cajon', 'drawer box interior size'],
    answerES: 'Valores predeterminados de cajones: frente slab, caja PRFV (hecha en casa) o Dovetail (pedido), correderas Soft Close, tiradores Euro (Chrome / Brushed Nickel / Matte Black). Dimensiones, cantidad, habitación e info de tiradores especiales deben especificarse. La altura del frente debe ajustarse a la Panel Height Sheet (ej. 6 1/8", 7 3/8", 9 7/8", 12 3/8"). Medida interior estándar: 24" o 30" (a medida si es necesario).',
    answerEN: 'Default drawer values: slab front, PRFV box (made in-house) or Dovetail (ordered), Soft Close slides, Euro pulls (Chrome / Brushed Nickel / Matte Black). Dimensions, quantity, room, and special pull product info must be specified. Drawer front height must match the Panel Height Sheet (e.g. 6 1/8", 7 3/8", 9 7/8", 12 3/8"). Standard interior size: 24" or 30" (custom if needed).',
  },
  {
    section: '1.2',
    titleES: 'Tubos de Colgar (Rods)',
    titleEN: 'Hanging Rods',
    keywords: ['tubo de colgar', 'hanging rod', 'rods', 'oval chrome', 'tubo de colgar tamaño', 'rod size'],
    answerES: 'Tubos de Colgar (Rods): tipo y color predeterminado Oval Chrome. Tamaño: el de la unidad de apertura menos 1/4". Los tubos de distintas habitaciones deben quedar claramente separados.',
    answerEN: 'Hanging Rods: default type and color is Oval Chrome. Size: opening size minus 1/4". Rods from different rooms must be clearly separated.',
  },
  {
    section: '1.3',
    titleES: 'Notas / Artículos Varios (ESS)',
    titleEN: 'Notes / Miscellaneous Items (ESS)',
    keywords: ['notas varias', 'misc notes ess', 'hook board', 'hookboard', 'encimera countertop hoja de taller', 'edgeband eb countertop', 'no se incluyen accesorios', 'accessories not included'],
    answerES: 'En Notas/Artículos Varios: incluir todo lo necesario para fabricación (muescas, modificaciones especiales); no se incluyen accesorios (los instaladores reciben la hoja de accesorios aparte). Enumerar todas las puertas (tipo, color, bisagras, tiradores, cantidad, dimensiones) y hook-boards. Escribir countertops con dimensiones, cantidad, color y color/tamaño del edgeband (EB). Una encimera de 1 1/2" figura como una sola unidad, aunque sea compuesta de dos piezas de 3/4" (la CNC solo corta 3/4"). Añadir espejos y piezas no estándar.\n\nFormato de ejemplo:\nSlab door, White, S/C hinges, Euro BN\n1) 15 3/16" W x 83 1/2" H\n\nHook-boards, White\n3) 15" W x 5 1/2" H',
    answerEN: 'Notes/Miscellaneous Items: include everything needed for fabrication (notches, special modifications); accessories are NOT included (installers get the accessories sheet separately). List all doors (type, color, hinges, pulls, quantity, dimensions) and hook-boards. Write countertops with dimensions, quantity, color, and edgeband (EB) color/size. A 1 1/2" countertop is listed as a single unit of that height, even though it\'s made of two 3/4" pieces (the CNC only cuts 3/4"). Add mirrors and any non-standard piece.\n\nExample format:\nSlab door, White, S/C hinges, Euro BN\n1) 15 3/16" W x 83 1/2" H\n\nHook-boards, White\n3) 15" W x 5 1/2" H',
  },
  {
    section: '2',
    titleES: 'Planos y Documentación (Drawings)',
    titleEN: 'Drawings and Documentation',
    keywords: ['descargar del crm', 'download from crm', 'hoja de accesorios', 'accessories sheet', 'medidas finales', 'final measurements', 'archivo kcd', 'kcd file', 'guardar copia diaria', 'save daily copy', 'nombre de archivo apellido color fecha', 'file naming lastname color date'],
    answerES: 'Planos y Documentación: descargar del CRM la Hoja de Accesorios, las Medidas Finales y el archivo KCD. Guardar copia diaria del archivo con formato: (Apellido del cliente)_(Color)_(Fecha MM-DD-YYYY).',
    answerEN: 'Drawings and Documentation: download the Accessories Sheet, Final Measurements, and the KCD file from the CRM. Save a daily copy of the file with the format: (Client last name)_(Color)_(Date MM-DD-YYYY).',
  },
  {
    section: '3',
    titleES: 'Reglas Generales de Diseño',
    titleEN: 'General Design Rules',
    keywords: ['contactar al diseñador', 'contact the designer', 'medida final difiere', 'final measurement differs', 'unidades simetricas', 'symmetrical units', 'relleno filler pared', 'wall filler depth', '5 5/8 profundidad', '16avos de pulgada', 'sixteenths of an inch', 'century gothic', 'fuente de las notas', 'notes font'],
    answerES: 'Reglas Generales de Diseño:\n• Contactar al diseñador si la Medida Final de una pared difiere en 8" o más.\n• Simplificar y hacer las unidades simétricas si es posible.\n• Usar rellenos (fillers) en las paredes — profundidad por defecto 5 5/8", salvo indicación contraria.\n• Evitar el uso de 16avos de pulgada en el ancho y en general.\n• Usar fuente Century Gothic para todas las notas, claramente visibles.',
    answerEN: 'General Design Rules:\n• Contact the designer if a wall\'s Final Measurement differs by 8" or more.\n• Simplify and make units symmetrical when possible.\n• Use fillers on walls — default depth is 5 5/8" unless stated otherwise.\n• Avoid using 16ths of an inch in widths and in general.\n• Use Century Gothic font for all notes, clearly visible.',
  },
  {
    section: '4.1',
    titleES: 'Puertas — tamaño y reveal',
    titleEN: 'Doors — size and reveal',
    keywords: ['tamaño maximo de puerta', 'maximum door size', '24 x 84', 'holgura reveal', 'door reveal gap', 'half overlay reveal', 'full overlay reveal', 'puerta 1/4 reveal', 'deformacion puerta', 'door warping'],
    answerES: 'Puertas: tamaño máximo 24" × 84" para evitar deformaciones. Holgura (reveal): 1/2" para half overlay, 1/8" para full overlay. Las puertas no deben tener 1/4" de reveal, salvo excepciones.',
    answerEN: 'Doors: maximum size 24" × 84" to avoid warping. Reveal: 1/2" for half overlay, 1/8" for full overlay. Doors should not have a 1/4" reveal, except in exceptional cases.',
  },
  {
    section: '4.2',
    titleES: 'Puertas de Cajón',
    titleEN: 'Drawer Fronts',
    keywords: ['espacio entre cajones', 'gap between drawers', 'cajon mas angosto', 'drawer narrower than opening', 'corredera de cajon', 'bisagra puerta espacio libre', 'hinge clearance', 'ancho de apertura estandar 24 30', 'standard opening width', 'altura de cajon patron', 'drawer height pattern', '3 5/8 aumenta 1 1/4'],
    answerES: 'Puertas de Cajón: debe haber 1/8" de espacio entre todos los cajones. El cajón debe ser 1" más angosto que la apertura (por la corredera). Con puertas: dejar 2" libres (una puerta) o 3" (dos puertas) para la bisagra. Anchos de apertura estándar: 24" y 30". Alturas de cajón: patrón que comienza en 3 5/8" y aumenta en incrementos de 1 1/4".',
    answerEN: 'Drawer Fronts: there must be 1/8" of gap between all drawers. The drawer must be 1" narrower than the opening (for the slide). With doors: leave 2" clear (one door) or 3" (two doors) for the hinge. Standard opening widths: 24" and 30". Drawer heights: pattern starting at 3 5/8" and increasing in 1 1/4" increments.',
  },
  {
    section: '4.3',
    titleES: 'Countertops (overhang)',
    titleEN: 'Countertops (overhang)',
    keywords: ['overhang', 'countertop overhang', 'encimera 1 1/2 overhang', 'encimera 3/4 overhang', 'quartz top de soporte', 'quartz support top'],
    answerES: 'Countertops: overhang total de 3/4" como estándar general. Encimeras de 1 1/2": overhang de 1". Encimeras de 3/4": overhang de 3/4" (si no se respeta, consultar al diseñador). Todos los countertops de Quartz llevan un top abajo como soporte.',
    answerEN: 'Countertops: total overhang of 3/4" as the general standard. 1 1/2" countertops: 1" overhang. 3/4" countertops: 3/4" overhang (if not followed, consult the designer). All Quartz countertops carry a support top underneath.',
  },
  {
    section: '4.4',
    titleES: 'Pull-out Shelves',
    titleEN: 'Pull-out Shelves',
    keywords: ['pull out shelves', 'pullout shelf', 'espaciadores de 1 pulgada', '1 inch spacers', 'restar 1 sin puertas 2 con una puerta', 'subtract for slides'],
    answerES: 'Pull-out Shelves: restar 1" sin puertas, 2" con una puerta, o 3" con dos puertas (espacio de correderas). Pueden necesitarse espaciadores de 1" de grosor.',
    answerEN: 'Pull-out Shelves: subtract 1" with no doors, 2" with one door, or 3" with two doors (slide clearance). 1"-thick spacers may be needed.',
  },
  {
    section: '4.5',
    titleES: 'Backing',
    titleEN: 'Backing',
    keywords: ['backing secciones sin cajones', 'backing behind sections without drawers', 'refuerzo separado profundidad estantes', 'backing 3/4 cajones', 'recordatorio backing'],
    answerES: 'Backing: se usa solo detrás de secciones sin cajones. Si se añade un refuerzo separado, ajustar la profundidad de los estantes considerando el grosor del backing (3/4"). Recordatorio: si hay backing, restar 3/4" del mismo a los cajones — esto solo aplica en casos especiales, el backing normalmente no va detrás de cajones.',
    answerEN: 'Backing: used only behind sections without drawers. If a separate reinforcement is added, adjust shelf depth to account for the backing thickness (3/4"). Reminder: if there is backing, subtract 3/4" from the drawers — this only applies in special cases, backing normally does not go behind drawers.',
  },
  {
    section: '4.6',
    titleES: 'Otros Componentes (Hampers, Tall Units)',
    titleEN: 'Other Components (Hampers, Tall Units)',
    keywords: ['hamper', 'contenedor de ropa sucia', 'laundry hamper', '26 1/4 altura de puerta', 'tall units apilamiento', 'tall unit stacking', 'mas de 8 pies', 'over 8 feet'],
    answerES: 'Otros Componentes: Hampers (contenedores de ropa sucia) estandarizados a 26 1/4" de altura de puerta, 1" más angostos que la apertura de la unidad. Tall Units: revisar las de más de 8 pies para apilamiento.',
    answerEN: 'Other Components: Hampers standardized to a 26 1/4" door height, 1" narrower than the unit opening. Tall Units: review any over 8 feet for stacking.',
  },
  {
    section: '4.7',
    titleES: 'Seguridad y Códigos (Florida)',
    titleEN: 'Safety and Codes (Florida)',
    keywords: ['sprinkler', 'rociador', '18 pulgadas alrededor de rociadores', 'clearance around sprinklers', 'vent ventilacion', '16 pulgadas debajo de ventilaciones', 'clearance below vents', 'codigo de florida', 'florida code'],
    answerES: 'Seguridad y Códigos (Florida): espacio libre de 18" alrededor de rociadores (sprinklers). Mínimo 16" de espacio libre debajo de ventilaciones (vents).',
    answerEN: 'Safety and Codes (Florida): 18" of clearance around sprinklers. Minimum 16" of clearance below vents.',
  },
  {
    section: '4.8',
    titleES: 'ESS Notes (ver Quote / IP)',
    titleEN: 'ESS Notes (see Quote / IP)',
    keywords: ['ess notes', 'belt board', 'belt rack', 'custom bore holes', 'dovetail drawer', 'double panel', 'glass doors', 'hot tools organizer', 'mirror backing', 'piano hinges', 'special boring pattern', 'scar cleats', 'slanted shoe shelves', 'shoe fences', 'sliding belt rack', 'top molding ess', 'valet rod'],
    answerES: 'Elementos que van en ESS Notes (ver Quote/IP): Belt board, Belt rack, Custom bore holes, Dovetail drawer, Double panel, Glass doors, Hot Tools Organizer, Mirror backing, Pull out shelves, Piano Hinges, Special boring pattern, Scar cleats, Slanted shoe shelves, Shoe fences, Sliding belt rack, Top molding, Valet rod.',
    answerEN: 'Items that go in ESS Notes (see Quote/IP): Belt board, Belt rack, Custom bore holes, Dovetail drawer, Double panel, Glass doors, Hot Tools Organizer, Mirror backing, Pull out shelves, Piano Hinges, Special boring pattern, Scar cleats, Slanted shoe shelves, Shoe fences, Sliding belt rack, Top molding, Valet rod.',
  },
  {
    section: '5.1',
    titleES: 'Checklist Inicial de Ingeniería',
    titleEN: 'Initial Engineering Checklist',
    keywords: ['checklist inicial ingenieria', 'initial engineering checklist', 'cut outs finals handles antes de empezar', 'cut outs finals handles before starting'],
    answerES: 'Checklist Inicial (Ingeniería): consultar detalles antes de empezar — cut outs, finals, handles, accesorios, etc.',
    answerEN: 'Initial Checklist (Engineering): check details before starting — cut outs, finals, handles, accessories, etc.',
  },
  {
    section: '5.2',
    titleES: 'Profundidades y Restas',
    titleEN: 'Depths and Subtractions',
    keywords: ['estantes con backing agregado', 'shelves with added backing', 'cajon dovetail restar 1 profundidad', 'dovetail drawer subtract 1 depth', 'floating shelves 12', 'unidades sueltas fuera de unit configuration', 'loose units outside unit configuration'],
    answerES: 'Profundidades y Restas: los estantes en muebles con backing agregado como unidades sueltas (fuera de la unit configuration) deben restar 3/4" de profundidad por el backing. Cajones Dovetail: restar 1" de profundidad. Floating shelves: 12" D máximo.',
    answerEN: 'Depths and Subtractions: shelves in furniture with backing added as loose units (outside the unit configuration) must subtract 3/4" of depth for the backing. Dovetail drawers: subtract 1" of depth. Floating shelves: 12" D maximum.',
  },
  {
    section: '5.3',
    titleES: 'Materiales y Recubrimientos (estantes, thermofoil)',
    titleEN: 'Materials and Finishes (shelves, thermofoil)',
    keywords: ['thermofoil', 'estantes 42 pulgadas closet', '42 inch shelves closet', 'estante 16 pulgadas de profundidad', '16 inch shelf depth', 'thermofoil puertas menores a 7 1/4', 'thermofoil doors smaller than 7 1/4'],
    answerES: 'Materiales y Recubrimientos: permitir estantes de hasta 42" de ancho solo en closets, y no más de 16" de profundidad. Thermofoil: no puede colocarse en puertas menores a 7 1/4".',
    answerEN: 'Materials and Finishes: shelves up to 42" wide are only allowed in closets, and no more than 16" deep. Thermofoil: cannot be applied to doors smaller than 7 1/4".',
  },
  {
    section: '5.4',
    titleES: 'Overlay y Reveal (puertas compartiendo panel)',
    titleEN: 'Overlay and Reveal (doors sharing a panel)',
    keywords: ['full overlay half overlay hinge', 'puertas comparten panel', 'doors sharing a panel', 'unidad izquierda unidad derecha reveal', 'left unit right unit reveal', '-1/4 1/8 half overlay', '-5/16 7/16 full overlay'],
    answerES: 'Overlay y Reveal: Full Overlay o Half Overlay se define según el lado del hinge (bisagra). Puertas que comparten panel — Half Overlay: -1/4" la unidad izquierda, 1/8" la derecha (la unidad con el panel usa 1/8", la otra usa -1/4"). Puertas que comparten panel — Full Overlay: -5/16" y 7/16" respectivamente.',
    answerEN: 'Overlay and Reveal: Full Overlay or Half Overlay is defined by which side the hinge is on. Doors sharing a panel — Half Overlay: -1/4" on the left unit, 1/8" on the right (the unit with the panel uses 1/8", the other uses -1/4"). Doors sharing a panel — Full Overlay: -5/16" and 7/16" respectively.',
  },
  {
    section: '5.5',
    titleES: 'Top Molding — medida estándar',
    titleEN: 'Top Molding — standard size',
    keywords: ['top molding medida estandar', 'top molding standard size', 'top molding 2 3/4'],
    answerES: 'Top Molding: medida estándar 2 3/4" si no se indica otra cosa.',
    answerEN: 'Top Molding: standard size is 2 3/4" unless stated otherwise.',
  },
  {
    section: '5.6',
    titleES: 'Paneles y EB (Edgeband)',
    titleEN: 'Panels and EB (Edgeband)',
    keywords: ['3 paneles seguidos double eb', '3 panels in a row double eb', 'mirror backing espejo 1/4', 'mirror backing 1/4 mirror', 'panel double eb'],
    answerES: 'Paneles y EB (Edgeband): si hay 3 paneles seguidos en el diseño base, es un panel + uno con double EB. Mirror backing: lleva backing de 3/4" + espejo 1/4" (chequear en el diseño).',
    answerEN: 'Panels and EB (Edgeband): if there are 3 panels in a row in the base design, it\'s one panel + one with double EB. Mirror backing: carries 3/4" backing + 1/4" mirror (check the design).',
  },
  {
    section: '5.7',
    titleES: 'Alturas y Bore Holes',
    titleEN: 'Heights and Bore Holes',
    keywords: ['fixed shelf tall units', 'tabla de 32mm', '32mm table', 'bore holes alturas', 'bore hole heights'],
    answerES: 'Alturas y Bore Holes: al hacer ingeniería, chequear las alturas de fixed shelf en tall units — deben coincidir siempre con las alturas de la tabla de 32mm y, por lo tanto, con los bore holes.',
    answerEN: 'Heights and Bore Holes: when doing engineering, check fixed shelf heights in tall units — they must always match the 32mm table heights, and therefore the bore holes.',
  },
  {
    section: '5.8',
    titleES: 'Spanners en Paredes con Diagonales',
    titleEN: 'Spanners on Walls with Diagonals',
    keywords: ['spanner pared diagonal', 'spanner diagonal wall', 'top cabinets pared diagonal'],
    answerES: 'Spanners en Paredes con Diagonales: los spanners entre módulos de base y los top cabinets en paredes con diagonales se hacen rectos y grandes, para que ajusten en el lugar.',
    answerEN: 'Spanners on Walls with Diagonals: the spanners between base modules and top cabinets on walls with diagonals are made straight and large, so they fit in place.',
  },
  {
    section: '5.9',
    titleES: 'Corner Units y Lazy Susan',
    titleEN: 'Corner Units and Lazy Susan',
    keywords: ['corner unit', 'lazy susan', 'cams cara compartida', 'shared face cams', 'gelfman fillers en l', 'l shaped fillers', 'dos puertas a 90 sin lazy susan', 'two doors at 90 without lazy susan'],
    answerES: 'Corner Units y Lazy Susan: los shelves de una corner unit deben tener cams en la cara compartida con el otro lado: 1 1/2" del front y 2 1/4" del back. Lazy Susan: queda tocando justo entre puertas — 3/4" en vacío entre ambas puertas, tocando en la punta a 90°. Casos con dos puertas a 90° sin Lazy Susan (ej. Gelfman): dejar fillers en forma de L para que ambas puertas abran, mínimo 1 1/2" de cada lado.',
    answerEN: 'Corner Units and Lazy Susan: shelves in a corner unit must have cams on the face shared with the other side: 1 1/2" from the front and 2 1/4" from the back. Lazy Susan: sits touching right between the doors — 3/4" of gap between both doors, touching at the tip at 90°. Cases with two doors at 90° without a Lazy Susan (e.g. Gelfman): leave L-shaped fillers so both doors can open, minimum 1 1/2" on each side.',
  },
  {
    section: '5.10',
    titleES: 'Cajones Desfasados',
    titleEN: 'Offset Drawers',
    keywords: ['cajones desfasados', 'offset drawers', 'cajones desalineados', 'misaligned drawers', 'slanted drawer frentes en la instalacion', 'slanted fronts installed on site'],
    answerES: 'Cajones Desfasados: cajones desfasados / desalineados / slanted — indicar en el ESS que los frentes se colocan en la instalación.',
    answerEN: 'Offset Drawers: offset / misaligned / slanted drawers — note in the ESS that the fronts are attached during installation.',
  },
  {
    section: '5.11',
    titleES: 'Shelf de Vidrio sobre Cajones',
    titleEN: 'Glass Shelf Above Drawers',
    keywords: ['shelf de vidrio arriba de cajones', 'glass shelf above drawers', 'fixed arriba del top drawer', 'fixed shelf above top drawer', 'molding de soporte correderas', 'support molding for slides', 'celat frente y fondo', 'cleat front and back'],
    answerES: 'Shelf de Vidrio sobre Cajones: si hay un shelf de vidrio arriba de cajones, el fixed que iba arriba del top drawer se mueve abajo del primer cajón para tapar el resto. Considerar un molding de soporte que tape las correderas. Se puede colocar un celat al frente y uno al fondo como soporte (2 3/4" D x 3/4" H).',
    answerEN: 'Glass Shelf Above Drawers: if there is a glass shelf above drawers, the fixed shelf that used to sit above the top drawer moves below the first drawer to cover the rest. Consider a support molding to cover the slides. A cleat can be placed at the front and one at the back as support (2 3/4" D x 3/4" H).',
  },
  {
    section: '5.12',
    titleES: 'Fillers de 1 1/2"',
    titleEN: '1 1/2" Fillers',
    keywords: ['filler de 1 1/2', '1 1/2 inch filler', 'dos piezas de 3/4 w x 5 5/8 d', 'two pieces 3/4 w x 5 5/8 d', 'filler como una sola unidad', 'filler as a single unit'],
    answerES: 'Fillers: si hay un filler de 1 1/2" se produce como dos piezas de 3/4" W x 5 5/8" D, pero se indica como una sola unidad para que al instalar lo vean como una pieza en los drawings.',
    answerEN: 'Fillers: a 1 1/2" filler is produced as two pieces of 3/4" W x 5 5/8" D, but it\'s listed as a single unit so installers see it as one piece in the drawings.',
  },
  {
    section: '6.1',
    titleES: 'Códigos de Producto (Zoho)',
    titleEN: 'Product Codes (Zoho)',
    keywords: ['codigo de producto no estandar', 'non standard product code', 'zoho accessories sheet', 'codigo de zoho en el ess', 'zoho code in ess'],
    answerES: 'Códigos de Producto: los códigos de productos no estándar se buscan en el Zoho o accessories sheet. Si tiene código, nunca es estándar. El código de Zoho siempre va en el ESS.',
    answerEN: 'Product Codes: codes for non-standard products are looked up in Zoho or the accessories sheet. If it has a code, it is never standard. The Zoho code always goes in the ESS.',
  },
  {
    section: '6.2',
    titleES: 'Top Molding e Indicaciones de Color',
    titleEN: 'Top Molding and Color Notes',
    keywords: ['top molding color distinto al room', 'top molding different color than room', 'indicar color y altura del top molding en ess', 'note top molding color and height in ess', 'top molding 2 3/4 h white 300'],
    answerES: 'Top Molding e Indicaciones de Color: si el top molding no es del mismo color que el room, indicarlo en IP y ESS. En el ESS, indicar color y altura del top molding.\nEjemplo: Top molding 2 3/4" H white 300',
    answerEN: 'Top Molding and Color Notes: if the top molding isn\'t the same color as the room, note it in the IP and ESS. In the ESS, indicate the top molding\'s color and height.\nExample: Top molding 2 3/4" H white 300',
  },
  {
    section: '6.3',
    titleES: 'Knobs y Tiradores',
    titleEN: 'Knobs and Pulls',
    keywords: ['knob tirador ess', 'knob pull in ess', 'ultimo casillero de drawers', 'last drawer slot'],
    answerES: 'Knobs y Tiradores: el knob (tirador) se indica en el ESS, en las puertas donde vaya y en el último casillero de drawers.',
    answerEN: 'Knobs and Pulls: the knob is noted in the ESS, on the doors where it goes and on the last drawer slot.',
  },
  {
    section: '6.4',
    titleES: 'Edgeband (EB) en Backing',
    titleEN: 'Edgeband (EB) on Backing',
    keywords: ['eb backing', '4s eb 2s eb', 'eb all panels and shelves'],
    answerES: 'Edgeband (EB) en Backing: si el backing lleva EB, indicarlo así: "EB backing #38 (4S EB), #78 (2S EB)". Si hay EB en general: "EB all panels and shelves front and back".',
    answerEN: 'Edgeband (EB) on Backing: if the backing has EB, note it like this: "EB backing #38 (4S EB), #78 (2S EB)". If there\'s EB in general: "EB all panels and shelves front and back".',
  },
  {
    section: '6.5',
    titleES: 'Formato de Puertas en ESS',
    titleEN: 'Door Format in ESS',
    keywords: ['formato de puertas en ess', 'door format in ess', 'natura slab door', 'hinges handle type ess'],
    answerES: 'Formato de Puertas en ESS: con puertas de cualquier estilo, indicar color, tipo, hinges y handle type.\nEjemplo: NATURA Slab Door (color y tipo), S/C (soft close) half overlay, Finger Pull 3" Matte Nickel\n2) 16 3/4" W x 28 3/4" H',
    answerEN: 'Door Format in ESS: for doors of any style, indicate color, type, hinges, and handle type.\nExample: NATURA Slab Door (color and type), S/C (soft close) half overlay, Finger Pull 3" Matte Nickel\n2) 16 3/4" W x 28 3/4" H',
  },
  {
    section: '6.6',
    titleES: 'Base Molding',
    titleEN: 'Base Molding',
    keywords: ['base molding unir', 'base molding join', 'seccion miscellaneous ess', 'miscellaneous section ess'],
    answerES: 'Base Molding: ver si figura como "unir" para agregarlo al ESS, en la sección Miscellaneous.',
    answerEN: 'Base Molding: check if it\'s marked "join" to add it to the ESS, in the Miscellaneous section.',
  },
  {
    section: '6.7',
    titleES: 'Criterio para Dividir ESS',
    titleEN: 'Criteria for Splitting the ESS',
    keywords: ['dividir ess', 'split ess', 'combinaciones de color por cuarto', 'color combinations per room', 'cuarto interior white classic 300', 'ess separados por color', 'separate ess by color'],
    answerES: 'Criterio para Dividir ESS: se divide en ESS distintos según combinaciones de color por cuarto. Ejemplo: si un cuarto tiene interior White Classic 300 y frentes Sand Linen, y un segundo cuarto tiene interior y frentes en un solo color Sand Linen, se generan dos ESS separados. Un tercer cuarto solo en white generaría un tercer ESS — manteniendo todo prolijamente dividido.',
    answerEN: 'Criteria for Splitting the ESS: it\'s split into separate ESS documents based on color combinations per room. Example: if one room has White Classic 300 interior and Sand Linen fronts, and a second room has interior and fronts in a single Sand Linen color, two separate ESS docs are generated. A third room in white only would generate a third ESS — keeping everything neatly divided.',
  },
  {
    section: '6.8',
    titleES: 'Nomenclatura de Archivos',
    titleEN: 'File Naming',
    keywords: ['nomenclatura de archivos', 'file naming', 'ip ess kcd drawings nombre del proyecto', 'so number project name fecha'],
    answerES: 'Nomenclatura de Archivos:\n• IP / ESS / KCD Drawings_(nombre del proyecto en Zoho)\n• File: SO Number_Project Name (Zoho)_Fecha (MM-DD-YY)',
    answerEN: 'File Naming:\n• IP / ESS / KCD Drawings_(project name in Zoho)\n• File: SO Number_Project Name (Zoho)_Date (MM-DD-YY)',
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

  // Long, unrelated paragraphs shouldn't trigger a manual answer just
  // because 2 of their many words happen to overlap with some keyword
  // vocabulary. Require both an absolute floor (>=2 matches) AND a minimum
  // match ratio relative to the query's meaningful word count, so a 40-word
  // rant needs far more than 2 coincidental hits to qualify.
  const MIN_ABSOLUTE_SCORE = 2;
  const MIN_MATCH_RATIO = 0.35;

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
  }).filter(s => s.score >= MIN_ABSOLUTE_SCORE && (s.score / queryWords.length) >= MIN_MATCH_RATIO);

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.entry);
}
