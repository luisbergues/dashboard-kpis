import React, { useState, useEffect } from 'react';
import { fetchAndParseQualityData } from '../utils/sheetParser';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

export default function DesignQualityView() {
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
    return <div className="loading-state text-muted" style={{ padding: '24px', color: '#94A3B8' }}>Loading Quality & Performance KPIs...</div>;
  }

  if (error) {
    return <div className="error-state text-danger" style={{ padding: '24px', color: '#FF2E93' }}>{error}</div>;
  }

  const { kpiData, analysisText } = data;

  return (
    <div className="design-quality-view animate-fade-in" style={{ padding: '24px' }}>
      <header className="dashboard-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Design Quality & Performance</h1>
        <p className="page-subtitle text-muted" style={{ color: '#94A3B8' }}>KPI Distribution Analysis</p>
      </header>

      {kpiData.length === 0 ? (
        <div className="glass-card text-muted" style={{ padding: '24px', color: '#94A3B8' }}>
          No data found in the spreadsheet tab.
        </div>
      ) : (
        <>
          <div className="glass-card" style={{ marginBottom: '24px', overflowX: 'auto', padding: '0' }}>
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
            <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '1.25rem', fontWeight: 600 }}>KPI Distribution Analysis</h3>
            {analysisText && (
              <p style={{ color: '#94A3B8', lineHeight: '1.6', marginBottom: '24px', fontSize: '0.95rem' }}>
                {analysisText}
              </p>
            )}

            <div style={{ maxWidth: '400px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '12px 16px', color: '#80EE98', fontWeight: 600 }}>Engineer</th>
                    <th style={{ padding: '12px 16px', color: '#80EE98', fontWeight: 600 }}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiData.map((row, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px' }}>{row.engineer}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#09D1C7' }}>{row.percent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
