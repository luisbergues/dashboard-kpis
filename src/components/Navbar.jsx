import React from 'react';
import { LayoutDashboard, ListTodo, CircleDollarSign, Hammer, CalendarDays, LogOut, User, Briefcase } from 'lucide-react';
import { auth, signOut } from '../utils/firebase';
import './Navbar.css';

export default function Navbar({ activeTab, setActiveTab, userProfile }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    ...(userProfile ? [{ id: 'my-projects', label: 'My Projects', icon: Briefcase }] : []),
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
      {userProfile && (
        <div className="nav-user-section">
          <div className="nav-user-profile">
            <div className="user-avatar">
              <User size={18} />
            </div>
            <div className="user-details">
              <span className="user-name">{userProfile.designerName || 'Designer'}</span>
              <span className="user-role">Engineering</span>
            </div>
          </div>
          <button 
            className="nav-btn signout-btn" 
            onClick={() => auth && signOut(auth)}
            title="Sign Out"
          >
            <LogOut size={18} className="nav-icon" />
            <span className="nav-label">Sign Out</span>
          </button>
        </div>
      )}
    </nav>
  );
}
