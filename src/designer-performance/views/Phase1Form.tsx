import React, { useState, useEffect, useRef } from 'react';
import { useKpi } from '../context/KpiContext';
import { calculatePhase1ScoreAndStatus, calculateTechnicalPoints } from '../utils/scoreCalculator';
import toast from 'react-hot-toast';
import type { Project, ProjectStatus, Phase1Outcome, Phase1OutcomeRecord } from '../types';
import { Link2, FileText, CheckSquare, Zap, RefreshCw, Send, AlertTriangle, ClipboardCheck, Sparkles, Link as LinkIcon } from 'lucide-react';
import { generateReviewNote } from '../utils/reviewNoteApi';
import { buildSharedProjectLink } from '../../utils/projectDeepLink';
import { T } from '../utils/theme';
import { formatDisplayDate } from '../../utils/dateFormat';
import {
  OUTCOMES, OUTCOME_DEFINITION, REASON_LABEL, REASON_PLACEHOLDER, DEADLINE_LABEL,
  requiresReasonAndDeadline, outcomeToStatus, statusToOutcome, missingOutcomeFields,
} from '../utils/phase1Outcome';

/* ── tiny primitives ─────────────────────────────────────────────────── */
const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    background: T.cardBg, border: `1px solid ${T.cardBorder}`,
    borderRadius: T.radiusLg, padding: '24px 28px',
    ...style,
  }}>
    {children}
  </div>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; badge?: React.ReactNode }> = ({ icon, title, subtitle, badge }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </span>
        <h3 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '1.0rem', color: T.textPrimary, margin: 0 }}>
          {title}
        </h3>
      </div>
      {badge}
    </div>
    {subtitle && <p style={{ color: T.textMuted, fontSize: '0.78rem', marginTop: 6, paddingLeft: 40 }}>{subtitle}</p>}
    <div style={{ height: 1, background: T.cardBorder, marginTop: 12 }} />
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode; half?: boolean }> = ({ label, children, half }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(half ? { flex: '1 1 45%', minWidth: 140 } : {}) }}>
    <label style={{ color: T.textSecondary, fontSize: '0.76rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  background: T.bgSurface,
  border: `1px solid ${T.cardBorder}`,
  borderRadius: T.radiusPill,
  color: T.textPrimary,
  padding: '10px 16px',
  fontSize: '0.88rem',
  outline: 'none',
  width: '100%',
  fontFamily: "'Inter',sans-serif",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none' as const,
};

/* ── mini date picker ────────────────────────────────────────────────────
   Replaces the native <input type="date"> for the checklist date-correction
   pill: the OS/browser calendar can't be restyled (rounded corners, gray
   background, blue borders) since it isn't part of the page DOM, so this is
   a small custom popover calendar matching the pill's look instead. */
// Alto aproximado del popover (cabecera + 6 filas de dias). Solo se usa para
// decidir si abre hacia arriba o hacia abajo, no para dibujarlo.
const POPOVER_HEIGHT = 300;

export const MiniDatePicker: React.FC<{
  value: number; // timestamp of the currently selected date
  onChange: (ts: number) => void;
  children: React.ReactNode; // the pill trigger
}> = ({ value, onChange, children }) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(value));
  // Hacia arriba cuando abajo no entra — pasa con los ultimos items del
  // checklist, que quedaban con el calendario fuera de la pantalla.
  const [dropUp, setDropUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // La píldora vive dentro del <label> del ítem del checklist, que routea
  // cualquier click a su checkbox. preventDefault corta ese comportamiento
  // nativo (stopPropagation solo no alcanza) para que abrir el calendario no
  // destilde el ítem.
  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!open) {
      setViewDate(new Date(value));
      const r = wrapperRef.current?.getBoundingClientRect();
      // Solo se invierte si arriba SI entra: si no entra en ningun lado,
      // abrir hacia abajo es lo menos malo (la pagina scrollea).
      setDropUp(!!r && r.bottom + POPOVER_HEIGHT > window.innerHeight && r.top > POPOVER_HEIGHT);
    }
    setOpen(o => !o);
  };

  const selected = new Date(value);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const pick = (day: number) => {
    const next = new Date(selected);
    next.setFullYear(year, month, day);
    onChange(next.getTime());
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <span onClick={handleToggle} style={{ display: 'inline-flex' }}>{children}</span>
      {open && (
        <div
          // Mismo motivo que handleToggle: el popover se renderiza dentro del
          // <label>, asi que cualquier click suyo (flechas de mes, dias) tiene
          // que quedar aislado o destilda el item.
          onClick={e => { e.preventDefault(); e.stopPropagation(); }}
          role="dialog"
          aria-label="Correct the recorded date"
          style={{
            position: 'absolute',
            // Anclado a la derecha: la pildora vive pegada al borde derecho de
            // la tarjeta, asi que abrir hacia la izquierda es lo unico que
            // entra sin desbordar la pagina.
            right: 0,
            ...(dropUp ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            // Por encima del chat flotante (.project-chatbot-widget, z-index
            // 1000), que si no tapa el calendario.
            zIndex: 1200,
            background: T.bgSurface, border: `1px solid ${T.blue}`, borderRadius: T.radiusMd,
            padding: 14, width: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}
              style={{ background: 'none', border: 'none', color: T.textSecondary, cursor: 'pointer', fontSize: '0.9rem', padding: 4 }}>‹</button>
            <span style={{ color: T.textPrimary, fontWeight: 600, fontSize: '0.82rem' }}>{monthLabel}</span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}
              style={{ background: 'none', border: 'none', color: T.textSecondary, cursor: 'pointer', fontSize: '0.9rem', padding: 4 }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <span key={d} style={{ textAlign: 'center', fontSize: '0.65rem', color: T.textMuted, fontWeight: 600 }}>{d}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, i) => {
              if (day === null) return <span key={i} />;
              const isSelected = day === selected.getDate() && month === selected.getMonth() && year === selected.getFullYear();
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => pick(day)}
                  style={{
                    aspectRatio: '1', border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontSize: '0.75rem', fontFamily: "'Inter',sans-serif",
                    background: isSelected ? T.blue : 'transparent',
                    color: isSelected ? '#fff' : T.textPrimary,
                    fontWeight: isSelected ? 700 : 400,
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── types ───────────────────────────────────────────────────────────── */
type ChecklistState = {
  kcdFile: number | false;
  jlContract: number | false;
  quoteComplete: number | false;
  quoteBreakdown: number | false;
  creditCardForm: number | false;
  drawingsSigned: number | false;
  finalMeasurementsApplies: number | false;
  finalMeasurementsDelivered: number | false;
};

const emptyChecklist: ChecklistState = {
  kcdFile: false, jlContract: false, quoteComplete: false,
  quoteBreakdown: false, creditCardForm: false,
  drawingsSigned: false, finalMeasurementsApplies: false, finalMeasurementsDelivered: false,
};

// Fuente única de los ítems del checklist: la usan tanto el render como el
// cálculo de qué documentación falta al confirmar una aprobación forzada.
const CHECKLIST_ITEMS: { id: keyof ChecklistState; label: string }[] = [
  { id: 'kcdFile',                   label: 'KCD file (complete & latest)' },
  { id: 'jlContract',                label: 'JL Contract (complete & signed)' },
  { id: 'quoteComplete',             label: 'Quote (complete by room)' },
  { id: 'quoteBreakdown',            label: 'Quote breakdown' },
  { id: 'creditCardForm',            label: 'Credit Card Form' },
  { id: 'drawingsSigned',            label: 'Drawings (signed by client)' },
  { id: 'finalMeasurementsApplies',  label: 'Does "Final Measurements" apply here?' },
];

const emptyComplexity = {
  colorsDefined: false, thermofoilDoors: false, customBoreHoles: false,
  routingRequired: false, customPanels: false,
};

/* ── main component ──────────────────────────────────────────────────── */
export const Phase1Form: React.FC = () => {
  const { designerNames, projects, projectDesigners, addProject, updateProject, getProjectComplexity, canForceApprove } = useKpi();

  const [mode, setMode] = useState<'New' | 'Update'>('New');
  const [soNumber, setSoNumber]       = useState('');
  const [projectName, setProjectName] = useState('');
  const [designerName, setDesignerName] = useState('');
  const [totalRooms, setTotalRooms]   = useState<number | ''>('');
  const [checklist, setChecklist]     = useState<ChecklistState>(emptyChecklist);
  const [complexity, setComplexity]   = useState(emptyComplexity);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  // Resultado de la revision manual: es lo que aprueba la etapa.
  const [outcome, setOutcome] = useState<Phase1Outcome | ''>('');
  const [outcomeReason, setOutcomeReason] = useState('');
  const [outcomeDeadline, setOutcomeDeadline] = useState<number | null>(null);
  // El registro guardado, para conservar el plazo original al subsanar.
  const [savedOutcome, setSavedOutcome] = useState<Phase1OutcomeRecord | undefined>(undefined);
  const [draftingNote, setDraftingNote] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // Ultimo borrador automatico. Sirve para saber si el ingeniero toco la nota:
  // si la edito, no se la volvemos a pisar al cambiar el resultado o el plazo.
  const lastAutoDraft = useRef('');
  // Identifica cada borrador en vuelo, para descartar respuestas viejas.
  const draftSeq = useRef(0);
  // Espejo de outcomeReason legible desde un closure async, que si no ve el
  // valor congelado del render en que arrancó.
  const outcomeReasonRef = useRef('');
  useEffect(() => { outcomeReasonRef.current = outcomeReason; }, [outcomeReason]);
  // Solo para administrative: lo que falta, mientras se confirma aprobar igual.
  const [pendingApproval, setPendingApproval] = useState<{ basics: string[]; docs: string[] } | null>(null);

  // Any project that has been evaluated (not Pending) can be updated to correct mistakes
  const updatableProjects = projects.filter(p => p.status !== 'Pending');
  // Active projects = Pending (not yet evaluated in Phase 1)
  const activeProjects = projects.filter(p => p.status === 'Pending');

  // Effective createdAt for the live score preview: the existing project's
  // registration date, or "today" for a not-yet-registered New intake.
  const existingProject = projects.find(p => p.id === soNumber);
  const effectiveCreatedAt = existingProject?.createdAt || Date.now();
  const livePreview = soNumber ? calculatePhase1ScoreAndStatus(checklist, effectiveCreatedAt) : null;

  /* When selecting an active project in New mode, load THAT project's data.
     Todos los campos se reescriben siempre, incluso cuando el proyecto elegido
     no aporta valor: antes solo se pisaban los que tenian dato, asi que al
     cambiar de seleccion quedaban puestos el checklist tildado, la complejidad
     y el diseñador del proyecto anterior, y se guardaban en el nuevo SO. */
  const handleNewProjectSelect = (selectedSo: string) => {
    setSoNumber(selectedSo);
    if (!selectedSo) { resetForm(); return; }
    const proj = projects.find(p => p.id === selectedSo);

    setProjectName(proj?.projectName ?? '');
    // Pull the designer from My Projects/Pipeline (the source of truth), not
    // from whatever may already be stored on the Designer Perf. project record.
    const assignedDesigner = projectDesigners[selectedSo];
    const recordDesigner = proj && proj.designerName !== 'Unassigned' ? proj.designerName : '';
    setDesignerName(assignedDesigner || recordDesigner || '');
    // Removed auto-fill for totalRooms per user request so it must be entered manually
    setTotalRooms('');
    setChecklist({ ...emptyChecklist, ...(proj?.checklist ?? {}) });
    // proj.complexity ya viene derivada de la planilla (ver deriveComplexity),
    // asi que alcanza con copiarla tal cual.
    setComplexity({ ...emptyComplexity, ...(proj?.complexity ?? {}) });
    loadOutcomeFrom(proj);

    // El badge "N synced" cuenta solo lo que aporto la planilla.
    const auto = getProjectComplexity(selectedSo);
    const filled = new Set<string>();
    (Object.keys(auto) as Array<keyof typeof emptyComplexity>).forEach(k => { if (auto[k]) filled.add(k); });
    setAutoFilledFields(filled);
  };

  /* auto-fill complexity from project elements when SO is typed (fallback for manual entry) */
  useEffect(() => {
    if (mode === 'New' && soNumber && soNumber.length > 3) {
      const auto = getProjectComplexity(soNumber);
      if (Object.keys(auto).length > 0) {
        const filled = new Set<string>();
        setComplexity(prev => {
          const updated = { ...prev };
          (Object.keys(auto) as Array<keyof typeof emptyComplexity>).forEach(k => {
            if (auto[k] !== undefined) { updated[k] = auto[k] as boolean; if (auto[k]) filled.add(k); }
          });
          return updated;
        });
        setAutoFilledFields(filled);
      }
    }
  }, [soNumber, mode]);

  useEffect(() => {
    if (mode === 'Update' && soNumber) {
      const existing = projects.find(p => p.id === soNumber);
      if (existing) {
        setProjectName(existing.projectName);
        setDesignerName(projectDesigners[soNumber] || existing.designerName);
        setTotalRooms(existing.totalRooms);
        setChecklist(existing.checklist);
        setComplexity(existing.complexity);
        loadOutcomeFrom(existing);
        const auto = getProjectComplexity(soNumber);
        const filled = new Set<string>();
        (Object.keys(auto) as Array<keyof typeof emptyComplexity>).forEach(k => { if (auto[k]) filled.add(k); });
        setAutoFilledFields(filled);
      }
    }
  }, [mode, soNumber, projects, projectDesigners]);

  useEffect(() => { if (mode === 'New') resetForm(); }, [mode]);

  const resetForm = () => {
    setSoNumber(''); setProjectName(''); setDesignerName('');
    setTotalRooms(''); setChecklist(emptyChecklist);
    setComplexity(emptyComplexity); setAutoFilledFields(new Set());
    loadOutcomeFrom(undefined);
  };

  /* Carga el resultado ya registrado. Los proyectos anteriores a esta funcion no
     tienen `outcome`, asi que se deduce del estado: un Approved viejo se muestra
     como Complete en vez de aparecer sin revisar. */
  const loadOutcomeFrom = (proj?: Project) => {
    const rec = proj?.outcome;
    setSavedOutcome(rec);
    // Una nota ya guardada cuenta como escrita a mano: no se redacta encima.
    lastAutoDraft.current = '';
    setOutcome(rec?.result ?? (proj ? statusToOutcome(proj.status) ?? '' : ''));
    setOutcomeReason(rec?.reason ?? '');
    setOutcomeDeadline(rec?.deadline || null);
  };

  const handleChecklistToggle = (field: keyof ChecklistState) => {
    setChecklist(prev => ({ ...prev, [field]: prev[field] === false ? Date.now() : false }));
  };

  // Lets the engineer correct the recorded date if an item was checked late
  // by mistake (e.g. paperwork actually arrived earlier). MiniDatePicker ya
  // preserva la hora original, asi que aca solo se guarda el timestamp.
  const handleChecklistDateChange = (field: keyof ChecklistState, ts: number) => {
    setChecklist(prev => ({ ...prev, [field]: ts }));
  };

  const handleComplexityChange = (field: keyof typeof complexity) => {
    setComplexity(prev => ({ ...prev, [field]: !prev[field] }));
    setAutoFilledFields(prev => { const n = new Set(prev); n.delete(field); return n; });
  };

  /* Qué le falta al formulario. Se usa para decidir si se bloquea el envío
     (perfiles normales) o se ofrece aprobar igual (administrative). */
  const missingBasics = (): string[] => {
    const missing: string[] = [];
    if (!projectName) missing.push('Project Name');
    if (!designerName) missing.push('Designer');
    if (totalRooms === '') missing.push('Total Rooms');
    return missing;
  };

  const missingDocs = (): string[] => {
    const missing = CHECKLIST_ITEMS
      .filter(i => i.id !== 'finalMeasurementsApplies' && checklist[i.id] === false)
      .map(i => i.label);
    if (checklist.finalMeasurementsApplies !== false && checklist.finalMeasurementsDelivered === false) {
      missing.push('Final Measurements delivered');
    }
    return missing;
  };

  /* Redacta la nota que va a leer el diseñador. El contenido sale del checklist
     (reviewNoteDraft); Gemini solo lo reescribe, y si no está disponible se usa
     el texto determinístico — ver reviewNoteApi. */
  const draftNote = async (chosen: Phase1Outcome, deadline: number | null, force = false) => {
    const seq = ++draftSeq.current;
    const before = outcomeReasonRef.current;
    setDraftingNote(true);
    try {
      const text = await generateReviewNote({
        outcome: chosen,
        soNumber,
        projectName,
        designerName,
        missingDocs: missingDocs(),
        deadline,
      });
      // Empezó otro borrador mientras este estaba en vuelo: gana el último.
      if (seq !== draftSeq.current) return;
      // El ingeniero escribió mientras el modelo redactaba: gana lo suyo. Sin
      // esto, tipear apenas elegido el resultado perdía el texto sin aviso.
      if (!force && outcomeReasonRef.current !== before) return;
      lastAutoDraft.current = text;
      setOutcomeReason(text);
    } finally {
      if (seq === draftSeq.current) setDraftingNote(false);
    }
  };

  // Solo se redacta sola si no hay nada escrito a mano: lo que el ingeniero
  // tipeó tiene prioridad sobre cualquier borrador automático.
  const noteIsUntouched = () => !outcomeReason.trim() || outcomeReason === lastAutoDraft.current;

  const handleOutcomeSelect = (chosen: Phase1Outcome) => {
    setOutcome(chosen);
    if (noteIsUntouched()) void draftNote(chosen, outcomeDeadline);
  };

  /* Copia el link al portapapeles. Con clipboard bloqueado (http, permisos) se
     muestra igual la URL para poder copiarla a mano en vez de fallar en
     silencio. */
  const copyDesignerLink = async () => {
    const url = buildSharedProjectLink(soNumber);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast(url, { duration: 8000 });
    }
  };

  const handleDeadlineSelect = (ts: number) => {
    setOutcomeDeadline(ts);
    // El plazo se elige después del resultado, así que el primer borrador salió
    // sin fecha: se rehace para que la nota la incluya.
    if (outcome !== '' && noteIsUntouched()) void draftNote(outcome, ts);
  };

  const outcomeMessage = (status: ProjectStatus) =>
    status === 'Approved'  ? 'Marked Complete — ready for engineering. ✓'
    : status === 'Deficient' ? 'Marked Deficient — returned to the designer.'
    : status === 'Deferred'  ? 'Marked Deferred — project on hold.'
    : 'Saved.';

  /* Arma el registro del resultado que se guarda con el proyecto.

     Al pasar a Complete desde un Deficient/Deferred NO se descarta el plazo: se
     conserva y se sella con `resolvedAt`, de modo que lo que se acumulo por
     pasarse de la fecha sigue descontando despues de corregir — igual que un
     documento del checklist entregado tarde. */
  const buildOutcomeRecord = (result: Phase1Outcome, now: number): Phase1OutcomeRecord => {
    if (result === 'Complete') {
      const hadDeadline = savedOutcome?.deadline ?? 0;
      return {
        result: 'Complete',
        // La nota escrita se guarda tambien en Complete. Al subsanar un
        // Deficient el campo ya viene cargado con el aviso original, asi que
        // se conserva salvo que el ingeniero lo reescriba a proposito.
        reason: outcomeReason.trim(),
        deadline: hadDeadline,
        setAt: savedOutcome?.setAt ?? now,
        // Si ya estaba sellado se respeta la fecha original de subsanacion.
        resolvedAt: hadDeadline ? (savedOutcome!.resolvedAt ?? now) : now,
      };
    }
    // Cambiar de Deficient a Deferred (o corregir el plazo) reinicia el reloj:
    // es una decision nueva, con su propia fecha limite.
    const sameAsSaved = savedOutcome?.result === result && savedOutcome.deadline === outcomeDeadline;
    return {
      result,
      reason: outcomeReason.trim(),
      deadline: outcomeDeadline as number,
      setAt: sameAsSaved ? savedOutcome!.setAt : now,
      resolvedAt: null,
    };
  };

  /* Guarda el intake. `forceApprove` deja el proyecto en Approved aunque falte
     documentación — es una decisión administrativa. El puntaje NO se toca: se
     calcula igual por las demoras, así que el KPI sigue reflejando la realidad
     del papeleo. */
  const saveIntake = async (opts: { forceReview?: boolean; forceApprove?: boolean } = {}) => {
    const { forceReview = false, forceApprove = false } = opts;

    const existingForCreatedAt = projects.find(p => p.id === soNumber);
    const now = Date.now();
    const createdAt = existingForCreatedAt?.createdAt || now;

    let finalStatus: ProjectStatus, score: number | null;
    let outcomeRecord: Phase1OutcomeRecord | undefined = savedOutcome;
    if (forceReview) {
      finalStatus = 'To review'; score = null;
    } else {
      const r = calculatePhase1ScoreAndStatus(checklist, createdAt);
      score = r.score;
      // El estado sale de la revision manual, no del checklist: el checklist ya
      // solo determina el puntaje. `forceApprove` es la excepcion
      // administrativa, que aprueba con papeleo faltante.
      const chosen: Phase1Outcome = forceApprove ? 'Complete' : (outcome as Phase1Outcome);
      finalStatus = outcomeToStatus(chosen);
      outcomeRecord = buildOutcomeRecord(chosen, now);
    }

    // Al forzar, los básicos pueden venir vacíos: se completan con algo usable
    // en vez de guardar undefined.
    const safeName = projectName || `SO #${soNumber}`;
    const safeRooms = totalRooms === '' ? 0 : Number(totalRooms);
    const icp = safeRooms + calculateTechnicalPoints(complexity);

    if (mode === 'New') {
      const existing = projects.find(p => p.id === soNumber);
      const result = await updateProject({
        ...(existing || {}),
        id: soNumber,
        createdAt,
        approvedAt: finalStatus === 'Approved' ? now : null,
        projectName: safeName, designerName, status: finalStatus, totalRooms: safeRooms, icp,
        phase1Score: score, phase2Score: existing?.phase2Score ?? null, checklist, complexity,
        ...(outcomeRecord ? { outcome: outcomeRecord } : {}),
      });
      if (result.conflict) {
        toast.error(`Designer was just changed to "${result.currentDesignerName}" by someone else. Reload and try again.`);
        return;
      }
      toast.success(
        forceApprove ? 'Approved with missing documentation.'
        : finalStatus === 'To review' ? 'Saved for review.'
        : outcomeMessage(finalStatus));
      resetForm();
    } else {
      const existing = projects.find(p => p.id === soNumber);
      if (!existing) return;
      // Un proyecto ya cerrado en Fase 2 se puede seguir corrigiendo (un typo
      // del checklist), pero su cierre no se toca: calculatePhase1ScoreAndStatus
      // solo devuelve Approved/Rejected/To review, asi que recalcular el status
      // aca lo revertia a "abierto" y Phase2Form lo volvia a ofrecer para
      // cerrar, sobrescribiendo el phase2Score ya registrado.
      const isClosed = existing.status === 'Completed';
      const result = await updateProject({ ...existing, projectName: safeName, designerName,
        status: isClosed ? existing.status : finalStatus,
        totalRooms: safeRooms, icp, phase1Score: score, checklist, complexity,
        ...(outcomeRecord ? { outcome: outcomeRecord } : {}),
        approvedAt: isClosed ? existing.approvedAt : (finalStatus === 'Approved' ? now : existing.approvedAt) });
      if (result.conflict) {
        toast.error(`Designer was just changed to "${result.currentDesignerName}" by someone else. Reload and try again.`);
        return;
      }
      // Un proyecto cerrado no se "aprueba" de nuevo: avisar que solo se
      // guardaron las correcciones, y no resetear el form como si hubiera
      // cambiado de etapa.
      toast.success(isClosed ? 'Changes saved. Project stays Completed.'
        : forceApprove ? 'Approved with missing documentation.'
        : outcomeMessage(finalStatus));
      if (!isClosed && finalStatus === 'Approved') { resetForm(); setMode('New'); }
    }
  };

  const handleSubmit = async (e: React.FormEvent, forceReview = false) => {
    e.preventDefault();

    // El SO es la clave del registro en Firebase: sin él no hay nada que guardar,
    // ni siquiera para una aprobación administrativa.
    if (!soNumber) { toast.error('SO Number is required.'); return; }

    if (mode === 'New' && projects.some(p => p.id === soNumber && p.status !== 'Pending')) {
      toast.error('A project with this SO Number has already been processed.'); return;
    }

    // "Save for Later Review" no cierra la revisión: deja el proyecto en espera,
    // así que no exige haber elegido un resultado.
    if (forceReview) { await saveIntake({ forceReview: true }); return; }

    const missingOutcome = missingOutcomeFields(outcome, outcomeReason, outcomeDeadline);
    if (missingOutcome.length > 0) {
      toast.error(`Missing: ${missingOutcome.join(', ')}.`); return;
    }

    const basics = missingBasics();
    const docs = missingDocs();

    // Deficient y Deferred existen precisamente para registrar que falta algo,
    // así que no se valida el papeleo contra ellos. Solo Complete —"listo para
    // ingeniería"— exige el checklist entero.
    const needsFullDocs = outcome === 'Complete';
    const blockingDocs = needsFullDocs ? docs : [];

    if (canForceApprove && (basics.length > 0 || blockingDocs.length > 0)) {
      setPendingApproval({ basics, docs: blockingDocs });
      return;
    }

    if (basics.length > 0) {
      toast.error('Please fill in all basic project details.'); return;
    }
    if (blockingDocs.length > 0) {
      toast.error('Cannot mark Complete while documentation is missing.'); return;
    }

    await saveIntake({ forceReview });
  };

  const fmtDate = (ts: number | false) =>
    ts ? formatDisplayDate(new Date(ts)) : null;

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 700, margin: '0 auto', paddingBottom: 32 }}>

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '1.5rem', color: T.textPrimary, margin: 0 }}>
          Phase 1: Project Intake
        </h2>
        <p style={{ color: T.textMuted, fontSize: '0.85rem', marginTop: 4 }}>
          Register a new project or update documentation for a rejected one.
        </p>
      </div>

      {/* Mode toggle — pill style matching the main app tabs */}
      <div style={{
        display: 'inline-flex', background: T.bgDeep, border: `1px solid ${T.cardBorder}`,
        borderRadius: T.radiusPill, padding: 4, marginBottom: 22, gap: 4,
      }}>
        {(['New', 'Update'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '8px 20px', borderRadius: T.radiusPill, border: 'none', cursor: 'pointer',
            fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s',
            background: mode === m ? T.blue : 'transparent',
            color: mode === m ? '#fff' : T.textMuted,
          }}>
            {m === 'New' ? 'Register New' : 'Update Project'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Basic Info ──────────────────────────────────────────── */}
        <Card>
          <SectionTitle icon={<FileText size={15} color={T.blue} />} title="Basic Information" />

          {mode === 'Update' ? (
            <Field label="Select Project (SO Number)">
              <select name="soNumber" value={soNumber} onChange={e => setSoNumber(e.target.value)} style={selectStyle}>
                <option value="">Choose a project to update…</option>
                {updatableProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.id} — {p.projectName} ({p.status})</option>
                ))}
              </select>
            </Field>
          // NEW MODE: dropdown of active (Pending) projects
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="SO Number — Active Project">
                <select
                  name="soNumber"
                  value={soNumber}
                  onChange={e => handleNewProjectSelect(e.target.value)}
                  style={{ ...selectStyle, cursor: 'pointer', appearance: 'none' }}
                >
                  <option value="">Select an active project…</option>
                  {activeProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.id} — {p.projectName}{p.designerName && p.designerName !== 'Unassigned' ? ` (${p.designerName})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {activeProjects.length === 0 && (
                <div style={{
                  padding: '10px 16px', borderRadius: T.radiusMd,
                  background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)',
                  color: T.yellow, fontSize: '0.8rem',
                }}>
                  No pending active projects found. Projects appear here once loaded from the pipeline.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
            <Field label="Project Name" half>
              <input name="projectName" value={projectName} onChange={e => setProjectName(e.target.value)}
                readOnly={mode === 'Update'} placeholder="e.g., Smith Residence"
                style={{ ...inputStyle, opacity: mode === 'Update' ? 0.5 : 1 }} />
            </Field>
            <Field label="Designer" half>
              <select name="designerName" value={designerName} onChange={e => setDesignerName(e.target.value)}
                style={selectStyle}>
                <option value="">Select a designer…</option>
                {designerNames.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            <Field label="Total Rooms" half>
              <input name="totalRooms" type="number" min="1" value={totalRooms}
                onChange={e => setTotalRooms(e.target.value === '' ? '' : Number(e.target.value))}
                style={inputStyle} />
            </Field>
          </div>
        </Card>

        {/* ── Checklist ───────────────────────────────────────────── */}
        <Card>
          <SectionTitle
            icon={<CheckSquare size={15} color={T.blue} />}
            title="Strict Go / No-Go Checklist"
            subtitle="Check each item when the documentation is received. Date is recorded automatically — click it to correct the date if it was logged late. Business days only: -1 pt/day late per item (first 4 days), -2 pts/day after, max -20. Final Measurements depends on scheduling, so it only costs -0.1/day the first 4 days and -0.4/day after."
            badge={livePreview ? (
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                color: livePreview.score >= 80 ? T.green : livePreview.score >= 50 ? T.yellow : T.red,
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.cardBorder}`,
                borderRadius: T.radiusPill, padding: '3px 10px',
              }}>
                Score: {livePreview.score}
              </span>
            ) : undefined}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CHECKLIST_ITEMS.map(item => {
              const checked = checklist[item.id] !== false;
              return (
                <label key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Real checkbox input, visually hidden: the <label> wrapper
                        already routes clicks to it, and it gives keyboard focus,
                        Enter/Space toggling, and screen-reader semantics that the
                        bare onClick div lacked. */}
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleChecklistToggle(item.id)}
                      style={{ position: 'absolute', opacity: 0, width: 20, height: 20, margin: 0, cursor: 'pointer' }}
                    />
                    {/* custom checkbox visual */}
                    <div aria-hidden="true" style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${checked ? T.blue : T.cardBorder}`,
                      background: checked ? T.blue : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ color: checked ? T.textPrimary : T.textSecondary, fontSize: '0.85rem', transition: 'color 0.2s' }}>
                      {item.label}
                    </span>
                  </div>
                  {checked && (
                    <MiniDatePicker
                      value={checklist[item.id] as number}
                      onChange={ts => handleChecklistDateChange(item.id, ts)}
                    >
                      <span
                        title="Click to correct the date"
                        style={{
                          fontSize: '0.72rem', color: T.blue, background: 'rgba(59,130,246,0.1)',
                          border: '1px solid rgba(59,130,246,0.2)', borderRadius: T.radiusPill,
                          padding: '2px 10px', whiteSpace: 'nowrap', cursor: 'pointer',
                        }}
                      >
                        ✓ {fmtDate(checklist[item.id])}
                      </span>
                    </MiniDatePicker>
                  )}
                </label>
              );
            })}

            {/* sub-item for Final Measurements */}
            {checklist.finalMeasurementsApplies !== false && (
              <div style={{
                marginLeft: 30, padding: '12px 16px',
                background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
                borderRadius: T.radiusMd,
              }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={checklist.finalMeasurementsDelivered !== false}
                      onChange={() => handleChecklistToggle('finalMeasurementsDelivered')}
                      style={{ position: 'absolute', opacity: 0, width: 20, height: 20, margin: 0, cursor: 'pointer' }}
                    />
                    <div aria-hidden="true" style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${checklist.finalMeasurementsDelivered !== false ? T.blue : T.cardBorder}`,
                      background: checklist.finalMeasurementsDelivered !== false ? T.blue : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      {checklist.finalMeasurementsDelivered !== false && (
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>
                      )}
                    </div>
                    <span style={{ color: T.blue, fontSize: '0.85rem', fontWeight: 600 }}>
                      Final Measurements delivered?
                    </span>
                  </div>
                  {checklist.finalMeasurementsDelivered !== false && (
                    <MiniDatePicker
                      value={checklist.finalMeasurementsDelivered as number}
                      onChange={ts => handleChecklistDateChange('finalMeasurementsDelivered', ts)}
                    >
                      <span
                        title="Click to correct the date"
                        style={{
                          fontSize: '0.72rem', color: T.blue, background: 'rgba(59,130,246,0.1)',
                          border: '1px solid rgba(59,130,246,0.2)', borderRadius: T.radiusPill,
                          padding: '2px 10px', whiteSpace: 'nowrap', cursor: 'pointer',
                        }}
                      >
                        ✓ {fmtDate(checklist.finalMeasurementsDelivered)}
                      </span>
                    </MiniDatePicker>
                  )}
                </label>
              </div>
            )}
          </div>
        </Card>

        {/* ── Complexity ──────────────────────────────────────────── */}
        <Card>
          <SectionTitle
            icon={<Zap size={15} color={T.blue} />}
            title="Technical Complexity"
            subtitle="Pre-filled from Project Elements — editable if needed. Affects the ICP score."
            badge={autoFilledFields.size > 0 ? (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: '0.72rem', color: T.green,
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: T.radiusPill, padding: '3px 10px',
              }}>
                <Link2 size={11} color={T.green} />
                {autoFilledFields.size} synced
              </span>
            ) : undefined}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              { id: 'colorsDefined',   label: 'Colors per room defined?',       pts: '+2', synced: false },
              { id: 'thermofoilDoors', label: 'Thermofoil / Element doors?',    pts: '+1', synced: true },
              { id: 'customBoreHoles', label: 'Custom bore holes / No Holes?',  pts: '+4', synced: true },
              { id: 'routingRequired', label: 'Routing / Dovetail required?',   pts: '+2', synced: true },
              { id: 'customPanels',    label: 'Custom panels / Elements?',      pts: '+1', synced: true },
            ] as { id: keyof typeof complexity; label: string; pts: string; synced: boolean }[]).map(item => {
              const checked = complexity[item.id];
              const isAutoSynced = item.synced && autoFilledFields.has(item.id);
              return (
                <label key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '10px 12px', borderRadius: T.radiusMd,
                  background: checked ? 'rgba(59,130,246,0.07)' : T.bgSurface,
                  border: `1px solid ${checked ? 'rgba(59,130,246,0.2)' : T.cardBorder}`,
                  transition: 'all 0.2s', position: 'relative',
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleComplexityChange(item.id)}
                    style={{ position: 'absolute', opacity: 0, width: 18, height: 18, margin: 0, cursor: 'pointer' }}
                  />
                  <div aria-hidden="true" style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    border: `2px solid ${checked ? T.blue : T.textMuted}`,
                    background: checked ? T.blue : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}>
                    {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: '0.8rem', color: checked ? T.textPrimary : T.textSecondary }}>
                        {item.label}
                      </span>
                      {isAutoSynced && <Link2 size={10} color={T.green} />}
                    </div>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700,
                      color: checked ? T.blue : T.textMuted,
                      background: checked ? 'rgba(59,130,246,0.12)' : 'transparent',
                      borderRadius: 4, padding: checked ? '1px 5px' : 0,
                    }}>
                      {item.pts}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </Card>

        {/* ── Review Result ───────────────────────────────────────── */}
        <Card>
          <SectionTitle
            icon={<ClipboardCheck size={15} color={T.blue} />}
            title="Review Result"
            subtitle="The manual quality review is what approves this phase. The checklist above only drives the score."
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OUTCOMES.map(o => {
              const selected = outcome === o;
              const tint = o === 'Complete' ? T.green : o === 'Deficient' ? T.red : T.yellow;
              return (
                <label key={o} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 11, cursor: 'pointer',
                  padding: '12px 14px', borderRadius: T.radiusMd, position: 'relative',
                  background: selected ? `${tint}12` : T.bgSurface,
                  border: `1px solid ${selected ? `${tint}55` : T.cardBorder}`,
                  transition: 'all 0.2s',
                }}>
                  <input
                    type="radio"
                    name="phase1Outcome"
                    value={o}
                    checked={selected}
                    onChange={() => handleOutcomeSelect(o)}
                    style={{ position: 'absolute', opacity: 0, width: 18, height: 18, margin: 0, cursor: 'pointer' }}
                  />
                  <div aria-hidden="true" style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    border: `2px solid ${selected ? tint : T.textMuted}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}>
                    {selected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: tint }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: selected ? tint : T.textPrimary, marginBottom: 2 }}>
                      {o}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: T.textMuted, lineHeight: 1.45 }}>
                      {OUTCOME_DEFINITION[o]}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* La nota va para los tres resultados: es lo que el diseñador lee
              para entender por que su proyecto quedo con ese status. En
              Deficient y Deferred ademas es obligatoria. */}
          <div style={{ marginTop: 16 }}>
            <Field label={outcome === '' ? 'Note for the designer' : REASON_LABEL[outcome]}>
              <textarea
                name="outcomeReason"
                value={outcomeReason}
                onChange={e => setOutcomeReason(e.target.value)}
                // La nota redactada trae saludo, la lista de documentos y el
                // cierre: con 3 filas quedaba scrolleando desde el primer uso.
                rows={12}
                placeholder={outcome === '' ? 'Explain what happened or what is missing…' : REASON_PLACEHOLDER[outcome]}
                style={{ ...inputStyle, borderRadius: T.radiusMd, resize: 'vertical', lineHeight: 1.5 }}
              />
            </Field>

            {outcome !== '' && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, marginTop: 8, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '0.71rem', color: T.textMuted, lineHeight: 1.4 }}>
                  Drafted automatically in English from the checklist. Edit it freely — or redraft
                  after changing the checklist.
                </span>
                <button
                  type="button"
                  onClick={() => void draftNote(outcome, outcomeDeadline, true)}
                  disabled={draftingNote}
                  style={{
                    // Mismas medidas que la pildora de "Pick a deadline…" para
                    // que los dos controles de la tarjeta se vean iguales.
                    display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
                    padding: '8px 16px', borderRadius: T.radiusPill,
                    border: `1px solid ${T.cardBorder}`, background: T.bgSurface,
                    color: draftingNote ? T.textMuted : T.textSecondary,
                    fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap',
                    cursor: draftingNote ? 'default' : 'pointer',
                  }}
                >
                  <Sparkles size={13} />
                  {draftingNote ? 'Drafting…' : 'Draft again'}
                </button>
              </div>
            )}

            {/* El disenador abre este link y ve el status, la nota y que
                documentos le faltan. Pide iniciar sesion: la ficha lleva
                nombre de cliente y notas internas. */}
            {!!soNumber && (
              <button
                type="button"
                onClick={copyDesignerLink}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12,
                  padding: '8px 15px', borderRadius: T.radiusPill,
                  border: `1px solid ${linkCopied ? 'rgba(16,185,129,0.35)' : T.cardBorder}`,
                  background: linkCopied ? 'rgba(16,185,129,0.1)' : T.bgSurface,
                  color: linkCopied ? T.green : T.textSecondary,
                  fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <LinkIcon size={12} />
                {linkCopied ? 'Link copied' : 'Copy status link for the designer'}
              </button>
            )}
          </div>

          {/* El plazo solo tiene sentido cuando hay algo que subsanar. */}
          {outcome !== '' && requiresReasonAndDeadline(outcome) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
              <Field label={DEADLINE_LABEL[outcome]}>
                <div>
                  <MiniDatePicker
                    value={outcomeDeadline ?? Date.now()}
                    onChange={handleDeadlineSelect}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      fontSize: '0.8rem', cursor: 'pointer',
                      color: outcomeDeadline ? T.blue : T.textMuted,
                      background: outcomeDeadline ? 'rgba(59,130,246,0.1)' : T.bgSurface,
                      border: `1px solid ${outcomeDeadline ? 'rgba(59,130,246,0.25)' : T.cardBorder}`,
                      borderRadius: T.radiusPill, padding: '8px 16px', whiteSpace: 'nowrap',
                    }}>
                      {outcomeDeadline ? formatDisplayDate(new Date(outcomeDeadline)) : 'Pick a deadline…'}
                    </span>
                  </MiniDatePicker>
                </div>
              </Field>

              <div style={{
                background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)',
                borderRadius: T.radiusMd, padding: '10px 14px',
              }}>
                <p style={{ color: T.textMuted, fontSize: '0.76rem', lineHeight: 1.45, margin: 0 }}>
                  Choosing this costs no points by itself. Past the deadline it starts costing
                  <strong style={{ color: T.yellow }}> -1 pt per business day</strong> (-2 after 4 days, max -20),
                  and keeps counting until the project is marked Complete.
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={e => handleSubmit(e, true)}
            style={{
              flex: 1, padding: '13px 20px', borderRadius: T.radiusPill,
              border: `1px solid ${T.cardBorder}`, background: T.bgSurface,
              color: T.textSecondary, fontSize: '0.88rem', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.cardHover; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.bgSurface; }}
          >
            <RefreshCw size={15} />
            Save for Later Review
          </button>
          <button
            onClick={e => handleSubmit(e, false)}
            style={{
              flex: 1, padding: '13px 20px', borderRadius: T.radiusPill,
              border: 'none', background: T.blue,
              color: '#fff', fontSize: '0.88rem', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.blueDeep; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.blue; }}
          >
            <Send size={15} />
            {mode === 'New' ? 'Submit Project Intake' : 'Save & Validate'}
          </button>
        </div>
      </div>

      {/* Confirmación de aprobación administrativa — solo la ve el rol
          administrative, en lugar del error que bloquea a los demás perfiles. */}
      {pendingApproval && (
        <div
          onClick={() => setPendingApproval(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.cardBg, border: `1px solid ${T.cardBorder}`,
              borderRadius: T.radiusLg, padding: '26px 28px',
              maxWidth: 460, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: 'rgba(234,179,8,0.14)', border: '1px solid rgba(234,179,8,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={17} color={T.yellow} />
              </span>
              <h3 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '1.05rem', color: T.textPrimary, margin: 0 }}>
                Approve with missing information?
              </h3>
            </div>

            <p style={{ color: T.textSecondary, fontSize: '0.86rem', lineHeight: 1.5, marginTop: 0, marginBottom: 16 }}>
              This project does not meet the intake requirements. As an administrative user you can approve it anyway.
            </p>

            {pendingApproval.basics.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: T.textMuted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Missing details
                </div>
                {pendingApproval.basics.map(label => (
                  <div key={label} style={{ color: T.yellow, fontSize: '0.83rem', padding: '2px 0' }}>• {label}</div>
                ))}
              </div>
            )}

            {pendingApproval.docs.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: T.textMuted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Missing documentation
                </div>
                {pendingApproval.docs.map(label => (
                  <div key={label} style={{ color: T.yellow, fontSize: '0.83rem', padding: '2px 0' }}>• {label}</div>
                ))}
              </div>
            )}

            <div style={{
              background: T.bgSurface, border: `1px solid ${T.cardBorder}`, borderRadius: T.radiusMd,
              padding: '10px 14px', marginBottom: 20,
            }}>
              <p style={{ color: T.textMuted, fontSize: '0.78rem', lineHeight: 1.45, margin: 0 }}>
                The project will be marked <strong style={{ color: T.textSecondary }}>Approved</strong>, but the score still
                counts the delays, so the designer&apos;s KPI keeps reflecting the missing paperwork.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setPendingApproval(null)}
                style={{
                  flex: 1, padding: '11px 18px', borderRadius: T.radiusPill,
                  border: `1px solid ${T.cardBorder}`, background: T.bgSurface,
                  color: T.textSecondary, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => { setPendingApproval(null); await saveIntake({ forceApprove: true }); }}
                style={{
                  flex: 1, padding: '11px 18px', borderRadius: T.radiusPill,
                  border: 'none', background: T.yellow,
                  color: '#1a1000', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Approve anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
