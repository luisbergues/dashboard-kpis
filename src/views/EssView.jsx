import { useState, useEffect, useMemo } from 'react';
import { Search, FileStack } from 'lucide-react';
import { db, ref, onValue } from '../utils/firebase';
import { useLanguage } from '../utils/LanguageContext';
import EssProjectDetail from './EssProjectDetail';

function statusFor(so, filesBySo, autoDataBySo) {
  if (autoDataBySo?.[so]) return 'generated';
  const files = filesBySo?.[so];
  if (files && (files.contract || files.quote || files.drawings)) return 'uploaded';
  return 'none';
}

export default function EssView({ data }) {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedSo, setSelectedSo] = useState(null);
  const [filesBySo, setFilesBySo] = useState({});
  const [autoDataBySo, setAutoDataBySo] = useState({});

  useEffect(() => {
    if (!db) return;
    const unsubFiles = onValue(ref(db, 'ess_files'), snap => setFilesBySo(snap.val() || {}));
    const unsubAuto = onValue(ref(db, 'essAutoData'), snap => setAutoDataBySo(snap.val() || {}));
    return () => { unsubFiles(); unsubAuto(); };
  }, []);

  const projects = useMemo(() => {
    const all = data?.priorityAnalysis || [];
    const term = search.trim().toLowerCase();
    const filtered = term
      ? all.filter(p => String(p.so).includes(term) || (p.name || '').toLowerCase().includes(term))
      : all;
    return [...filtered].sort((a, b) => String(a.so).localeCompare(String(b.so)));
  }, [data, search]);

  const selectedProject = selectedSo ? projects.find(p => String(p.so) === String(selectedSo)) || (data?.priorityAnalysis || []).find(p => String(p.so) === String(selectedSo)) : null;

  if (selectedProject) {
    return <EssProjectDetail project={selectedProject} onBack={() => setSelectedSo(null)} />;
  }

  const statusLabel = (status) => {
    if (status === 'generated') return language === 'es' ? 'ESS generada' : 'ESS generated';
    if (status === 'uploaded') return language === 'es' ? 'PDFs cargados' : 'PDFs uploaded';
    return language === 'es' ? 'Sin PDFs' : 'No PDFs';
  };

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FileStack size={20} /> {language === 'es' ? 'Generador de ESS' : 'ESS Generator'}
      </h2>
      <div style={{ position: 'relative', margin: '16px 0', maxWidth: '360px' }}>
        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={language === 'es' ? 'Buscar por SO o nombre...' : 'Search by SO or name...'}
          style={{ width: '100%', padding: '8px 8px 8px 32px' }}
        />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px' }}>SO</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'es' ? 'Proyecto' : 'Project'}</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'es' ? 'Estado' : 'Status'}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map(project => {
            const status = statusFor(project.so, filesBySo, autoDataBySo);
            return (
              <tr
                key={project.so}
                onClick={() => setSelectedSo(project.so)}
                style={{ cursor: 'pointer', borderTop: '1px solid var(--card-border, #333)' }}
              >
                <td style={{ padding: '8px' }}>{project.so}</td>
                <td style={{ padding: '8px' }}>{project.name}</td>
                <td style={{ padding: '8px' }}>{statusLabel(status)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
