import React from 'react';
import { Check, Minus } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { shortProjectName } from '../utils/projectName';
import { formatDisplayDate } from '../utils/dateFormat';
import './MaterialsView.css';

export default function MaterialsView({ data }) {
  const { t, language } = useLanguage();
  if (!data) return null;

  const { materialRequirements } = data;

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
            {materialRequirements.map((item, idx) => (
              <tr key={idx}>
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
    </div>
  );
}

