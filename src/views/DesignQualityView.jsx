import React, { useMemo, useState, useEffect } from 'react';
import { Award, AlertTriangle, Clock } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useLanguage } from '../utils/LanguageContext';
import { db, ref, onValue } from '../utils/firebase';
import { calculateFileRequestsPercentage, calculateOnHoldTimeByDesigner } from '../services/kpiCalculator';
import SectionErrorBoundary from '../components/SectionErrorBoundary';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

export default function DesignQualityView({ data }) {
  const { t } = useLanguage();
  const [projectHistory, setProjectHistory] = useState({});

  useEffect(() => {
    if (!db) return;
    const historyRef = ref(db, 'project_history');
    const unsubscribe = onValue(historyRef, (snapshot) => {
      setProjectHistory(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);

  const { onHoldNotes = [], priorityAnalysis = [] } = data || {};

  const { designerStats, totalRequests } = useMemo(() => calculateFileRequestsPercentage(onHoldNotes, priorityAnalysis), [onHoldNotes, priorityAnalysis]);
  const onHoldStats = useMemo(() => calculateOnHoldTimeByDesigner(projectHistory, priorityAnalysis, onHoldNotes), [projectHistory, priorityAnalysis, onHoldNotes]);

  const chartData = useMemo(() => {
    // Sort designers by percentage
    const sortedEntries = Object.entries(designerStats).sort((a, b) => b[1].percentage - a[1].percentage);
    const labels = sortedEntries.map(e => e[0]);
    const datasetData = sortedEntries.map(e => e[1].percentage);

    return {
      labels,
      datasets: [
        {
          label: '% of Projects Delayed',
          data: datasetData,
          backgroundColor: '#FF2E93', // Theme pink
          borderRadius: 4,
        }
      ]
    };
  }, [designerStats]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(11, 21, 32, 0.95)',
        titleColor: '#80EE98',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const designer = context.label;
            const stats = designerStats[designer];
            if (!stats) return `${context.raw}%`;
            return `${context.raw}% (${stats.requests} requests out of ${stats.total} projects)`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: '#94A3B8', font: { size: 11 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
        ticks: { 
          color: '#64748B', 
          callback: function(value) { return value + "%"; }
        }
      }
    }
  };

  const holdTimeChartData = useMemo(() => {
    return {
      labels: onHoldStats.labels,
      datasets: [
        {
          label: 'Days on Hold',
          data: onHoldStats.data,
          backgroundColor: '#09D1C7', // Theme cyan
          borderRadius: 4,
        }
      ]
    };
  }, [onHoldStats]);

  const holdTimeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(11, 21, 32, 0.95)',
        titleColor: '#09D1C7',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => `${context.raw} Days`
        }
      }
    },
    scales: {
      x: { grid: { display: false, drawBorder: false }, ticks: { color: '#94A3B8', font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { color: '#64748B' } }
    }
  };

  return (
    <div className="design-quality-view animate-fade-in" style={{ padding: '24px' }}>
      <header className="dashboard-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Design Quality & Performance</h1>
        <p className="page-subtitle text-muted" style={{ color: '#94A3B8' }}>Tracking file requests and validation times</p>
      </header>

      <section className="kpi-metrics-row mb-xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-card kpi-card" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(11, 21, 32, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column' }}>
          <span className="kpi-label" style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '8px' }}>Total File Requests</span>
          <span className="kpi-value text-danger" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#FF2E93' }}>{totalRequests}</span>
        </div>
        <div className="glass-card kpi-card" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(11, 21, 32, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column' }}>
          <span className="kpi-label" style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '8px' }}>Global "Finals" Hold Time</span>
          <span className="kpi-value" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#09D1C7' }}>{onHoldStats.finalsTimeDays} Days</span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <SectionErrorBoundary title="Quality Chart Error">
        <section className="glass-card chart-section-full" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(11, 21, 32, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', height: '400px' }}>
          <div className="chart-section-header" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 className="section-title" style={{ margin: 0, color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle className="text-yellow" size={20} style={{ color: '#FFE600' }} />
              % of Delayed Projects (File Requests) by Designer
            </h3>
          </div>
          <div className="mixed-chart-container-wide" style={{ height: '320px', marginTop: '16px' }}>
            {Object.keys(designerStats).length === 0 ? (
              <div className="text-muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>
                No file requests detected.
              </div>
            ) : (
              <Bar data={chartData} options={chartOptions} />
            )}
          </div>
        </section>
      </SectionErrorBoundary>

      <SectionErrorBoundary title="Hold Time Chart Error">
        <section className="glass-card chart-section-full" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(11, 21, 32, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', height: '400px' }}>
          <div className="chart-section-header" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 className="section-title" style={{ margin: 0, color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock className="text-cyan" size={20} style={{ color: '#09D1C7' }} />
              Total Time on Hold by Designer
            </h3>
          </div>
          <div className="mixed-chart-container-wide" style={{ height: '320px', marginTop: '16px' }}>
            {onHoldStats.labels.length === 0 ? (
              <div className="text-muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>
                No active hold times.
              </div>
            ) : (
              <Bar data={holdTimeChartData} options={holdTimeOptions} />
            )}
          </div>
        </section>
      </SectionErrorBoundary>
      </div>
    </div>
  );
}
