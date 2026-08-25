// @vitest-environment jsdom
//
// Test de CABLEADO de App.jsx: el unico que cruza App y una vista.
//
// Existe por un defecto concreto que ningun test ni ninguna review por tarea
// atrapo: el modal de respuesta se montaba al hacer click en la notificacion de
// tag y se DESMONTABA ~250 ms despues, porque el `focusedNote` de la vista se
// gateaba en `focusedProjectSo` y el efecto de foco de la tarjeta llama a
// `clearFocusedProjectSo()` con un timer de 250 ms. Cada mitad estaba bien por
// separado; el hueco vivia en la costura.
//
// De ahi la asercion central: el modal sigue montado DESPUES de correr los
// timers.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';

// ── Fixture de RTDB ────────────────────────────────────────────────────────
// vi.hoisted porque las factories de vi.mock se izan por encima de todo lo
// demas del modulo.
const fb = vi.hoisted(() => {
  const nodes = {};
  const subs = [];
  const snap = (path) => ({
    exists: () => nodes[path] !== undefined && nodes[path] !== null,
    val: () => (nodes[path] === undefined ? null : nodes[path]),
    key: path.split('/').pop(),
  });
  return { nodes, subs, snap, user: { current: null } };
});

vi.mock('./utils/firebase', () => ({
  db: {},
  auth: {},
  initError: null,
  isConfigured: true,
  ref: (_db, path) => ({ path }),
  onValue: (r, cb) => {
    const entry = { path: r.path, cb };
    fb.subs.push(entry);
    // Emision sincronica al suscribirse, como hace RTDB con la cache local.
    cb(fb.snap(r.path));
    return () => {
      const i = fb.subs.indexOf(entry);
      if (i >= 0) fb.subs.splice(i, 1);
    };
  },
  get: vi.fn(async (r) => fb.snap(r.path)),
  set: vi.fn(async () => {}),
  update: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  child: (r, p) => ({ path: `${r.path}/${p}` }),
  push: vi.fn(),
  runTransaction: vi.fn(),
  onAuthStateChanged: (_auth, cb) => {
    cb(fb.user.current);
    return () => {};
  },
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  authHeaders: vi.fn(async () => ({})),
}));

// El sheet no se toca: useQuery devuelve el fixture directo. Se conserva el
// resto del modulo real para que QueryClientProvider siga existiendo.
const query = vi.hoisted(() => ({ dashboard: null, master: [] }));
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQuery: ({ queryKey }) => ({
      data: queryKey[0] === 'masterSchedule' ? query.master : query.dashboard,
      isLoading: false,
      error: null,
    }),
  };
});

// Ruido fuera del cableado que se esta probando: uno anima con timers propios
// y el otro arrastra el cliente de LLM entero.
vi.mock('./components/IntroSplash', () => ({ default: () => null }));
vi.mock('./components/ProjectChatbot', () => ({ default: () => null }));

import App from './App';
import { LanguageProvider } from './utils/LanguageContext';
import { ThemeProvider } from './utils/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Santiago es el tageado; el proyecto es de Julieta, asi que
// tagAlertDestination manda a Pipeline (My Projects no lo mostraria).
const SO = '12480';
const NOTE_KEY = 'n-1';

const seed = () => {
  fb.user.current = { uid: 'u-santi', email: 'santi@example.com', displayName: 'Santiago' };
  fb.nodes['users/u-santi'] = {
    email: 'santi@example.com',
    designerName: 'Santiago',
    role: 'engineer',
    status: 'approved',
  };
  fb.nodes['project_notes'] = {
    [SO]: {
      [NOTE_KEY]: {
        id: NOTE_KEY,
        text: 'revisar las medidas del closet principal',
        createdBy: 'Julieta',
        createdAt: '2026-08-24T10:00:00.000Z',
      },
    },
  };
  fb.nodes['project_tags'] = {
    [SO]: {
      'tg-1': {
        id: 'tg-1',
        noteId: NOTE_KEY,
        so: SO,
        taggedUid: 'u-santi',
        taggedName: 'Santiago',
        taggedByUid: 'u-juli',
        taggedByName: 'Julieta',
        createdAt: '2026-08-24T10:05:00.000Z',
        readAt: null,
      },
    },
  };
  fb.nodes['engineer_directory'] = {
    'u-santi': { name: 'Santiago', updatedAt: '2026-08-24T09:00:00.000Z' },
    'u-juli': { name: 'Julieta', updatedAt: '2026-08-24T09:00:00.000Z' },
  };
  fb.nodes['weekly_history'] = {};
  fb.nodes['project_designers'] = { [SO]: 'Ana' };

  query.dashboard = {
    priorityAnalysis: [
      { so: SO, name: 'Casa Lopez', eng: 'Julieta', status: 'ENGINEERING', install: '' },
    ],
    statusHistory: [],
    materialRequirements: [],
    topCostProjects: [],
    weekOverWeek: [],
    weekLabels: { previous: 'Prev', current: 'Curr' },
    archivedProjects: [],
    alerts: [],
  };
  query.master = [];
};

const renderApp = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  // jsdom no implementa scrollIntoView y el efecto de foco de la tarjeta lo
  // llama en cuanto corre su timer.
  Element.prototype.scrollIntoView = vi.fn();
  // clearAllMocks (no resetAllMocks) borra las llamadas sin tirar las
  // implementaciones del mock de firebase.
  vi.clearAllMocks();
  fb.subs.length = 0;
  Object.keys(fb.nodes).forEach(k => delete fb.nodes[k]);
  localStorage.clear();
  localStorage.setItem('active_tab', 'pipeline');
  localStorage.setItem('app_language', 'es');
  seed();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('cableado del flujo de tags (App + Pipeline)', () => {
  it('el click en la alerta de tag abre el modal Y sigue abierto pasado el timer de 250 ms', () => {
    vi.useFakeTimers();
    renderApp();

    // La campana lista la alerta de tag armada por buildTagAlerts.
    const bell = screen.getByRole('button', { name: /Notificaciones: 1 sin leer/i });
    fireEvent.click(bell);
    const alert = screen.getByText(/Julieta te taggeó en SO #12480/);

    fireEvent.click(alert);

    // Se abrio el modal sobre la nota exacta. Se acota al dialog porque el
    // texto de la nota tambien vive en el timeline de la tarjeta.
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Te taggearon en una nota/)).toBeInTheDocument();
    expect(within(dialog).getByText(/revisar las medidas del closet principal/)).toBeInTheDocument();

    // ESTA es la asercion que faltaba: el efecto de foco del proyecto corre su
    // timer de 250 ms y llama a clearFocusedProjectSo. Si el modal dependiera
    // de focusedProjectSo, aca ya no estaria.
    act(() => { vi.advanceTimersByTime(1000); });

    const stillOpen = screen.getByRole('dialog');
    expect(within(stillOpen).getByText(/revisar las medidas del closet principal/)).toBeInTheDocument();
  });

  it('marca el tag como leido al hacer click, sin que eso cierre el modal', async () => {
    const { set } = await import('./utils/firebase');
    vi.useFakeTimers();
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /Notificaciones: 1 sin leer/i }));
    fireEvent.click(screen.getByText(/Julieta te taggeó en SO #12480/));

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ path: `project_tags/${SO}/tg-1/readAt` }),
      expect.any(String)
    );

    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sin tags sin leer no hay campana de tag', () => {
    fb.nodes['project_tags'][SO]['tg-1'].readAt = '2026-08-24T11:00:00.000Z';
    renderApp();
    expect(screen.queryByText(/te taggeó en SO/)).not.toBeInTheDocument();
  });
});
