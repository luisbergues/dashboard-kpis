import React from 'react';
import { useLanguage } from '../utils/LanguageContext';
import { shortProjectName } from '../utils/projectName';
import SkeletonLoader from '../components/SkeletonLoader';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './CostAnalysisView.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function CostAnalysisView({ data }) {
  const { t, language } = useLanguage();
  if (!data) return <SkeletonLoader type="table" count={5} />;

  const { topCostProjects } = data;

  // Process data to get numbers from currency strings
  const processCost = (costStr) => {
    return parseFloat(costStr.replace(/[^0-9.-]+/g,""));
  };

  const chartData = {
    labels: topCostProjects.map(p => shortProjectName(p.name)), // Use short names
    datasets: [
      {
        label: language === 'es' ? 'Costo del Proyecto ($)' : 'Project Cost ($)',
        data: topCostProjects.map(p => processCost(p.cost)),
        backgroundColor: function(context) {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, '#09D1C7');
          gradient.addColorStop(1, '#80EE98');
          return gradient;
        },
        borderRadius: 6,
        borderWidth: 0,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(11, 21, 32, 0.9)',
        titleColor: '#80EE98',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
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
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748B',
          callback: function(value) {
            return '$' + value / 1000 + 'k';
          }
        }
      },
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: '#94A3B8',
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  const totalValue = topCostProjects.reduce((sum, p) => sum + processCost(p.cost), 0);

  return (
    <div className="costs-view animate-fade-in">
      <header className="view-header">
        <div>
          <h1 className="page-title">{t('costs.title')}</h1>
          <p className="text-muted">{t('costs.subtitle')}</p>
        </div>
        
        <div className="total-value-card glass-card">
          <span className="text-muted">{t('costs.totalPipeline')}</span>
          <h2>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue)}</h2>
        </div>
      </header>

      <div className="chart-container glass-card">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

