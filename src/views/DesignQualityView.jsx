import React, { useState, useEffect } from 'react';
import { fetchAndParseQualityData } from '../utils/sheetParser';
import { useLanguage } from '../utils/LanguageContext';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

export default function DesignQualityView() {
  const { language } = useLanguage();
  const [data, setData] = useState({ kpiData: [], analysisText: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return <div className="loading-state text-muted" style={{ padding: '24px', color: '#94A3B8' }}>Loading Team Stats...</div>;
  }

  if (error) {
    return <div className="error-state text-danger" style={{ padding: '24px', color: '#FF2E93' }}>{error}</div>;
  }

  const { kpiData, analysisText } = data;

  return (
    <div className="design-quality-view animate-fade-in" style={{ padding: '24px' }}>
      <header className="dashboard-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Team Stats</h1>
        <p className="page-subtitle text-muted" style={{ color: '#94A3B8' }}>KPI Distribution Analysis</p>
      </header>

      {kpiData.length === 0 ? (
        <div className="glass-card text-muted" style={{ padding: '24px', color: '#94A3B8' }}>
          No data found in the spreadsheet tab.
        </div>
      ) : (
        <>
          <div className="glass-card" style={{ marginBottom: '24px', overflowX: 'auto', padding: '0 0 16px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '16px', color: '#80EE98', fontWeight: 600 }}>Engineer</th>
                  <th style={{ padding: '16px', color: '#80EE98', fontWeight: 600 }}>Own Points</th>
                  <th style={{ padding: '16px', color: '#80EE98', fontWeight: 600 }}>Revision Points</th>
                  <th style={{ padding: '16px', color: '#80EE98', fontWeight: 600 }}>Nesting Points</th>
                  <th style={{ padding: '16px', color: '#80EE98', fontWeight: 600 }}>Total KPI</th>
                </tr>
              </thead>
              <tbody>
                {kpiData.map((row, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} 
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px' }}>{row.engineer}</td>
                    <td style={{ padding: '16px', color: '#94A3B8' }}>{formatCurrency(row.ownPoints)}</td>
                    <td style={{ padding: '16px', color: '#94A3B8' }}>{formatCurrency(row.revisionPoints)}</td>
                    <td style={{ padding: '16px', color: '#94A3B8' }}>{formatCurrency(row.nestingPoints)}</td>
                    <td style={{ padding: '16px', fontWeight: 'bold', color: '#09D1C7' }}>{formatCurrency(row.totalKPI)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#fff', marginBottom: '20px', fontSize: '1.25rem', fontWeight: 600 }}>KPI Distribution Analysis</h3>
            
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ width: '100%', maxWidth: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {kpiData.map((row, index) => {
                  let barColor = 'linear-gradient(90deg, #09D1C7, #80EE98)'; // Default Mint/Cyan gradient
                  let labelColor = '#09D1C7';
                  let warningBadge = null;

                  if (row.percent < 10) {
                    barColor = 'linear-gradient(90deg, #FFE600, #FFAA00)'; // Yellow
                    labelColor = '#FFE600';
                    warningBadge = <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,230,0,0.1)', color: '#FFE600', marginLeft: '8px' }}>&lt; 10% Low</span>;
                  } else if (row.percent > 30) {
                    barColor = 'linear-gradient(90deg, #FF9500, #FF5E00)'; // Orange
                    labelColor = '#FF9500';
                    warningBadge = <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,149,0,0.1)', color: '#FF9500', marginLeft: '8px' }}>&gt; 30% High</span>;
                  }

                  return (
                    <div key={index} style={{ color: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{row.engineer}{warningBadge}</span>
                        <span style={{ fontWeight: 'bold', color: labelColor }}>{row.percent.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: '8px', width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${row.percent}%`, background: barColor, borderRadius: '4px', transition: 'width 0.5s ease-out' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {analysisText && (
                <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p style={{ color: '#94A3B8', lineHeight: '1.7', fontSize: '0.95rem', margin: 0 }}>
                    {analysisText}
                  </p>
                  <div style={{ marginTop: '12px', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255,255,255,0.01)' }}>
                    <h5 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
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
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
