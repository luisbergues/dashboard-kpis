import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Archive, Loader2, AlertTriangle } from 'lucide-react';
import { db, ref, get } from '../utils/firebase';
import { manuallyArchiveProject } from '../utils/completedProjectsArchive';
import { useLanguage } from '../utils/LanguageContext';

// SO-keyed Realtime Database nodes that can still hold data for a project
// after it's gone from both the live sheet and the Firestore archive.
const SO_KEYED_NODES = [
  'project_history',
  'project_designers',
  'project_kanban_state',
  'engineering_checks',
  'nesting_checks',
  'project_overrides',
  'project_collaborators',
  'project_materials',
  'designer_performance_projects',
];

export default function OrphanedProjectsPanel({ data }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [orphans, setOrphans] = useState(null); // null = not scanned yet
  const [archivingSo, setArchivingSo] = useState(null);
  // Ingeniero escrito a mano por SO, cuando no se pudo deducir del rastro.
  const [engineerOverrides, setEngineerOverrides] = useState({});
  const [error, setError] = useState(null);

  // Ingenieros ya conocidos, para autocompletar en vez de tipear a ciegas.
  const knownEngineers = Array.from(new Set(
    (data?.priorityAnalysis || []).map(p => p.eng).filter(e => e && String(e).trim())
  )).sort();

  const handleScan = async () => {
    if (!db) return;
    setScanning(true);
    try {
      const liveSoSet = new Set((data?.priorityAnalysis || []).map(p => String(p.so)));
      const archivedSoSet = new Set((data?.archivedProjects || []).map(p => String(p.so)));

      const snapshots = await Promise.all(SO_KEYED_NODES.map(node => get(ref(db, node))));

      const bySo = {};
      SO_KEYED_NODES.forEach((node, i) => {
        const val = snapshots[i].val();
        if (!val) return;
        Object.keys(val).forEach(so => {
          if (liveSoSet.has(so) || archivedSoSet.has(so)) return; // not orphaned

          if (!bySo[so]) bySo[so] = { so, sources: [] };
          bySo[so].sources.push(node);

          if (node === 'project_designers' && typeof val[so] === 'string') {
            bySo[so].designer = val[so];
          }
          if (node === 'project_kanban_state' && typeof val[so] === 'string') {
            bySo[so].kanbanStage = val[so];
          }
          if (node === 'project_history' && Array.isArray(val[so])) {
            bySo[so].notesCount = val[so].length;
          }
          if (node === 'designer_performance_projects' && val[so]) {
            bySo[so].projectName = val[so].projectName || bySo[so].projectName;
            bySo[so].designer = bySo[so].designer || val[so].designerName;
          }
          // The engineer who actually worked the project — recorded on whoever
          // started/finished its engineering or nesting check, not the designer.
          if (node === 'engineering_checks' && val[so]?.user) {
            bySo[so].engineer = val[so].user;
          }
          if (node === 'nesting_checks' && val[so]?.user) {
            bySo[so].engineer = bySo[so].engineer || val[so].user;
          }
        });
      });

      setOrphans(Object.values(bySo).sort((a, b) => String(a.so).localeCompare(String(b.so))));
    } catch (err) {
      console.error('Failed to scan for orphaned projects:', err);
    } finally {
      setScanning(false);
    }
  };

  // Ingeniero que se va a guardar: lo que se haya escrito a mano, o lo detectado.
  const engineerFor = (orphan) =>
    engineerOverrides[orphan.so] ?? orphan.engineer ?? '';

  const handleArchive = async (orphan) => {
    setArchivingSo(orphan.so);
    setError(null);
    try {
      const eng = engineerFor(orphan).trim();
      await manuallyArchiveProject({
        so: orphan.so,
        name: orphan.projectName || `SO #${orphan.so}`,
        install: null,
        eng: eng || null,
      });
      setOrphans(prev => prev.filter(o => o.so !== orphan.so));
      // Sin esto el proyecto no aparece en Completados hasta recargar la pagina:
      // la lista de archivados se trae en la query principal del dashboard.
      await queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
    } catch (err) {
      // Antes esto solo iba a la consola: la fila quedaba en su lugar sin
      // ninguna explicacion y parecia que el boton no hacia nada.
      console.error('Failed to archive orphaned project:', err);
      setError(
        language === 'es'
          ? `No se pudo archivar el SO ${orphan.so}: ${err?.message || 'error desconocido'}`
          : `Could not archive SO ${orphan.so}: ${err?.message || 'unknown error'}`
      );
    } finally {
      setArchivingSo(null);
    }
  };

  return (
    <div className="table-container glass-card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '16px 16px 0' }}>
        <div>
          <h3 style={{ margin: 0 }}>{language === 'es' ? 'Proyectos Huérfanos' : 'Orphaned Projects'}</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 4, maxWidth: 520 }}>
            {language === 'es'
              ? 'Proyectos que ya no están en la hoja activa ni en el archivo de Completados, pero todavía tienen datos (notas, diseñador, etapa Kanban) guardados en la base de datos.'
              : 'Projects no longer in the active sheet or the Completed archive, but that still have leftover data (notes, designer, Kanban stage) saved in the database.'}
          </p>
        </div>
        <button className="btn-sm btn-secondary" onClick={handleScan} disabled={scanning}>
          {scanning ? <Loader2 size={14} className="spinner" /> : <Search size={14} />}
          {language === 'es' ? 'Buscar' : 'Scan'}
        </button>
      </div>

      <datalist id="orphan-engineers">
        {knownEngineers.map(name => <option key={name} value={name} />)}
      </datalist>

      <div style={{ padding: '16px' }}>
        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 14,
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171', fontSize: '0.85rem',
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}
        {orphans === null ? (
          <p className="text-muted">{language === 'es' ? 'Todavía no se buscó.' : 'Not scanned yet.'}</p>
        ) : orphans.length === 0 ? (
          <p className="text-muted">{language === 'es' ? 'No se encontraron proyectos huérfanos.' : 'No orphaned projects found.'}</p>
        ) : (
          <div className="table-responsive">
            <table className="materials-table">
              <thead>
                <tr>
                  <th>SO #</th>
                  <th>{language === 'es' ? 'Nombre' : 'Name'}</th>
                  <th>{language === 'es' ? 'Ingeniero' : 'Engineer'}</th>
                  <th>{language === 'es' ? 'Diseñador' : 'Designer'}</th>
                  <th>{language === 'es' ? 'Etapa Kanban' : 'Kanban Stage'}</th>
                  <th>{language === 'es' ? 'Notas' : 'Notes'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orphans.map(o => (
                  <tr key={o.so}>
                    <td>{o.so}</td>
                    <td>{o.projectName || '—'}</td>
                    {/* Editable: de un huerfano muchas veces no se puede deducir
                        quien lo trabajo, y sin ingeniero el proyecto archivado
                        no aparece en la vista personal de nadie. */}
                    <td>
                      <input
                        type="text"
                        list="orphan-engineers"
                        value={engineerFor(o)}
                        onChange={e => setEngineerOverrides(prev => ({ ...prev, [o.so]: e.target.value }))}
                        placeholder={language === 'es' ? 'Sin asignar' : 'Unassigned'}
                        style={{
                          width: '100%', minWidth: 120, padding: '5px 9px', borderRadius: 8,
                          background: 'rgba(255,255,255,0.05)', color: 'inherit',
                          border: `1px solid ${engineerFor(o).trim() ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.12)'}`,
                          fontSize: '0.85rem', outline: 'none',
                        }}
                      />
                    </td>
                    <td>{o.designer || '—'}</td>
                    <td>{o.kanbanStage || '—'}</td>
                    <td>{o.notesCount ?? 0}</td>
                    <td>
                      <button
                        className="btn-sm btn-primary"
                        onClick={() => handleArchive(o)}
                        disabled={archivingSo === o.so}
                        title={
                          engineerFor(o).trim()
                            ? (language === 'es' ? `Se asignará a ${engineerFor(o)}` : `Will be assigned to ${engineerFor(o)}`)
                            : (language === 'es'
                                ? 'Sin ingeniero: se archiva igual y aparece en Completados como sin asignar'
                                : 'No engineer: it is still archived and shows in Completed as unassigned')
                        }
                      >
                        {archivingSo === o.so ? <Loader2 size={14} className="spinner" /> : <Archive size={14} />}
                        {language === 'es' ? 'Archivar como Completado' : 'Archive as Completed'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
