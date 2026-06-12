import React, { useState, useMemo } from 'react';
import { Clock, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, ListTodo, DollarSign, TrendingUp, Download } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  LineController,
  BarController
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import SkeletonLoader from '../components/SkeletonLoader';
import { exportToCSV } from '../utils/csvExport';
import { 
  calculateConversionRate, 
  calculateBudgetDeviation, 
  calculateAverageValidationTime, 
  predictBottlenecks, 
  getProjectLocation 
} from '../services/kpiCalculator';
import './DashboardView.css';

ChartJS.register(
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  LineController,
  BarController
);

// Metric colors used across historical bars
const METRIC_COLORS = {
  'Completed Projects': '#46DFB1',
  'ON HOLD': '#FFE600',
  'Check': '#80EE98',
  'Review': '#09D1C7',
  'Nesting': '#8A2BE2',
  'Engineering': '#FF2E93',
  'Check Eng': '#15919B',
  'Paperwork': '#0C6478'
};

const STACKED_METRICS = Object.keys(METRIC_COLORS);

export default function DashboardView({ data, weeklyHistory = [] }) {
  const { t, language } = useLanguage();
  
  if (!data) {
    return (
      <div className="dashboard-view animate-fade-in">
        <header className="dashboard-header">
          <SkeletonLoader type="text" width="250px" height="32px" />
          <SkeletonLoader type="text" width="180px" height="20px" className="mt-sm" />
        </header>
        <div className="mixed-chart-container-wide">
          <SkeletonLoader type="chart" />
        </div>
      </div>
    );
  }

  const { weekOverWeek = [], insights = {}, meetingPoints = [], topCostProjects = [], weekLabels = {}, financialImpact = { rows: [] } } = data;
  const [currentSlide, setCurrentSlide] = useState(0);

  const filteredProjects = data.priorityAnalysis || [];

  // ─── Calculate New KPIs ──────────────────────────────────────────────────
  const activeCount = filteredProjects.length;
  // Estimate completed based on weekOverWeek diff or similar, for now just use historical or dummy if not in data
  const completedCount = weekOverWeek.find(m => m.metric === 'Completed Projects')?.current || 0;
  
  const conversionRate = calculateConversionRate(completedCount, activeCount);
  const totalValueStr = financialImpact?.rows?.find(r => r.status === 'Total')?.value || '$0';
  const holdValueStr = financialImpact?.rows?.find(r => r.status === 'ON HOLD')?.value || '$0';
  const budgetDeviation = calculateBudgetDeviation(holdValueStr, totalValueStr);
  
  // Dummy engineering checks map for now as it's not present in sheet parser directly
  const dummyEngChecks = {
    '1': { started: '2026-06-10T10:00:00Z', finished: '2026-06-10T14:30:00Z' } // 4.5 hours
  };
  const avgValidationTime = calculateAverageValidationTime(dummyEngChecks);
  
  const bottleneckAlerts = predictBottlenecks(filteredProjects);

  const handleExportCSV = () => {
    // Map the projects to a nice flat structure for CSV
    const exportData = filteredProjects.map(p => ({
      SO_Number: p.so,
      Project_Name: p.name,
      Status: p.status,
      Designer: p.eng,
      Location: getProjectLocation(p),
      Install_Date: p.install,
      Total_Amount: p.totalAmt,
      Pending_Amount: p.pendingAmt,
      Hardware: p.hardware,
      Priority: p.priority,
      On_Hold_Reason: p.onHoldReason || ''
    }));
    
    exportToCSV(exportData, `dashboard_projects_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const getMetricLabel = (metricName) => {
    if (language === 'es') {
      switch (metricName) {
        case 'Completed Projects': return 'Proyectos Completados';
        case 'ON HOLD': return 'EN PAUSA (HOLD)';
        case 'Check': return 'Check';
        case 'Review': return 'Revisión';
        case 'Nesting': return 'Nesting';
        case 'Engineering': return 'Ingeniería';
        case 'Check Eng': return 'Check Ing.';
        case 'Paperwork': return 'Trámites (Paperwork)';
        case 'Total Active Projects': return 'Proyectos Activos';
        default: return metricName;
      }
    }
    return metricName;
  };

  // ─── Build Historical Chart (up to 10 weeks) ─────────────────────────────
  const historicalChartData = useMemo(() => {
    // If we have history from Firebase, use it for multi-bar chart
    if (weeklyHistory.length > 0) {
      // Each entry in weeklyHistory has: label, metrics: { 'Total Active Projects': N, ... }
      const labels = weeklyHistory.map(w => {
        // Shorten label: "JUNE 8, 2026" -> "Jun 8"
        const parts = w.label.match(/([A-Za-z]+)\s+(\d+)/);
        if (parts) {
          const month = parts[1].charAt(0).toUpperCase() + parts[1].slice(1, 3).toLowerCase();
          return `${month} ${parts[2]}`;
        }
        return w.label;
      });

      const datasets = [];

      // Line: Total Active Projects
      datasets.push({
        type: 'line',
        label: getMetricLabel('Total Active Projects'),
        data: weeklyHistory.map(w => {
          const v = w.metrics?.['Total Active Projects'];
          return typeof v === 'object' ? (v?.current ?? 0) : (v ?? 0);
        }),
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF',
        borderWidth: 3,
        pointBackgroundColor: '#FF2E93',
        pointBorderColor: '#FFFFFF',
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: false,
        tension: 0.3,
        yAxisID: 'y'
      });

      // Stacked bars for each metric
      STACKED_METRICS.forEach(metric => {
        datasets.push({
          type: 'bar',
          label: getMetricLabel(metric),
          data: weeklyHistory.map(w => {
            const v = w.metrics?.[metric];
            return typeof v === 'object' ? (v?.current ?? 0) : (v ?? 0);
          }),
          backgroundColor: METRIC_COLORS[metric],
          stack: 'Stack 0',
        });
      });

      return { labels, datasets };
    }

    // Fallback: only current sheet data (2 bars)
    const getMetricData = (metricName) => {
      const item = weekOverWeek.find(m => m.metric === metricName);
      return item ? [parseInt(item.previous, 10) || 0, parseInt(item.current, 10) || 0] : [0, 0];
    };

    const prevLabel = weekLabels?.previous || (language === 'es' ? 'Semana Anterior' : 'Previous Week');
    const currLabel = weekLabels?.current || (language === 'es' ? 'Semana Actual' : 'Current Week');

    return {
      labels: [prevLabel, currLabel],
      datasets: [
        {
          type: 'line',
          label: getMetricLabel('Total Active Projects'),
          data: getMetricData('Total Active Projects'),
          borderColor: '#FFFFFF',
          backgroundColor: '#FFFFFF',
          borderWidth: 3,
          pointBackgroundColor: '#FF2E93',
          pointBorderColor: '#FFFFFF',
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: false,
          tension: 0.3,
          yAxisID: 'y'
        },
        ...STACKED_METRICS.map(metric => ({
          type: 'bar',
          label: getMetricLabel(metric),
          data: getMetricData(metric),
          backgroundColor: METRIC_COLORS[metric],
          stack: 'Stack 0',
        }))
      ]
    };
  }, [weekOverWeek, weekLabels, weeklyHistory, language]);


  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: '#94A3B8',
          font: { family: 'Inter', size: 11 },
          boxWidth: 12,
          padding: 10,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(11, 21, 32, 0.95)',
        titleColor: '#80EE98',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false, drawBorder: false },
        ticks: { color: '#94A3B8', font: { size: 11 } }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
        ticks: { color: '#64748B' }
      }
    }
  };

  // ─── Financial Impact Analysis (from Sheet) ─────────────────────────────
  const processCost = (costStr) => parseFloat(costStr.replace(/[^0-9.-]+/g, ""));
  const fiRows = financialImpact?.rows || [];
  const fiDescription = financialImpact?.description || '';

  // Extract key values for display
  const fiOnHold = fiRows.find(r => r.status === 'ON HOLD');
  const fiInProgress = fiRows.find(r => r.status === 'In Progress');
  const fiTotal = fiRows.find(r => r.status === 'Total');
  const fiDelayedRisk = fiRows.find(r => r.status.includes('Delayed Risk'));

  const formatCurrency = (str) => {
    if (!str) return '$0';
    const num = processCost(str);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };

  // ─── Subtitle with real dates from sheet ───────────────────────────────
  const subtitleText = language === 'es' 
    ? `${weekLabels?.current || 'Semana Actual'} vs ${weekLabels?.previous || 'Semana Anterior'}`
    : `${weekLabels?.current || 'Current Week'} vs ${weekLabels?.previous || 'Previous Week'}`;

  // ─── Action Plan / Key Takeaways ───────────────────────────────────────
  const rawActionPoints = insights.actionPlan ? insights.actionPlan.split('•').map(p => p.trim()).filter(Boolean) : [];
  
  const actionProjects = [];
  const actionTakeaways = [];

  rawActionPoints.forEach(point => {
    const hasProjectID = /\[\d+\]/.test(point);
    const isHeader = point.includes('Requiring Immediate Action') || 
                     point.includes('Additional Critical Projects') || 
                     point.includes('Key Takeaways:');
                     
    if (hasProjectID && !isHeader) {
      const parts = point.split(' - ');
      const titlePart = parts[0] || '';
      const soMatch = titlePart.match(/\[(\d+)\]/);
      const so = soMatch ? soMatch[1] : '';
      let displayName = titlePart;
      if (titlePart.includes(':')) {
        displayName = titlePart.split(':')[0].trim();
      }
      let status = '';
      let install = '';
      let notes = '';
      parts.slice(1).forEach(part => {
        const lower = part.toLowerCase();
        if (lower.includes('status:')) {
          status = part.replace(/status:/gi, '').trim();
        } else if (lower.includes('install date:')) {
          install = part.replace(/install date:/gi, '').trim();
        } else if (lower.includes('currently in')) {
          status = part.replace(/currently in/gi, '').replace(/stage/gi, '').trim();
        } else {
          notes = part.trim();
        }
      });
      if (!status) status = 'Action Required';
      if (!install) install = 'TBD';
      actionProjects.push({ so, name: displayName, fullName: titlePart, status, install, notes });
    } else if (!isHeader && point.length > 5) {
      actionTakeaways.push(point);
    }
  });

  // Carousel Pagination
  const itemsPerPage = 10;
  const totalSlides = Math.ceil(actionProjects.length / itemsPerPage);
  const handlePrevSlide = () => setCurrentSlide(prev => (prev > 0 ? prev - 1 : totalSlides - 1));
  const handleNextSlide = () => setCurrentSlide(prev => (prev < totalSlides - 1 ? prev + 1 : 0));
  const activeProjects = actionProjects.slice(currentSlide * itemsPerPage, (currentSlide + 1) * itemsPerPage);

  const getStatusColorClass = (status) => {
    const s = status.toUpperCase();
    if (s.includes('HOLD')) return 'card-status-hold';
    if (s.includes('CHECK')) return 'card-status-check';
    if (s.includes('REVIEW')) return 'card-status-review';
    if (s.includes('ENG')) return 'card-status-eng';
    if (s.includes('NEST')) return 'card-status-nesting';
    return 'card-status-default';
  };

  const getStatusLabel = (status) => {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s.includes('HOLD')) return language === 'es' ? 'EN PAUSA' : 'ON HOLD';
    if (s.includes('CHECK')) return 'Check';
    if (s.includes('REVIEW')) return language === 'es' ? 'Revisión' : 'Review';
    if (s.includes('ENG')) return language === 'es' ? 'Ingeniería' : 'Engineering';
    if (s.includes('NEST')) return 'Nesting';
    return status;
  };

  return (
    <div className="dashboard-view animate-fade-in">
      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-subtitle text-muted">{subtitleText}</p>
        </div>
        <button onClick={handleExportCSV} className="btn-export-csv" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
          <Download size={16} />
          {language === 'es' ? 'Exportar CSV' : 'Export CSV'}
        </button>
      </header>

      {/* New KPIs Row */}
      <section className="kpi-metrics-row mb-xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-card kpi-card">
          <span className="kpi-label">Conversion Rate</span>
          <span className="kpi-value text-neon-green">{conversionRate}%</span>
        </div>
        <div className="glass-card kpi-card">
          <span className="kpi-label">Budget Deviation (Hold/Total)</span>
          <span className={`kpi-value ${budgetDeviation > 10 ? 'text-danger' : 'text-yellow'}`}>{budgetDeviation}%</span>
        </div>
        <div className="glass-card kpi-card">
          <span className="kpi-label">Avg. Validation Time</span>
          <span className="kpi-value text-mint">{avgValidationTime} hrs</span>
        </div>
        {bottleneckAlerts.length > 0 && (
          <div className="glass-card kpi-card" style={{ borderColor: 'var(--color-pink)' }}>
            <span className="kpi-label text-danger">Bottleneck Alerts</span>
            <span className="kpi-value text-danger">{bottleneckAlerts.length} Active</span>
          </div>
        )}
      </section>

      {/* Week over Week Comparison — Historical Chart (full width) */}
      <SectionErrorBoundary title="Historical Data Error">
        <section className="glass-card chart-section-full">
          <div className="chart-section-header">
            <h3 className="section-title">
              <TrendingUp className="text-mint" size={20} />
              {t('dashboard.wowTitle')}
            </h3>
            <span className="history-badge">
              {weeklyHistory.length > 0 ? `${weeklyHistory.length} ${t('dashboard.trackedWeeks')}` : t('dashboard.currentData')}
            </span>
          </div>
          <div className="mixed-chart-container-wide">
            <Chart type="bar" data={historicalChartData} options={chartOptions} />
          </div>
        </section>
      </SectionErrorBoundary>

      {/* Financial Impact Analysis (from Sheet) */}
      {fiRows.length > 0 && (
        <SectionErrorBoundary title="Financial Analysis Error">
          <section className="glass-card financial-section">
            <div className="financial-header">
              <div>
                <h3 className="section-title">
                  <DollarSign className="text-neon-green" size={20} />
                  {t('dashboard.financialTitle')}
                </h3>
                {fiDescription && <p className="text-muted financial-subtitle">{fiDescription}</p>}
              </div>
              {fiTotal && (
                <div className="total-pipeline-badge">
                  <span className="pipeline-label">{t('dashboard.totalPipeline')}</span>
                  <span className="pipeline-value">{formatCurrency(fiTotal.value)}</span>
                </div>
              )}
            </div>
            <div className="financial-cards-row">
              {fiOnHold && (
                <div className="fi-card fi-card-hold">
                  <span className="fi-card-label">{t('dashboard.onHoldValue')}</span>
                  <span className="fi-card-value fi-hold">{formatCurrency(fiOnHold.value)}</span>
                  <span className="fi-card-note">{t('dashboard.atRiskNote')}</span>
                </div>
              )}
              {fiInProgress && (
                <div className="fi-card fi-card-progress">
                  <span className="fi-card-label">{t('dashboard.inProgressValue')}</span>
                  <span className="fi-card-value fi-progress">{formatCurrency(fiInProgress.value)}</span>
                  <span className="fi-card-note">{t('dashboard.activeNote')}</span>
                </div>
              )}
              {fiDelayedRisk && (
                <div className="fi-card fi-card-risk">
                  <span className="fi-card-label">{t('dashboard.delayedRiskValue')}</span>
                  <span className="fi-card-value fi-risk">{formatCurrency(fiDelayedRisk.value)}</span>
                  <span className="fi-card-note">{t('dashboard.delayNote')}</span>
                </div>
              )}
              {fiTotal && (
                <div className="fi-card fi-card-total">
                  <span className="fi-card-label">{t('dashboard.totalPipeline')}</span>
                  <span className="fi-card-value fi-total">{formatCurrency(fiTotal.value)}</span>
                  <span className="fi-card-note">{t('dashboard.combinedNote')}</span>
                </div>
              )}
            </div>
          </section>
        </SectionErrorBoundary>
      )}

      {/* Summaries Row */}
      <div className="dashboard-summaries-row">
        <section className="glass-card insights-card">
          <div className="summary-block">
            <h3 className="section-title">
              <Clock className="text-mint" size={20} />
              {t('dashboard.execSummary')}
            </h3>
            <p className="insight-text">{insights.executive}</p>
          </div>
          
          <div className="summary-block mt-lg">
            <h3 className="section-title">
              <CheckCircle className="text-neon-green" size={20} />
              {t('dashboard.weeklySummary')}
            </h3>
            <p className="insight-text">{insights.weekly}</p>
          </div>
        </section>
      </div>

      {/* Action Plan Carousel */}
      <SectionErrorBoundary title="Action Plan Error">
        <section className="glass-card action-plan-carousel-card">
          <div className="carousel-header">
            <div className="carousel-title-area">
              <h3 className="section-title">
                <AlertTriangle className="text-yellow" size={20} />
                {t('dashboard.actionPlan')}
              </h3>
              <span className="subtitle-tag">{t('dashboard.immediateAttention')}</span>
            </div>
            {totalSlides > 1 && (
              <div className="carousel-controls">
                <button onClick={handlePrevSlide} className="carousel-btn" aria-label="Previous Page">
                  <ChevronLeft size={18} />
                </button>
                <span className="carousel-page-indicator">
                  {currentSlide + 1} / {totalSlides}
                </span>
                <button onClick={handleNextSlide} className="carousel-btn" aria-label="Next Page">
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

          <div className="carousel-content">
            {actionProjects.length === 0 ? (
              <p className="text-muted">{t('dashboard.noPriority')}</p>
            ) : (
              <div className="projects-carousel-grid">
                {activeProjects.map((project, idx) => (
                  <div key={idx} className={`project-carousel-card ${getStatusColorClass(project.status)}`}>
                    <div className="proj-card-header">
                      <span className="proj-so">#{project.so}</span>
                      <span className={`proj-status-badge ${getStatusColorClass(project.status)}`}>{getStatusLabel(project.status)}</span>
                    </div>
                    <h4 className="proj-name" title={project.name}>{project.name}</h4>
                    <div className="proj-details">
                      <span className="details-label">{t('common.installDate')}:</span>
                      <span className="details-value">{project.install}</span>
                    </div>
                    {project.notes && (
                      <div className="proj-notes" title={project.notes}>
                        {project.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {actionTakeaways.length > 0 && (
            <div className="carousel-takeaways">
              <h4 className="takeaways-title">
                <ListTodo size={16} className="text-neon-green" />
                {t('dashboard.keyTakeaways')}
              </h4>
              <div className="takeaways-grid">
                {actionTakeaways.map((takeaway, index) => (
                  <div key={index} className="takeaway-item">
                    <div className="takeaway-bullet"></div>
                    <p>{takeaway}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </SectionErrorBoundary>
      
      {/* Meeting Talking Points */}
      <section className="glass-card meeting-card full-width">
        <h3 className="section-title text-gradient">{t('dashboard.meetingPoints')}</h3>
        <ul className="meeting-list">
          {meetingPoints.map((point, idx) => (
            <li key={idx}>{point.replace('- ', '')}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

