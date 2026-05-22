import React from 'react';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
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

  const { weekOverWeek, insights, meetingPoints, priorityAnalysis } = data;

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

  return (
    <div className="dashboard-view animate-fade-in">
      <header className="dashboard-header">
        <h1 className="page-title">Weekly KPI Dashboard</h1>
        <p className="page-subtitle text-muted">May 18, 2026 vs May 11, 2026</p>
      </header>

      <section className="glass-card chart-section">
        <h3 className="section-title">Week over Week Comparison</h3>
        <div className="mixed-chart-container">
          <Chart type="bar" data={chartData} options={chartOptions} />
        </div>
      </section>

      <div className="dashboard-content-grid">
        <section className="glass-card insights-card">
          <h3 className="section-title">
            <Clock className="text-mint" size={20} />
            Executive Summary
          </h3>
          <p className="insight-text">{insights.executive}</p>
          
          <h3 className="section-title mt-lg">
            <CheckCircle className="text-neon-green" size={20} />
            Weekly Summary
          </h3>
          <p className="insight-text">{insights.weekly}</p>
        </section>

        <section className="glass-card action-plan-card">
          <h3 className="section-title">
            <AlertTriangle className="text-yellow" size={20} />
            Action Plan & Key Takeaways
          </h3>
          <div className="action-plan-content">
            {insights.actionPlan.split('•').map((point, index) => (
              point.trim() ? (
                <div key={index} className="action-point">
                  <div className="action-bullet"></div>
                  <p>{point.trim()}</p>
                </div>
              ) : null
            ))}
          </div>
        </section>
        
        <section className="glass-card meeting-card full-width">
          <h3 className="section-title text-gradient">Meeting Talking Points</h3>
          <ul className="meeting-list">
            {meetingPoints.map((point, idx) => (
              <li key={idx}>{point.replace('- ', '')}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
