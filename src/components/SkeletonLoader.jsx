import React from 'react';
import './SkeletonLoader.css';

export default function SkeletonLoader({ type = 'card', count = 1 }) {
  const items = Array.from({ length: count });

  if (type === 'chart') {
    return (
      <div className="skeleton-chart-container">
        <div className="skeleton-chart-header">
          <div className="skeleton-line short"></div>
          <div className="skeleton-line micro"></div>
        </div>
        <div className="skeleton-chart-bars">
          <div className="skeleton-bar h-lg"></div>
          <div className="skeleton-bar h-md"></div>
          <div className="skeleton-bar h-sm"></div>
          <div className="skeleton-bar h-lg"></div>
          <div className="skeleton-bar h-md"></div>
        </div>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="skeleton-table-container">
        <div className="skeleton-table-row header">
          <div className="skeleton-cell"></div>
          <div className="skeleton-cell"></div>
          <div className="skeleton-cell"></div>
        </div>
        {items.map((_, idx) => (
          <div key={idx} className="skeleton-table-row">
            <div className="skeleton-cell text"></div>
            <div className="skeleton-cell text short"></div>
            <div className="skeleton-cell badge"></div>
          </div>
        ))}
      </div>
    );
  }

  // Default: Card skeleton
  return (
    <div className="skeleton-cards-grid">
      {items.map((_, idx) => (
        <div key={idx} className="skeleton-card">
          <div className="skeleton-card-header">
            <div className="skeleton-circle"></div>
            <div className="skeleton-line micro"></div>
          </div>
          <div className="skeleton-line medium"></div>
          <div className="skeleton-line short"></div>
        </div>
      ))}
    </div>
  );
}
