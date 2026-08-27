// Arbol inicial de la base en memoria del modo demo (la puerta esta en firebase.js).
//
// Los nombres de ingenieros y disenadores son los reales porque las listas
// canonicas (engineers.js, designers.js) los usan para matchear; todo lo demas
// —SOs, clientes, notas— es inventado.

import { ENGINEERS } from './engineers';

// El usuario con el que se entra. Es ingeniero aprobado, asi que ve todo salvo
// las pantallas de super admin.
export const DEMO_USER = {
  uid: 'demo-luis',
  email: 'luis@jlclosets.com',
  displayName: 'Luis',
};

const UIDS = {
  Andres: 'demo-andres',
  Delfina: 'demo-delfina',
  Joaquin: 'demo-joaquin',
  Jose: 'demo-jose',
  Josema: 'demo-josema',
  Julieta: 'demo-julieta',
  Luis: DEMO_USER.uid,
  Santiago: 'demo-santiago',
};

const iso = (daysFromNow, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const installDate = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

const PROJECTS = [
  { so: '12480', name: 'Perez Residence',   eng: 'Luis',     status: 'NESTING',     install: 6 },
  { so: '12511', name: 'Lopez Penthouse',   eng: 'Santiago', status: 'CHECK',       install: 11 },
  { so: '12533', name: 'Aguilar Tower 14B', eng: 'Luis',     status: 'ON HOLD',     install: 18 },
  { so: '12547', name: 'Medina Guest Suite',eng: 'Julieta',  status: 'ENGINEERING', install: 24 },
  { so: '12562', name: 'Ferrer Master WIC', eng: 'Luis',     status: 'ENGINEERING', install: 31 },
  { so: '12408', name: 'Ibarra Loft',       eng: 'Jose',     status: 'Completed',   install: -12 },
];

// Forma exacta que devuelve sheetParser.parseCSV — si esto se desalinea, las
// vistas rompen. Ver el objeto `parsedData` en sheetParser.js.
const parsedData = {
  priorityAnalysis: PROJECTS.map(p => ({
    so: p.so,
    name: p.name,
    install: installDate(p.install),
    eng: p.eng,
    status: p.status,
    finalsScheduled: '',
    finalTaken: '',
  })),
  onHoldNotes: [
    { designer: 'Delfina Breton', project: 'Aguilar Tower 14B', note: 'Cliente definiendo herraje.' },
  ],
  weekOverWeek: [
    { metric: 'Projects Engineered', previous: '14', current: '17' },
    { metric: 'Projects Nested',     previous: '11', current: '13' },
    { metric: 'On Hold',             previous: '3',  current: '2'  },
  ],
  insights: { executive: '', weekly: '', actionPlan: '' },
  meetingPoints: [],
  topCostProjects: [
    { name: 'Lopez Penthouse',  cost: '$48,200' },
    { name: 'Perez Residence',  cost: '$31,750' },
  ],
  materialRequirements: PROJECTS.map(p => ({
    so: p.so,
    name: p.name,
    thermofoil: 'No',
    noHoles: 'No',
    dovetail: 'Yes',
    element: 'No',
    installDate: installDate(p.install),
  })),
  statusHistory: PROJECTS.map(p => ({
    so: p.so, name: p.name, status: p.status, statusDate: installDate(p.install - 20),
  })),
  weekLabels: { previous: 'AUGUST 17, 2026', current: 'AUGUST 24, 2026' },
  financialImpact: { description: '', rows: [] },
  alerts: { unassignedEngineer: null, pendingCheckReview: null },
};

const notes = {
  '12480': {
    n_1: { id: 'n_1', text: 'Medidas finales entregadas, todo OK.', noteType: 'normal', priority: false, createdAt: iso(-3, 11), createdBy: 'Julieta' },
    n_2: { id: 'n_2', text: 'Cliente pidio sumar un cajon XL en el walk-in principal.', noteType: 'normal', priority: false, createdAt: iso(-1, 17), createdBy: 'Luis' },
    n_3: { id: 'n_3', text: 'Confirmar el color del edgeband antes de mandar a CNC. Lo miras vos?', noteType: 'priority', priority: true, createdAt: iso(0, 9), createdBy: 'Santiago' },
  },
  '12511': {
    n_4: { id: 'n_4', text: 'Quote actualizado con los tres ambientes.', noteType: 'normal', priority: false, createdAt: iso(-2, 15), createdBy: 'Jose' },
    n_5: { id: 'n_5', text: 'Falta la firma en los planos. Necesito que lo revises antes del jueves.', noteType: 'designer', priority: false, urgency: 'yellow', createdAt: iso(0, 8), createdBy: 'Julieta' },
  },
  '12533': {
    n_6: { id: 'n_6', text: 'On hold hasta que el cliente decida el herraje.', noteType: 'normal', priority: false, createdAt: iso(-4, 10), createdBy: 'Luis' },
  },
};

// Dos tags sin leer para Luis (uno en un proyecto propio, otro en uno ajeno,
// para que se vea el ruteo condicional del click en la campana) y uno ya leido
// que muestra el check en el chip.
const project_tags = {
  '12480': {
    tg_1: {
      id: 'tg_1', noteId: 'n_3', so: '12480',
      taggedUid: UIDS.Luis, taggedName: 'Luis',
      taggedByUid: UIDS.Santiago, taggedByName: 'Santiago',
      createdAt: iso(0, 9), readAt: null,
    },
    tg_2: {
      id: 'tg_2', noteId: 'n_2', so: '12480',
      taggedUid: UIDS.Santiago, taggedName: 'Santiago',
      taggedByUid: UIDS.Luis, taggedByName: 'Luis',
      createdAt: iso(-1, 17), readAt: iso(-1, 18),
    },
  },
  '12511': {
    tg_3: {
      id: 'tg_3', noteId: 'n_5', so: '12511',
      taggedUid: UIDS.Luis, taggedName: 'Luis',
      taggedByUid: UIDS.Julieta, taggedByName: 'Julieta',
      createdAt: iso(0, 8), readAt: null,
    },
  },
};

// Los ocho registrados: el punto de la demo es que el selector se pueda usar,
// que es justo lo que en produccion todavia no pasa.
const engineer_directory = Object.fromEntries(
  ENGINEERS.map(name => [UIDS[name], { name, updatedAt: iso(-5) }])
);

export function buildDemoTree() {
  return {
    users: {
      [DEMO_USER.uid]: {
        email: DEMO_USER.email,
        designerName: 'Luis',
        role: 'engineer',
        status: 'approved',
        createdAt: iso(-120),
      },
    },

    engineer_directory,
    project_notes: notes,
    project_tags,

    project_designers: {
      '12480': 'Delfina Breton',
      '12511': 'Monica Gabriel',
      '12533': 'Delfina Breton',
      '12547': 'Nicole Dugan',
      '12562': 'Sarah Manev',
    },

    project_overrides: {},
    project_materials: {},
    project_history: {},
    project_stages: {},
    engineering_checks: {},
    nesting_checks: {},
    project_collaborators: {},
    project_kanban_state: {},
    project_kanban_order: {},
    calendar_notes: {},
    weekly_history: {},
    weekly_engineer_kpi: {},
    deleted_projects: {},
    archive: { completed_projects: {} },

    // El timestamp va deliberadamente en el futuro. isCacheFresh() compara
    // `Date.now() - timestamp < 5 min`, asi que una fecha futura da un elapsed
    // negativo y el cache nunca vence. Sin esto, a los cinco minutos App.jsx
    // saldria a buscar la planilla de Google REAL y reemplazaria los datos de
    // la demo por los de produccion, justo lo que este modo quiere evitar.
    firebase_cache: {
      data: { timestamp: iso(365 * 20), parsedData },
      meta: { timestamp: iso(365 * 20), version: 'demo' },
    },
  };
}
