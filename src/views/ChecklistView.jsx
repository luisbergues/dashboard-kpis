import React, { useEffect, useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { loadChecklistState, saveChecklistState } from '../utils/checklistData';
import { CHECKLIST_SECTIONS, CHECKLIST_TOTAL_ITEMS } from '../utils/engineeringChecklistData';
import { useLanguage } from '../utils/LanguageContext';
import './ChecklistView.css';

const SECTION_TITLE_KEYS = {
  general: 'sectionGeneral',
  finalMeasurements: 'sectionFinalMeasurements',
  engineering: 'sectionEngineering',
  ess_ip: 'sectionEssIp',
  final: 'sectionFinal'
};

export default function ChecklistView({ so: propSo }) {
  const so = propSo || new URLSearchParams(window.location.search).get('checklist');
  const { t } = useLanguage();
  const cf = (key) => t(`myProjects.checklistForm.${key}`);

  const [checked, setChecked] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!so) { setIsLoading(false); return; }
      const data = await loadChecklistState(so);
      if (isMounted) {
        setChecked(data || {});
        setIsLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [so]);

  // Auto-save (debounced)
  useEffect(() => {
    if (isLoading || !so) return;
    const handler = setTimeout(() => {
      saveChecklistState(so, checked);
    }, 600);
    return () => clearTimeout(handler);
  }, [checked, isLoading, so]);

  const toggleItem = (itemId) => {
    setChecked(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const resetSection = (section) => {
    setChecked(prev => {
      const next = { ...prev };
      section.items.forEach(id => { delete next[id]; });
      return next;
    });
  };

  const totalChecked = Object.values(checked).filter(Boolean).length;

  if (isLoading) {
    return <div className="cl-loading">{cf('loading')}</div>;
  }

  if (!so) {
    return <div className="cl-loading">{cf('missingSo')}</div>;
  }

  return (
    <div className="cl-root">
      <div className="cl-window">
        <header className="cl-header">
          <h1>{cf('title')} — SO {so}</h1>
          <div className="cl-header-actions">
            <span className="cl-progress-badge">{cf('progress')}: {totalChecked}/{CHECKLIST_TOTAL_ITEMS}</span>
            <span className="cl-autosave">{cf('autoSaveActive')}</span>
            <a href={window.location.origin} className="cl-btn-secondary cl-btn-link">
              <ExternalLink size={14} /> {cf('openDashboard')}
            </a>
          </div>
        </header>

        <main className="cl-main">
          {CHECKLIST_SECTIONS.map((section) => {
            const texts = t(`myProjects.checklists.${section.key}`) || [];
            const sectionChecked = section.items.filter(id => checked[id]).length;
            const nestedUnder = section.nestedUnder || {};
            return (
              <div className="cl-section" key={section.key}>
                <div className="cl-section-header">
                  <h2>{cf(SECTION_TITLE_KEYS[section.key])}</h2>
                  <div className="cl-section-header-right">
                    <span className="cl-section-count">{sectionChecked}/{section.items.length}</span>
                    <button
                      type="button"
                      className="cl-reset-btn"
                      title={cf('resetSection')}
                      onClick={() => resetSection(section)}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
                <div className="cl-items">
                  {section.items.map((itemId, idx) => (
                    <label
                      key={itemId}
                      className={`cl-item${nestedUnder[itemId] ? ' cl-item-nested' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={!!checked[itemId]}
                        onChange={() => toggleItem(itemId)}
                      />
                      <span>{texts[idx] ?? itemId}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
}
