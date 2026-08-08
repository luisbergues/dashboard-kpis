import React, { useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { shortProjectName } from '../utils/projectName';
import { formatDisplayDate } from '../utils/dateFormat';
import './MaterialsView.css';

/* Cuantas filas se pintan de entrada y cuantas suma cada click en "Ver mas".
   La tabla no tiene paginado en el origen: se renderizaba la matriz completa
   de una, y cada fila trae 4 badges con su propio SVG, asi que con varios
   cientos de proyectos el arbol pasaba los ~10k nodos y el scroll se
   entrecortaba. Se pinta de a tandas en vez de virtualizar para no sumar una
   dependencia nueva; el contador deja claro que hay mas filas abajo. */
const PAGE_SIZE = 100;

export default function MaterialsView({ data }) {
  const { t, language } = useLanguage();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!data) return null;

  // Mismo guard que el resto de la app: `data` puede llegar sin la seccion si
  // el CSV cambio de forma. Antes `.map` sobre undefined tumbaba la vista.
  const rows = data.materialRequirements ?? [];
  const visibleRows = rows.slice(0, visibleCount);
  const hasMore = rows.length > visibleCount;

  const renderBadge = (value) => {
    if (value === 'Yes') return <div className="mat-badge badge-yes"><Check size={14} /> {t('common.yes')}</div>;
    if (value === 'No') return <div className="mat-badge badge-no"><Minus size={14} /> {t('common.no')}</div>;
    return <div className="mat-badge badge-unknown">{value}</div>;
  };

  return (
    <div className="materials-view animate-fade-in">
      <header className="view-header">
        <h1 className="page-title">{t('materials.title')}</h1>
        <p className="text-muted">{t('materials.subtitle')}</p>
      </header>

      {rows.length === 0 ? (
        <div className="glass-card text-muted" style={{ padding: 'var(--spacing-lg)' }}>
          {t('materials.empty')}
        </div>
      ) : (
        <>
          <div className="table-container glass-card h-scroll-shadow">
            <table className="materials-table">
              <thead>
                <tr>
                  <th>{t('materials.headers.so')}</th>
                  <th>{t('materials.headers.projectName')}</th>
                  <th>{t('materials.headers.installDate')}</th>
                  <th>{t('materials.headers.thermofoil')}</th>
                  <th>{t('materials.headers.noHoles')}</th>
                  <th>{t('materials.headers.dovetail')}</th>
                  <th>{t('materials.headers.element')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((item, idx) => (
                  <tr key={item.so ?? idx}>
                    <td className="so-cell">#{item.so}</td>
                    <td className="name-cell" title={item.name}>{shortProjectName(item.name)}</td>
                    <td className="date-cell">{formatDisplayDate(item.installDate, language)}</td>
                    <td>{renderBadge(item.thermofoil)}</td>
                    <td>{renderBadge(item.noHoles)}</td>
                    <td>{renderBadge(item.dovetail)}</td>
                    <td>{renderBadge(item.element)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="materials-pager">
            <span className="text-muted materials-pager-count">
              {visibleRows.length} / {rows.length}
            </span>
            {hasMore && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
                >
                  {t('materials.showMore')}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setVisibleCount(rows.length)}
                >
                  {t('materials.showAll')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
