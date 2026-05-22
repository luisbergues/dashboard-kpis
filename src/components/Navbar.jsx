import React from 'react';
import { LayoutDashboard, ListTodo, CircleDollarSign, Hammer, CalendarDays } from 'lucide-react';
import './Navbar.css';

export default function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'pipeline', label: 'Pipeline', icon: ListTodo },
    { id: 'costs', label: 'Cost Analysis', icon: CircleDollarSign },
    { id: 'materials', label: 'Materials', icon: Hammer }
  ];

  return (
    <nav className="navbar glass-card">
      <div className="nav-brand">
        <span className="brand-logo">JL</span>
        <span className="brand-text text-gradient">Engineering</span>
      </div>
      <ul className="nav-links">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <li key={tab.id}>
              <button 
                className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="nav-icon" size={20} />
                <span className="nav-label">{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
