import React, { useState } from 'react';
import { Clock, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, ListTodo } from 'lucide-react';
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

export default function DashboardView({ data }) {
  if (!data) return <div className="loading">Cargando Dashboard...</div>;

  const { weekOverWeek, insights, meetingPoints } = data;
  const [currentSlide, setCurrentSlide] = useState(0);

  // Prepare Chart Data
  const getMetricData = (metricName) => {
    const item = weekOverWeek.find(m => m.metric === metricName);
    return item ? [parseInt(item.previous, 10) || 0, parseInt(item.current, 10) || 0] : [0, 0];
  };

  const chartData = {
    labels: ['Previous Week (May 11)', 'Current Week (May 18)'],
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
      {
        type: 'bar',
        label: 'Completed Projects',
        data: getMetricData('Completed Projects'),
        backgroundColor: '#46DFB1',
        stack: 'Stack 0',
      },
      {
        type: 'bar',
        label: 'ON HOLD',
        data: getMetricData('ON HOLD'),
        backgroundColor: '#FFE600',
        stack: 'Stack 0',
      },
      {
        type: 'bar',
        label: 'Check',
        data: getMetricData('Check'),
        backgroundColor: '#80EE98',
        stack: 'Stack 0',
      },
      {
        type: 'bar',
        label: 'Review',
        data: getMetricData('Review'),
        backgroundColor: '#09D1C7',
        stack: 'Stack 0',
      },
      {
        type: 'bar',
        label: 'Nesting',
        data: getMetricData('Nesting'),
        backgroundColor: '#8A2BE2',
        stack: 'Stack 0',
      },
      {
        type: 'bar',
        label: 'Engineering',
        data: getMetricData('Engineering'),
        backgroundColor: '#FF2E93',
        stack: 'Stack 0',
      },
      {
        type: 'bar',
        label: 'Check Eng',
        data: getMetricData('Check Eng'),
        backgroundColor: '#15919B',
        stack: 'Stack 0',
      },
      {
        type: 'bar',
        label: 'Paperwork',
        data: getMetricData('Paperwork'),
        backgroundColor: '#0C6478',
        stack: 'Stack 0',
      }
    ]
  };

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
          font: { family: 'Inter', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(11, 21, 32, 0.9)',
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
        ticks: { color: '#94A3B8' }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
        ticks: { color: '#64748B' }
      }
    }
  };

  // Parse Action Plan & Key Takeaways
  const rawActionPoints = insights.actionPlan ? insights.actionPlan.split('•').map(p => p.trim()).filter(Boolean) : [];
  
  const actionProjects = [];
  const actionTakeaways = [];

  rawActionPoints.forEach(point => {
    // Check if the point contains a project SO# e.g., [12345]
    const hasProjectID = /\[\d+\]/.test(point);
    
    // Check if it's a section header or key takeaway title
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
      
      actionProjects.push({
        so,
        name: displayName,
        fullName: titlePart,
        status,
        install,
        notes
      });
    } else if (!isHeader && point.length > 5) {
      actionTakeaways.push(point);
    }
  });

  // Carousel Pagination Configuration
  const itemsPerPage = 10;
  const totalSlides = Math.ceil(actionProjects.length / itemsPerPage);
  
  const handlePrevSlide = () => {
    setCurrentSlide(prev => (prev > 0 ? prev - 1 : totalSlides - 1));
  };
  
  const handleNextSlide = () => {
    setCurrentSlide(prev => (prev < totalSlides - 1 ? prev + 1 : 0));
  };
  
  const activeProjects = actionProjects.slice(
    currentSlide * itemsPerPage,
    (currentSlide + 1) * itemsPerPage
  );

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
        <p className="page-subtitle text-muted">May 18, 2026 vs May 11, 2026</p>
      </header>

      {/* Top Row: Graph (Left) & Summaries (Right) */}
      <div className="dashboard-top-row">
        <section className="glass-card chart-section-wrapper">
          <h3 className="section-title">Week over Week Comparison</h3>
          <div className="mixed-chart-container">
            <Chart type="bar" data={chartData} options={chartOptions} />
          </div>
        </section>

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

      {/* Middle Row: Action Plan Carousel (Full Width) */}
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

        {/* Takeaways Alert Banner inside Action Plan card */}
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
      
      {/* Bottom Row: Meeting Talking Points */}
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
