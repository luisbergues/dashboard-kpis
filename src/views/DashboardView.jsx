import React, { useState, useMemo } from 'react';
import { Clock, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, ListTodo, DollarSign, TrendingUp } from 'lucide-react';
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
import { Chart, Bar } from 'react-chartjs-2';
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
  if (!data) return <div className="loading">Cargando Dashboard...</div>;

  const { weekOverWeek, insights, meetingPoints, topCostProjects, weekLabels } = data;
  const [currentSlide, setCurrentSlide] = useState(0);

  // ─── Build Historical Chart (up to 10 weeks) ─────────────────────────────
  const historicalChartData = useMemo(() => {
    // If we have history from Firebase, use it for multi-bar chart
    if (weeklyHistory.length > 0) {
      // Each entry in weeklyHistory has: label, metrics: { 'Total Active Projects': { current: N }, ... }
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
        label: 'Total Active Projects',
        data: weeklyHistory.map(w => w.metrics?.['Total Active Projects']?.current ?? 0),
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
          label: metric,
          data: weeklyHistory.map(w => w.metrics?.[metric]?.current ?? 0),
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

    const prevLabel = weekLabels?.previous || 'Previous Week';
    const currLabel = weekLabels?.current || 'Current Week';

    return {
      labels: [prevLabel, currLabel],
      datasets: [
        {
          type: 'line',
          label: 'Total Active Projects',
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
          label: metric,
          data: getMetricData(metric),
          backgroundColor: METRIC_COLORS[metric],
          stack: 'Stack 0',
        }))
      ]
    };
  }, [weekOverWeek, weekLabels, weeklyHistory]);

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

  // ─── Financial Impact Analysis ──────────────────────────────────────────
  const processCost = (costStr) => parseFloat(costStr.replace(/[^0-9.-]+/g, ""));

  const financialChartData = useMemo(() => ({
    labels: (topCostProjects || []).map(p => {
      const name = p.name.split(':')[0];
      return name.length > 18 ? name.substring(0, 16) + '…' : name;
    }),
    datasets: [
      {
        label: 'Project Cost ($)',
        data: (topCostProjects || []).map(p => processCost(p.cost)),
        backgroundColor: function(context) {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return '#09D1C7';
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, '#09D1C7');
          gradient.addColorStop(1, '#80EE98');
          return gradient;
        },
        borderRadius: 6,
        borderWidth: 0,
      }
    ]
  }), [topCostProjects]);

  const financialChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(11, 21, 32, 0.95)',
        titleColor: '#80EE98',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
        ticks: { color: '#64748B', callback: value => '$' + (value / 1000).toFixed(0) + 'k' }
      },
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: '#94A3B8', maxRotation: 45, minRotation: 45, font: { size: 10 } }
      }
    }
  };

  const totalPipelineValue = (topCostProjects || []).reduce((sum, p) => sum + processCost(p.cost), 0);

  // ─── Subtitle with real dates from sheet ───────────────────────────────
  const subtitleText = `${weekLabels?.current || 'Current Week'} vs ${weekLabels?.previous || 'Previous Week'}`;

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

  return (
    <div className="dashboard-view animate-fade-in">
      <header className="dashboard-header">
        <h1 className="page-title">Weekly KPI Dashboard</h1>
        <p className="page-subtitle text-muted">{subtitleText}</p>
      </header>

      {/* Week over Week Comparison — Historical Chart (full width) */}
      <section className="glass-card chart-section-full">
        <div className="chart-section-header">
          <h3 className="section-title">
            <TrendingUp className="text-mint" size={20} />
            Week over Week Comparison
          </h3>
          <span className="history-badge">
            {weeklyHistory.length > 0 ? `${weeklyHistory.length} weeks tracked` : 'Current data'}
          </span>
        </div>
        <div className="mixed-chart-container-wide">
          <Chart type="bar" data={historicalChartData} options={chartOptions} />
        </div>
      </section>

      {/* Financial Impact Analysis */}
      {topCostProjects && topCostProjects.length > 0 && (
        <section className="glass-card financial-section">
          <div className="financial-header">
            <div>
              <h3 className="section-title">
                <DollarSign className="text-neon-green" size={20} />
                Financial Impact Analysis
              </h3>
              <p className="text-muted financial-subtitle">Top active projects by pipeline value</p>
            </div>
            <div className="total-pipeline-badge">
              <span className="pipeline-label">Total Pipeline</span>
              <span className="pipeline-value">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalPipelineValue)}</span>
            </div>
          </div>
          <div className="financial-chart-container">
            <Bar data={financialChartData} options={financialChartOptions} />
          </div>
        </section>
      )}

      {/* Summaries Row */}
      <div className="dashboard-summaries-row">
        <section className="glass-card insights-card">
          <div className="summary-block">
            <h3 className="section-title">
              <Clock className="text-mint" size={20} />
              Executive Summary
            </h3>
            <p className="insight-text">{insights.executive}</p>
          </div>
          
          <div className="summary-block mt-lg">
            <h3 className="section-title">
              <CheckCircle className="text-neon-green" size={20} />
              Weekly Summary
            </h3>
            <p className="insight-text">{insights.weekly}</p>
          </div>
        </section>
      </div>

      {/* Action Plan Carousel */}
      <section className="glass-card action-plan-carousel-card">
        <div className="carousel-header">
          <div className="carousel-title-area">
            <h3 className="section-title">
              <AlertTriangle className="text-yellow" size={20} />
              Action Plan & Priority Projects
            </h3>
            <span className="subtitle-tag">Immediate Attention Required</span>
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
            <p className="text-muted">No high priority projects requiring action.</p>
          ) : (
            <div className="projects-carousel-grid">
              {activeProjects.map((project, idx) => (
                <div key={idx} className={`project-carousel-card ${getStatusColorClass(project.status)}`}>
                  <div className="proj-card-header">
                    <span className="proj-so">#{project.so}</span>
                    <span className={`proj-status-badge ${getStatusColorClass(project.status)}`}>{project.status}</span>
                  </div>
                  <h4 className="proj-name" title={project.name}>{project.name}</h4>
                  <div className="proj-details">
                    <span className="details-label">Install Date:</span>
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
              Key Takeaways & Strategic Actions
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
      
      {/* Meeting Talking Points */}
      <section className="glass-card meeting-card full-width">
        <h3 className="section-title text-gradient">Meeting Talking Points</h3>
        <ul className="meeting-list">
          {meetingPoints.map((point, idx) => (
            <li key={idx}>{point.replace('- ', '')}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
