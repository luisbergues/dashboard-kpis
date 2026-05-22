import React from 'react';
import { Check, Minus } from 'lucide-react';
import './MaterialsView.css';

export default function MaterialsView({ data }) {
  if (!data) return null;

  const { materialRequirements } = data;

  const renderBadge = (value) => {
    if (value === 'Yes') return <div className="mat-badge badge-yes"><Check size={14} /> Yes</div>;
    if (value === 'No') return <div className="mat-badge badge-no"><Minus size={14} /> No</div>;
    return <div className="mat-badge badge-unknown">{value}</div>;
  };

  return (
    <div className="materials-view animate-fade-in">
      <header className="view-header">
        <h1 className="page-title">Materials Requirements</h1>
        <p className="text-muted">Active projects materials matrix</p>
      </header>

      <div className="table-container glass-card">
        <table className="materials-table">
          <thead>
            <tr>
              <th>SO#</th>
              <th>Project Name</th>
              <th>Install Date</th>
              <th>Thermofoil</th>
              <th>No Holes</th>
              <th>Dovetail</th>
              <th>Element</th>
            </tr>
          </thead>
          <tbody>
            {materialRequirements.map((item, idx) => (
              <tr key={idx}>
                <td className="so-cell">#{item.so}</td>
                <td className="name-cell">{item.name}</td>
                <td className="date-cell">{item.installDate}</td>
                <td>{renderBadge(item.thermofoil)}</td>
                <td>{renderBadge(item.noHoles)}</td>
                <td>{renderBadge(item.dovetail)}</td>
                <td>{renderBadge(item.element)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
