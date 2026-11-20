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
import { useTheme } from '../utils/ThemeContext';
import { chartColors, chartTooltip } from '../utils/chartColors';
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
  const { theme } = useTheme();
  // Chart.js dibuja en canvas: colores resueltos, no var(--token).
  const cc = chartColors(theme === 'light');
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
        backgroundColor: cc.accent,
        borderRadius: 6,
        borderWidth: 0,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 24 } },
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      },
      tooltip: {
        ...chartTooltip(theme === 'light'),
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
          color: cc.grid,
          drawBorder: false,
        },
        ticks: {
          color: cc.textMuted,
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
          color: cc.textMuted,
          maxRotation: 45,
          minRotation: 45,
          // Rotada a 45°, una etiqueta larga ("Cherry Luxury Interiors LLC")
          // se salia del canvas por la izquierda. El nombre completo queda en
          // el tooltip.
          callback: function(value) {
            const label = this.getLabelForValue(value);
            return label.length > 18 ? `${label.slice(0, 17)}…` : label;
          }
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

