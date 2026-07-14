import { describe, it, expect } from 'vitest';
import {
  resolvesLocallyInIdleState,
  findLocalEntityMatches,
  findProjectMatchesForNote,
  isOnHoldQuery,
  isInstallQuery,
  findOnHoldProjects,
  findUpcomingInstalls,
} from './chatbotLocalMatch';
import { DESIGNER_CONTACTS } from './designerContacts';

// Realistic project fixtures mirroring the shape ProjectChatbot receives from
// the sheet (so, name, designer, eng, status). Chosen to include a project
// whose name literally contains an intent stopword ("Contact"), which is the
// exact false-positive class the stopword filter guards against.
const PROJECTS = [
  { so: '11801', name: 'Hale Residence', designer: 'Russell Reiner', eng: 'Julieta', status: 'Engineering' },
  { so: '11802', name: 'Prince Residence', designer: 'Natalie Ball', eng: 'Luis', status: 'Nesting' },
  { so: '11803', name: 'Perez Closet', designer: 'Melissa Barker', eng: 'Andres', status: 'ON HOLD' },
  { so: '11900', name: 'Contact Center Buildout', designer: 'Melissa Barker', eng: 'Luis', status: 'Engineering' },
  { so: '11950', name: 'Eindar Khant', designer: 'Russell Reiner', eng: 'Julieta', status: 'Completed' },
];

const resolvesLocally = (text) => resolvesLocallyInIdleState(text, { projects: PROJECTS, designerContacts: DESIGNER_CONTACTS });

describe('chatbotLocalMatch — queries that must resolve locally (never call Gemini)', () => {
  describe('bot commands', () => {
    it.each([
      'cancelar', 'cancel', 'CANCEL', '  cancel  ',
      'ayuda', 'help', '?', 'HELP',
    ])('command %j resolves locally', (text) => {
      expect(resolvesLocally(text)).toBe(true);
    });

    it.each([
      'agregar nota', 'add note', 'quiero agregar una nota', 'log a note', 'bitacora',
    ])('add-note trigger %j resolves locally', (text) => {
      expect(resolvesLocally(text)).toBe(true);
    });
  });

  describe('designer / engineer lookups', () => {
    it.each([
      ['how is russell', 'Russell Reiner'],
      ['proyectos de russell', 'Russell Reiner'],
      ['projects of natalie', 'Natalie Ball'],
      ['how is julieta', 'Julieta'],
      ['que tal luis', 'Luis'],
    ])('%j resolves locally and matches %j', (text) => {
      expect(resolvesLocally(text)).toBe(true);
    });
  });

  describe('project lookups (by name or SO)', () => {
    it.each([
      'how is perez', 'proyecto hale', 'project hale',
      '11801', '11803', 'how is eindar khant',
    ])('%j resolves locally', (text) => {
      expect(resolvesLocally(text)).toBe(true);
    });
  });

  describe('designer contact lookups — the bug this fix targets', () => {
    it.each([
      'natalie contact', 'contacto natalie', 'natalie telefono',
      'russell contact', 'contact for russell', 'russell phone',
      'contacto de melissa', 'melissa email',
    ])('%j resolves locally instead of falling through to Gemini', (text) => {
      expect(resolvesLocally(text)).toBe(true);
    });

    it('"russell contact" matches Russell Reiner as a contact, not the "Contact Center" project by the stopword alone', () => {
      const { options } = findLocalEntityMatches('russell contact', { projects: PROJECTS, designerContacts: DESIGNER_CONTACTS });
      const types = options.map(o => o.type);
      const projectNames = options.filter(o => o.type === 'project').map(o => o.data.name);
      expect(types).toContain('contact');
      expect(projectNames).not.toContain('Contact Center Buildout');
    });

    it('a bare intent word alone ("contact") matches nobody', () => {
      const { options } = findLocalEntityMatches('contact', { projects: PROJECTS, designerContacts: DESIGNER_CONTACTS });
      expect(options).toHaveLength(0);
    });
  });

  describe('ambiguous queries that produce a picker (still local, no Gemini call)', () => {
    it('"russell" matches both his contact card and his active projects', () => {
      const { options } = findLocalEntityMatches('russell', { projects: PROJECTS, designerContacts: DESIGNER_CONTACTS });
      const types = options.map(o => o.type).sort();
      expect(types).toEqual(['contact', 'designer']);
    });
  });

  describe('engineering-manual questions (answered locally from the manual, no Gemini)', () => {
    it.each([
      '¿cuál es el reveal de half overlay?',
      'what is the half overlay reveal?',
      'tamaño maximo de puerta',
      'clearance around sprinklers',
    ])('%j resolves locally', (text) => {
      expect(resolvesLocally(text)).toBe(true);
    });
  });
});

describe('chatbotLocalMatch — queries that must NOT resolve locally (fall through to Gemini)', () => {
  it.each([
    ['open-ended free text with no recognizable name', '¿cuántos proyectos hay en total?'],
    ['a name nobody has (no match at all)', 'how is zzznonexistent'],
    ['pure follow-up with no subject', '¿y su teléfono?'],
    ['a > 12 word paragraph (guarded off even if it contains a name)', 'estuve pensando bastante en como deberiamos reorganizar todo el proceso de instalacion para que russell no tenga tantos problemas la proxima semana'],
  ])('%s: %j does not resolve locally', (_label, text) => {
    expect(resolvesLocally(text)).toBe(false);
  });
});

describe('chatbotLocalMatch — quick-action chip payloads (handleChipClick in ProjectChatbot.jsx)', () => {
  // The chip handler sends fixed text through the exact same processInput/
  // resolvesLocallyInIdleState path as manual typing — there is no special
  // case for chips. "note" and "help" trigger command keywords ("nota"/"ayuda")
  // so they resolve locally; "hold" and "install" send generic status
  // questions with no designer/engineer/project/contact name in them, so they
  // are NOT caught by any local guard and fall through to Gemini.
  it('note chip ("Agregar nota" / "Add note") resolves locally', () => {
    expect(resolvesLocally('Agregar nota')).toBe(true);
    expect(resolvesLocally('Add note')).toBe(true);
  });

  it('help chip ("Ayuda" / "Help") resolves locally', () => {
    expect(resolvesLocally('Ayuda')).toBe(true);
    expect(resolvesLocally('Help')).toBe(true);
  });

  it('ON HOLD chip now resolves locally (aggregate-intent handler)', () => {
    expect(resolvesLocally('¿Qué proyectos están ON HOLD?')).toBe(true);
    expect(resolvesLocally('Which projects are ON HOLD?')).toBe(true);
  });

  it('Installations chip now resolves locally (aggregate-intent handler)', () => {
    expect(resolvesLocally('Instalaciones programadas')).toBe(true);
    expect(resolvesLocally('Installation dates')).toBe(true);
  });
});

describe('chatbotLocalMatch — add-note flow (AWAITING_PROJECT_FOR_NOTE step in ProjectChatbot.jsx)', () => {
  // ProjectChatbot's AWAITING_PROJECT_FOR_NOTE/AWAITING_NOTE_TEXT states each
  // `return` on every branch (cancel / no match / one match / many matches /
  // save success / save error) before the function ever reaches the Gemini
  // fallback at the bottom of processInput — structurally, once the state
  // machine is in either of those states, Gemini is unreachable regardless of
  // what the user types. findProjectMatchesForNote is the one piece of actual
  // matching logic in that flow, so it's what gets covered directly; the
  // AWAITING_NOTE_TEXT step takes arbitrary free text as the note body (no
  // matching at all) and always resolves via addProjectNote or its catch.
  it('finds a project by exact name fragment', () => {
    const matches = findProjectMatchesForNote('hale', PROJECTS);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Hale Residence');
  });

  it('finds a project by SO number', () => {
    const matches = findProjectMatchesForNote('11803', PROJECTS);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Perez Closet');
  });

  it('returns multiple matches when the fragment is ambiguous', () => {
    // "residence" appears in both Hale Residence and Prince Residence.
    const matches = findProjectMatchesForNote('residence', PROJECTS);
    expect(matches.map(m => m.name).sort()).toEqual(['Hale Residence', 'Prince Residence']);
  });

  it('returns no matches for an unrelated fragment (still resolved locally as "not found", no Gemini call)', () => {
    const matches = findProjectMatchesForNote('zzznonexistent', PROJECTS);
    expect(matches).toHaveLength(0);
  });

  it('does not crash on a numeric so field (String() coercion)', () => {
    const projectsWithNumericSo = [{ so: 11801, name: 'Hale Residence' }];
    expect(() => findProjectMatchesForNote('11801', projectsWithNumericSo)).not.toThrow();
    expect(findProjectMatchesForNote('11801', projectsWithNumericSo)).toHaveLength(1);
  });
});

describe('chatbotLocalMatch — ON HOLD & Installations intents (now resolved locally, no Gemini)', () => {
  // A wider fixture with install dates and varied statuses. REF is the fixed
  // "today" used for the install filter so the test is deterministic.
  const REF = new Date('2026-06-10T12:00:00.000Z');
  const PROJ = [
    { so: '1', name: 'Hale Residence', eng: 'Julieta', install: '2026-06-12', status: 'Engineering' },
    { so: '2', name: 'Prince Residence', eng: 'Luis', install: '2026-06-20', status: 'Nesting' },
    { so: '3', name: 'Perez Closet', eng: 'Andres', install: '2026-06-15', status: 'ON HOLD' },     // on hold -> excluded from installs
    { so: '4', name: 'Old Job', eng: 'Julieta', install: '2026-05-01', status: 'Engineering' },     // past -> excluded
    { so: '5', name: 'Done Deal', eng: 'Luis', install: '2026-06-18', status: 'Completed' },        // completed -> excluded
    { so: '6', name: 'No Date Job', eng: 'Andres', status: 'Engineering' },                          // no install -> excluded
    { so: '7', name: 'Paused Job', eng: 'Luis', install: '2026-06-14', status: 'on hold' },          // lowercase hold -> ON HOLD list
  ];

  describe('intent detection', () => {
    it.each([
      '¿Qué proyectos están ON HOLD?', 'Which projects are ON HOLD?', 'proyectos en espera', 'que esta en pausa',
    ])('isOnHoldQuery(%j) is true', (t) => expect(isOnHoldQuery(t)).toBe(true));

    it.each([
      'Instalaciones programadas', 'Installation dates', 'que instalaciones hay', 'upcoming installs',
    ])('isInstallQuery(%j) is true', (t) => expect(isInstallQuery(t)).toBe(true));

    it('a plain name query triggers neither aggregate intent', () => {
      expect(isOnHoldQuery('how is russell')).toBe(false);
      expect(isInstallQuery('how is russell')).toBe(false);
    });
  });

  describe('findOnHoldProjects', () => {
    it('returns every project whose status contains HOLD (case-insensitive)', () => {
      const held = findOnHoldProjects(PROJ).map(p => p.name).sort();
      expect(held).toEqual(['Paused Job', 'Perez Closet']);
    });

    it('returns empty when nothing is on hold', () => {
      expect(findOnHoldProjects([{ so: '1', name: 'X', status: 'Engineering' }])).toHaveLength(0);
    });
  });

  describe('findUpcomingInstalls', () => {
    it('returns future, non-hold, non-completed installs sorted soonest-first', () => {
      const installs = findUpcomingInstalls(PROJ, REF).map(p => p.name);
      // Hale (6-12), Prince (6-20) qualify. Perez(hold), Old Job(past),
      // Done Deal(completed), No Date, Paused Job(hold) all excluded.
      expect(installs).toEqual(['Hale Residence', 'Prince Residence']);
    });

    it('includes an install dated exactly today', () => {
      const todayProj = [{ so: '9', name: 'Today Job', install: '2026-06-10', status: 'Engineering' }];
      expect(findUpcomingInstalls(todayProj, REF).map(p => p.name)).toEqual(['Today Job']);
    });

    it('returns empty when no upcoming installs', () => {
      expect(findUpcomingInstalls([{ so: '1', name: 'Old', install: '2020-01-01', status: 'Engineering' }], REF)).toHaveLength(0);
    });
  });
});
