import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';
import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  BarElement,
  Legend,
  Tooltip,
  BarController,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { fetchAndParseQualityData } from '../utils/sheetParser';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import { db, ref, get, set } from '../utils/firebase';

ChartJS.register(LinearScale, CategoryScale, BarElement, Legend, Tooltip, BarController);

// Weeks of history the chart is sized for — bar width is capped so a single
// loaded week already renders at its "full capacity" width (see
// weeklyChartData's maxBarThickness) instead of stretching to fill the axis.
const WEEKLY_CHART_CAPACITY = 16;

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

// Muted, low-saturation palette so the weekly stacked bars stay readable and
// don't compete visually with the alert colors used elsewhere in this view
// (yellow/orange for under/over-allocated engineers).
const ENGINEER_PALETTE = [
  '#5B8CA8', '#7C9885', '#A0826D', '#8E7CC3',
  '#6B9B9E', '#B08968', '#7A8B99', '#94766B',
];

function colorForEngineer(name, index) {
  return ENGINEER_PALETTE[index % ENGINEER_PALETTE.length] || `hsl(${(index * 47) % 360}, 30%, 55%)`;
}

// ISO-week key so the same calendar week always maps to the same RTDB node,
// regardless of which day someone happens to load this view.
function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function shortWeekLabel(weekKey) {
  const [, week] = weekKey.split('-W');
  return `W${week}`;
}

// Los cuatro bloques por periodo de la hoja, del mas reciente al mas viejo (el
// mismo orden en que aparecen en el tab). `sheetSection` es el titulo que se
// busca ahi; `shortLabel` es el que va en la leyenda del grafico.
const PERIOD_TABLES = [
  { key: 'last30Days', sheetSection: 'KPI Last 30 Days', shortLabel: '0-30d' },
  { key: 'days31to60', sheetSection: 'KPI 31-60 Days', shortLabel: '31-60d' },
  { key: 'days61to90', sheetSection: 'KPI 61-90 Days', shortLabel: '61-90d' },
  { key: 'days91to120', sheetSection: 'KPI 91-120 Days', shortLabel: '91-120d' },
];

// Los periodos son una escala ordenada, no categorias sueltas, asi que van con
// una rampa de un solo tono (el cyan de la app) en vez de cuatro colores
// distintos: el periodo mas reciente es el mas prominente contra su fondo y se
// va apagando hacia el mas viejo. Cada modo tiene sus propios pasos — no es el
// mismo array invertido — y ambos pasan el validador de rampa ordinal
// (monotonia de luminosidad, salto >= 0.06 entre pasos, y el extremo palido
// por encima de 2:1 contra su superficie: #1C1C22 en dark, #FFFFFF en light).
const PERIOD_RAMP = {
  dark: ['#09D1C7', '#16A6A0', '#197F7C', '#1B5A59'],
  light: ['#0A5F5C', '#0D827D', '#12A39C', '#45C4BD'],
};

// Semantica de la "Workload Distribution Guide": amarillo por debajo del 10%,
// naranja por encima del 30%. El color nunca va solo — siempre lo acompania el
// badge con el texto — y en tema claro usa pasos oscurecidos, porque el
// #FFE600 de la guia sobre fondo blanco es practicamente invisible (1.1:1).
function workloadAlert(percent, isLight) {
  if (percent < 10) {
    return {
      color: isLight ? '#A16207' : '#FFE600',
      badgeBg: isLight ? 'rgba(161,98,7,0.12)' : 'rgba(255,230,0,0.1)',
      badge: '< 10% Low',
    };
  }
  if (percent > 30) {
    return {
      color: isLight ? '#C2410C' : '#FF9500',
      badgeBg: isLight ? 'rgba(194,65,12,0.12)' : 'rgba(255,149,0,0.1)',
      badge: '> 30% High',
    };
  }
  return { color: null, badgeBg: null, badge: null };
}

// Una de las tablas por periodo de la hoja (Last 30 Days / 31-60 Days) con las
// cuatro columnas de puntos. El titulo sale de la propia hoja, asi que el rango
// de fechas se mantiene solo cuando la hoja rota de mes.
function PeriodTable({ table, colors, isLight, emptyLabel }) {
  if (!table || table.rows.length === 0) {
    return <p style={{ color: colors.body, fontSize: '0.9rem', margin: 0 }}>{emptyLabel}</p>;
  }

  // Sin nowrap y con table-layout: fixed + anchos por columna, la tabla
  // respeta el 100% del contenedor sin importar el contenido — los headers
  // largos ("Revision Points") envuelven a dos lineas en vez de forzar un
  // ancho de columna mayor y disparar el scroll horizontal del wrapper.
  const th = { padding: '8px 8px', color: colors.accent, fontWeight: 600, wordBreak: 'break-word' };
  const td = { padding: '8px 8px', color: colors.body, wordBreak: 'break-word' };
  const colWidths = ['19%', '15%', '15%', '15%', '16%', '20%'];

  return (
    <div>
      <h5 style={{ color: colors.title, fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
        {table.title}
      </h5>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', color: colors.title, fontSize: '0.88rem' }}>
          <colgroup>
            {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <th style={th}>Engineer</th>
              <th style={th}>Own Points</th>
              <th style={th}>Revision Points</th>
              <th style={th}>Nesting Points</th>
              <th style={th}>Total KPI</th>
              <th style={th}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => {
              const alert = workloadAlert(row.percentOfTotal, isLight);
              return (
                <tr
                  key={index}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  // Los SOs que sumaron en el periodo (columna F de la hoja) no
                  // entran como columna propia, pero sirven para auditar una fila.
                  title={row.projects ? `SO: ${row.projects}` : undefined}
                >
                  <td style={{ ...td, color: colors.title }}>{row.engineer}</td>
                  <td style={td}>{formatCurrency(row.ownPoints)}</td>
                  <td style={td}>{formatCurrency(row.revisionPoints)}</td>
                  <td style={td}>{formatCurrency(row.nestingPoints)}</td>
                  <td style={{ ...td, fontWeight: 'bold', color: '#09D1C7' }}>{formatCurrency(row.totalKPI)}</td>
                  {/* Umbrales de la Workload Distribution Guide. El color no va
                      solo: cuando hay alerta la acompania el badge con el
                      texto, para que no dependa de distinguir tonos. */}
                  <td style={{ ...td, fontWeight: 600, color: alert.color || colors.title }}>
                    <div>{row.percentOfTotal.toFixed(1)}%</div>
                    {alert.badge && (
                      <span style={{ display: 'inline-block', fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: alert.badgeBg, color: alert.color, marginTop: '4px', fontWeight: 500 }}>
                        {alert.badge}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <td style={{ ...td, color: colors.muted, fontWeight: 600 }}>Total</td>
              <td style={td} colSpan={3}></td>
              <td style={{ ...td, color: colors.muted, fontWeight: 600 }}>{formatCurrency(table.periodTotal)}</td>
              {/* Un periodo entero en cero (todos ON HOLD, por ejemplo) deja
                  los porcentajes en 0: el pie no puede afirmar 100%. */}
              <td style={{ ...td, color: colors.muted, fontWeight: 600 }}>
                {table.periodTotal > 0 ? '100.0%' : '0.0%'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function DesignQualityView() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Colors were hardcoded for a dark background (#fff titles, #94A3B8 body),
  // leaving titles and engineer names nearly invisible in light theme.
  const C = {
    title: isLight ? '#0f172a' : '#fff',
    body: isLight ? '#475569' : '#94A3B8',
    muted: isLight ? '#64748b' : '#64748B',
    accent: isLight ? '#0f766e' : '#80EE98',
  };
  const [data, setData] = useState({
    kpiData: [],
    last30Days: null,
    days31to60: null,
    days61to90: null,
    days91to120: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [weeklyEngineerHistory, setWeeklyEngineerHistory] = useState([]);

  // Sin esto, la pagina de fondo seguia siendo scrolleable con el modal
  // abierto: su propia scrollbar nativa (del viewport, no la del modal) se
  // dibujaba encima del overlay fixed, sobresaliendo por fuera de las
  // esquinas redondeadas del cuadro — eso es lo que se veia "por fuera".
  useEffect(() => {
    if (!showGuide) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [showGuide]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const parsed = await fetchAndParseQualityData();
        setData(parsed);
      } catch (err) {
        console.error('Error fetching quality data:', err);
        setError('Error loading quality data. Ensure the Google Sheet is accessible.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Save this week's per-engineer KPI % as a snapshot (once per calendar
  // week — same dedupe pattern as App.jsx's weekly_history), then load the
  // recent history so the distribution can be charted over time instead of
  // only showing the current snapshot.
  useEffect(() => {
    if (!db || data.kpiData.length === 0) return;

    const weekKey = isoWeekKey();

    async function saveAndLoadWeeklyEngineerHistory() {
      try {
        const snapRef = ref(db, `weekly_engineer_kpi/${weekKey}`);
        const snap = await get(snapRef);
        if (!snap.exists()) {
          const percentages = {};
          data.kpiData.forEach(row => { percentages[row.engineer] = row.percent || 0; });
          await set(snapRef, { savedAt: new Date().toISOString(), percentages });
        }

        const historyRef = ref(db, 'weekly_engineer_kpi');
        const historySnap = await get(historyRef);
        if (historySnap.exists()) {
          const allWeeks = historySnap.val();
          const weeksArray = Object.entries(allWeeks)
            .map(([key, val]) => ({ key, ...val }))
            .sort((a, b) => a.key.localeCompare(b.key));
          setWeeklyEngineerHistory(weeksArray.slice(-WEEKLY_CHART_CAPACITY));
        }
      } catch (err) {
        console.error('Error managing weekly engineer KPI history:', err);
      }
    }

    saveAndLoadWeeklyEngineerHistory();
  }, [data.kpiData]);

  const weeklyChartData = useMemo(() => {
    if (weeklyEngineerHistory.length === 0) return null;

    const engineers = Array.from(
      new Set(weeklyEngineerHistory.flatMap(w => Object.keys(w.percentages || {})))
    ).sort();
    if (engineers.length === 0) return null;

    return {
      labels: weeklyEngineerHistory.map(w => shortWeekLabel(w.key)),
      datasets: engineers.map((engineer, index) => ({
        label: engineer,
        data: weeklyEngineerHistory.map(w => w.percentages?.[engineer] ?? 0),
        backgroundColor: colorForEngineer(engineer, index),
        borderRadius: 3,
        stack: 'engineers',
        // Cap each bar at 1/WEEKLY_CHART_CAPACITY of the plotted width so a
        // single loaded week renders at the same width it will have once
        // all WEEKLY_CHART_CAPACITY weeks are present, instead of Chart.js's
        // default of stretching the lone category to fill the axis.
        maxBarThickness: (ctx) => (ctx.chart.chartArea?.width || 0) / WEEKLY_CHART_CAPACITY,
      })),
    };
  }, [weeklyEngineerHistory]);

  const weeklyChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: C.body, font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 8 },
      },
      tooltip: {
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(11, 21, 32, 0.95)',
        titleColor: C.accent,
        bodyColor: isLight ? '#0f172a' : '#fff',
        borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false, drawBorder: false },
        ticks: { color: C.body, font: { size: 11 } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)', drawBorder: false },
        ticks: { color: C.muted, callback: (v) => `${v}%` },
      },
    },
    // isLight drives the chart's text/grid colors, so recompute on theme change.
  }), [isLight]);

  // Un ingeniero por grupo, una barra por periodo: es la misma matriz que las
  // cuatro tablas de abajo, leida de corrido. Los ingenieros salen de la union
  // de las tablas presentes (alguien puede no figurar en un periodo viejo) y en
  // ese caso su barra va en 0, no se saltea la posicion.
  const periodShareChartData = useMemo(() => {
    const present = PERIOD_TABLES
      .map(period => ({ ...period, table: data[period.key] }))
      .filter(period => period.table?.rows.length > 0);
    if (present.length === 0) return null;

    const engineers = [...new Set(present.flatMap(p => p.table.rows.map(r => r.engineer)))];
    const ramp = PERIOD_RAMP[isLight ? 'light' : 'dark'];

    return {
      labels: engineers,
      datasets: present.map((period, index) => ({
        label: period.shortLabel,
        data: engineers.map(name => {
          const row = period.table.rows.find(r => r.engineer === name);
          return row ? row.percentOfTotal : 0;
        }),
        // El color sigue al periodo, no a su posicion entre los presentes: si
        // la hoja pierde un bloque, los que quedan no se repintan.
        backgroundColor: ramp[PERIOD_TABLES.findIndex(p => p.key === period.key)] ?? ramp[index],
        borderRadius: 4,
        // Deja ~2px de superficie entre barras vecinas y aire entre grupos.
        categoryPercentage: 0.7,
        barPercentage: 0.86,
      })),
    };
  }, [data, isLight]);

  const periodShareChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: C.body, font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 12 },
      },
      tooltip: {
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(11, 21, 32, 0.95)',
        titleColor: C.accent,
        bodyColor: isLight ? '#0f172a' : '#fff',
        borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: C.body, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)', drawBorder: false },
        ticks: { color: C.muted, callback: (v) => `${v}%` },
      },
    },
    // Los C.* son strings derivados de isLight, asi que listarlos no dispara
    // recalculos de mas y deja el hook honesto frente a exhaustive-deps.
  }), [isLight, C.accent, C.body, C.muted]);

  if (loading) {
    return <div className="loading-state text-muted" style={{ padding: '24px', color: C.body }}>Loading Team Stats...</div>;
  }

  if (error) {
    return <div className="error-state text-danger" style={{ padding: '24px', color: '#FF2E93' }}>{error}</div>;
  }

  // `kpiData` (el bloque acumulado "% of Total") ya no se muestra, pero sigue
  // alimentando el snapshot semanal de RTDB y con eso el grafico de evolucion,
  // asi que cuenta como contenido: la vista solo esta vacia si tampoco hay
  // ninguna tabla por periodo.
  const hasPeriodData = PERIOD_TABLES.some(({ key }) => data[key]?.rows.length > 0);
  const isEmpty = !hasPeriodData && data.kpiData.length === 0;

  return (
    <div className="design-quality-view animate-fade-in" style={{ padding: '24px' }}>
      <header className="dashboard-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 600, color: C.title, marginBottom: '8px' }}>Team Stats</h1>
        <p className="page-subtitle text-muted" style={{ color: C.body }}>KPI Distribution Analysis</p>
      </header>

      {isEmpty ? (
        <div className="glass-card text-muted" style={{ padding: '24px', color: C.body }}>
          No data found in the spreadsheet tab.
        </div>
      ) : (
        <>
          <div className="glass-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ color: C.title, marginBottom: '20px', fontSize: '1.25rem', fontWeight: 600 }}>KPI Distribution Analysis</h3>

            {/* A todo el ancho de la tarjeta, arriba de las tablas: es el
                resumen y ellas son el detalle (y el "table view" accesible de
                los mismos numeros). */}
            {periodShareChartData && (
              <div style={{ marginBottom: '32px' }}>
                <h5 style={{ color: C.title, fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  {language === 'es' ? '% del Total por Período' : '% of Total by Period'}
                </h5>
                <p style={{ color: C.muted, fontSize: '0.78rem', margin: '0 0 12px 0' }}>
                  {language === 'es'
                    ? 'Participación de cada ingeniero en el Total KPI de cada ventana. Cada período suma 100% por separado.'
                    : "Each engineer's share of the period's Total KPI. Every period adds up to 100% on its own."}
                </p>
                <div style={{ height: '300px' }}>
                  <Bar data={periodShareChartData} options={periodShareChartOptions} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* minWidth: 0 para que el overflow-x de cada tabla actue dentro
                  de la columna en vez de estirar el flex container. */}
              <div style={{ flex: '2 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '28px' }}>
                {PERIOD_TABLES.map(({ key, sheetSection }) => (
                  <PeriodTable
                    key={key}
                    table={data[key]}
                    colors={C}
                    isLight={isLight}
                    emptyLabel={language === 'es'
                      ? `La hoja no tiene la seccion "${sheetSection}".`
                      : `The sheet has no "${sheetSection}" section.`}
                  />
                ))}
              </div>

              <div style={{ flex: '1 1 280px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {weeklyChartData ? (
                  <div>
                    <h5 style={{ color: C.title, fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                      {language === 'es' ? 'Evolución Semanal por Ingeniero' : 'Weekly Evolution by Engineer'}
                    </h5>
                    <div style={{ height: '220px' }}>
                      <Bar data={weeklyChartData} options={weeklyChartOptions} />
                    </div>
                  </div>
                ) : (
                  <p style={{ color: C.body, lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
                    {language === 'es'
                      ? 'Aún no hay suficiente historial semanal para graficar la evolución. Volvé a revisar esta vista en las próximas semanas.'
                      : "Not enough weekly history yet to chart the evolution. Check back on this view in the coming weeks."}
                  </p>
                )}
                <div style={{ marginTop: '12px', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', background: 'var(--overlay-01)' }}>
                  <h5 style={{ color: C.title, fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                    {language === 'es' ? 'Guía de Distribución de Carga' : 'Workload Distribution Guide'}
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', lineHeight: '1.4' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FFE600', marginTop: '4px', flexShrink: 0 }}></div>
                      <span style={{ color: '#FFE600' }}>
                        {language === 'es'
                          ? 'Alerta Amarilla (< 10%): Se le debe asignar más proyectos al ingeniero para balancear la carga.'
                          : 'Yellow Alert (< 10%): More projects should be assigned to the engineer to balance workload.'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF9500', marginTop: '4px', flexShrink: 0 }}></div>
                      <span style={{ color: '#FF9500' }}>
                        {language === 'es'
                          ? 'Alerta Naranja (> 30%): Sobrecarga crítica. Se debe reducir la concentración de proyectos del ingeniero.'
                          : 'Orange Alert (> 30%): Critical overload. Reduce project concentration for this engineer.'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating Action Button + Guide Modal are portaled to <body> so their
          `position: fixed` is relative to the real viewport. Without the
          portal they inherit `.animate-fade-in`'s `will-change: transform`
          from this scrolling view as their containing block, which makes a
          "fixed" button drift with the view's scroll instead of the chatbot. */}
      {createPortal(
        <>
          <button
            onClick={() => setShowGuide(true)}
            style={{
              position: 'fixed',
              bottom: '105px',
              right: '24px',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#007BFF',
              color: '#fff',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0, 123, 255, 0.4)',
              border: 'none',
              cursor: 'pointer',
              zIndex: 1000
            }}
            title={language === 'es' ? 'Guía de Usuario' : 'User Guide'}
          >
            <HelpCircle size={28} />
          </button>

          {showGuide && (
            <div
              className="modal-overlay"
              onClick={() => setShowGuide(false)}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100000,
                display: 'flex', justifyContent: 'center', alignItems: 'center'
              }}
            >
              <div
                className="modal-content glass-card animate-fade-in"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '90%', maxWidth: '700px', maxHeight: '85vh',
                  overflowY: 'auto', padding: '32px', position: 'relative'
                }}
              >
                <button
                  onClick={() => setShowGuide(false)}
                  aria-label={language === 'es' ? 'Cerrar' : 'Close'}
                  style={{
                    position: 'absolute', top: '16px', right: '16px',
                    background: 'none', border: 'none', color: C.body, cursor: 'pointer'
                  }}
                >
                  <X size={24} />
                </button>
                <h2 style={{ color: C.title, marginBottom: '24px', fontSize: '1.5rem', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`, paddingBottom: '16px' }}>
                  {language === 'es' ? 'GUÍA DE USUARIO E INSTRUCCIONES' : 'DASHBOARD USER GUIDE & INSTRUCTIONS'}
                </h2>

                <div style={{ color: C.title, lineHeight: '1.6', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <h3 style={{ color: C.title, fontSize: '1.1rem', marginBottom: '8px' }}>
                      {language === 'es' ? '1. COLUMNAS EDITABLES Y RESTRICCIONES' : '1. EDITABLE COLUMNS & RESTRICTIONS'}
                    </h3>
                    <p>
                      {language === 'es'
                        ? "Las columnas editables son C, D, E, F, G, M, N, O y P. Contienen una fórmula que permite borrar la información del ingeniero asignado y la celda se regenera automáticamente. Estos son los únicos valores que se pueden editar en la tabla, el resto es automático."
                        : "Editable columns are C, D, E, F, G, M, N, O, and P. They contain a formula that allows you to delete the assigned engineer's information and the cell automatically regenerates. These are the only values that can be edited in the table, the rest is automatic."}
                    </p>
                  </div>

                  <div>
                    <h3 style={{ color: C.title, fontSize: '1.1rem', marginBottom: '8px' }}>
                      {language === 'es' ? '2. DISTRIBUCIÓN DE PUNTOS DE INGENIERÍA (Columnas C, D, E, F, G)' : '2. ENGINEERING POINTS DISTRIBUTION (Columns C, D, E, F, G)'}
                    </h3>
                    <p style={{ marginBottom: '8px' }}>
                      {language === 'es' ? "Estas columnas distribuyen los 'Puntos Propios' base (70% del total):" : "These columns distribute the base 'Own Points' (70% of total):"}
                    </p>
                    <ul style={{ paddingLeft: '20px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li>{language === 'es' ? 'Columna C (Revisión de Ing.): 10%' : 'Column C (Eng. Review): 10%'}</li>
                      <li>{language === 'es' ? 'Columna D (Ingeniería): 12%' : 'Column D (Eng. Engineering): 12%'}</li>
                      <li>{language === 'es' ? 'Columna E (Check Ingeniería): 12%' : 'Column E (Eng. Check Eng): 12%'}</li>
                      <li>{language === 'es' ? 'Columna F (Paperwork): 12%' : 'Column F (Eng. Paperwork): 12%'}</li>
                      <li>{language === 'es' ? 'Columna G (Check de Ing.): 24%' : 'Column G (Eng. Check): 24%'}</li>
                    </ul>
                  </div>

                  <div>
                    <h3 style={{ color: C.title, fontSize: '1.1rem', marginBottom: '8px' }}>
                      {language === 'es' ? '3. REVISORES Y NESTING (Columnas M, N, O, P)' : '3. REVIEWERS & NESTING (Columns M, N, O, P)'}
                    </h3>
                    <ul style={{ paddingLeft: '20px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li>{language === 'es' ? 'Columnas M, N, O (Revisores 1, 2, 3): Comparten un 5% de pool de Revisión. Los puntos se dividen equitativamente entre los revisores listados.' : 'Columns M, N, O (Reviewers 1, 2, 3): Share a 5% Revision pool. Points are divided equally among the listed reviewers.'}</li>
                      <li>{language === 'es' ? 'Columna P (Nesting): Recibe una asignación del 30% de los puntos.' : 'Column P (Nesting): Receives a 30% point allocation.'}</li>
                    </ul>
                  </div>

                  <div>
                    <h3 style={{ color: C.title, fontSize: '1.1rem', marginBottom: '8px' }}>
                      {language === 'es' ? '4. MULTIPLICADORES DE PROYECTO' : '4. PROJECT MULTIPLIERS'}
                    </h3>
                    <ul style={{ paddingLeft: '20px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li><strong style={{color: C.accent}}>No Holes?:</strong> {language === 'es' ? 'Multiplica el peso total calculado por 1.25x.' : 'Multiplies the total Calculated Weight by 1.25x.'}</li>
                      <li><strong style={{color: C.accent}}>Strip Lights?:</strong> {language === 'es' ? 'Agrega un bono del 10% específicamente al cálculo de puntos de Nesting.' : 'Adds a 10% bonus specifically to the Nesting points calculation.'}</li>
                      <li><strong style={{color: C.accent}}>Multicolor?:</strong> {language === 'es' ? 'Agrega un bono del 10% específicamente al cálculo de puntos de Nesting.' : 'Adds a 10% bonus specifically to the Nesting points calculation.'}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </div>
  );
}
