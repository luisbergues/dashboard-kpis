import React, { useMemo } from 'react';
import { Filter, Calendar, MapPin, User, X } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import './GlobalFilterBar.css';

export default function GlobalFilterBar({ filters, onChange, projects = [], onHoldNotes = [] }) {
  const { t } = useLanguage();

  // Extract unique designer names from both projects and hold notes
  const designers = useMemo(() => {
    const list = new Set();
    
    // Extract from active projects (eng field)
    projects.forEach(p => {
      if (p.eng && p.eng.trim()) {
        list.add(p.eng.trim());
      }
    });

    // Extract from hold notes (designer field)
    onHoldNotes.forEach(n => {
      if (n.designer) {
        // Clean up email/name strings
        const cleaned = n.designer.split('\n')[0].split('<')[0].replace(/[^a-zA-Z\s]/g, '').trim();
        if (cleaned) {
          list.add(cleaned);
        }
      }
    });

    return Array.from(list).sort();
  }, [projects, onHoldNotes]);

  const handleFilterChange = (key, value) => {
    onChange({
      ...filters,
      [key]: value
    });
  };

  const resetFilters = () => {
    onChange({
      dateRange: 'ALL',
      location: 'ALL',
      designer: 'ALL'
    });
  };

  const hasActiveFilters = filters.dateRange !== 'ALL' || filters.location !== 'ALL' || filters.designer !== 'ALL';

  return (
    <div className="global-filter-bar glass-card">
      <div className="filter-title">
        <Filter size={18} className="text-mint" />
        <span>{t('filters.title', 'Filters')}</span>
      </div>

      <div className="filters-inputs-row">
        {/* Date Filter */}
        <div className="filter-input-group">
          <Calendar size={14} className="input-icon" />
          <select
            name="dateRangeFilter"
            value={filters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="filter-select"
          >
            <option value="ALL">{t('filters.date.all', 'All Dates')}</option>
            <option value="TODAY">{t('filters.date.today', 'Today')}</option>
            <option value="THIS_WEEK">{t('filters.date.thisWeek', 'This Week')}</option>
            <option value="MONTH_ACTUAL">{t('filters.date.monthActual', 'Month Actual')}</option>
          </select>
        </div>

        {/* Location Filter */}
        <div className="filter-input-group">
          <MapPin size={14} className="input-icon" />
          <select
            name="locationFilter"
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
            className="filter-select"
          >
            <option value="ALL">{t('filters.location.all', 'All Locations')}</option>
            <option value="Miami">Miami</option>
            <option value="Boca Raton">Boca Raton</option>
            <option value="Naples">Naples</option>
          </select>
        </div>

        {/* Designer Filter */}
        <div className="filter-input-group">
          <User size={14} className="input-icon" />
          <select
            name="designerFilter"
            value={filters.designer}
            onChange={(e) => handleFilterChange('designer', e.target.value)}
            className="filter-select"
          >
            <option value="ALL">{t('filters.designer.all', 'All Designers')}</option>
            {designers.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Reset Filters button */}
        {hasActiveFilters && (
          <button onClick={resetFilters} className="btn-reset-filters animate-fade-in">
            <X size={14} />
            <span>{t('filters.clear', 'Clear')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
