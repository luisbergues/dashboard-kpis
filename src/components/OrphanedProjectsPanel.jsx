import React, { useState } from 'react';
import { Search, Archive, Loader2 } from 'lucide-react';
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
  const [scanning, setScanning] = useState(false);
  const [orphans, setOrphans] = useState(null); // null = not scanned yet
  const [archivingSo, setArchivingSo] = useState(null);

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

  const handleArchive = async (orphan) => {
    setArchivingSo(orphan.so);
    try {
      await manuallyArchiveProject({
        so: orphan.so,
        name: orphan.projectName || `SO #${orphan.so}`,
        install: null,
        eng: orphan.engineer || null,
      });
      setOrphans(prev => prev.filter(o => o.so !== orphan.so));
    } catch (err) {
      console.error('Failed to archive orphaned project:', err);
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

      <div style={{ padding: '16px' }}>
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
                    <td>{o.engineer || '—'}</td>
                    <td>{o.designer || '—'}</td>
                    <td>{o.kanbanStage || '—'}</td>
                    <td>{o.notesCount ?? 0}</td>
                    <td>
                      <button
                        className="btn-sm btn-primary"
                        onClick={() => handleArchive(o)}
                        disabled={archivingSo === o.so}
                        title={
                          o.engineer
                            ? (language === 'es' ? `Se asignará a ${o.engineer}` : `Will be assigned to ${o.engineer}`)
                            : (language === 'es' ? 'No se detectó un ingeniero — quedará sin asignar' : 'No engineer detected — will be left unassigned')
                        }
                      >
                        <Archive size={14} />
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
