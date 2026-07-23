// Static structure (section order + stable item IDs) for the Engineering
// Checklist. Item display text is bilingual and lives in translations.js
// under myProjects.checklists.<sectionKey> (array of strings, index-aligned
// with the `items` arrays below). IDs are stable strings (not array indexes)
// so that inserting/reordering items in translations.js later won't shift
// which items a previously-saved checked state maps to.

export const CHECKLIST_SECTIONS = [
  {
    key: 'general',
    items: ['gen-1', 'gen-2', 'gen-3', 'gen-4', 'gen-5']
  },
  {
    key: 'finalMeasurements',
    items: ['fm-1', 'fm-2', 'fm-3']
  },
  {
    key: 'engineering',
    items: Array.from({ length: 35 }, (_, i) => `eng-${i + 1}`)
  },
  {
    key: 'ess_ip',
    items: ['essip-1', 'essip-2', 'essip-3', 'essip-4', 'essip-5', 'essip-6']
  },
  {
    key: 'final',
    // Item 3 ("Check that all accessories are accounted for:") has 4 nested
    // sub-items (final-3a..d), mirroring the source list's indentation.
    items: [
      'final-1', 'final-2', 'final-3',
      'final-3a', 'final-3b', 'final-3c', 'final-3d',
      'final-4', 'final-5', 'final-6', 'final-7', 'final-8', 'final-9', 'final-10'
    ],
    nestedUnder: { 'final-3a': 'final-3', 'final-3b': 'final-3', 'final-3c': 'final-3', 'final-3d': 'final-3' }
  }
];

export const CHECKLIST_TOTAL_ITEMS = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
