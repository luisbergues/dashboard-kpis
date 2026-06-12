import React, { useState } from 'react';
import { LayoutDashboard, ListTodo, CircleDollarSign, Hammer, CalendarDays, LogOut, User, Briefcase, ChevronDown, Award } from 'lucide-react';
import { auth, signOut } from '../utils/firebase';
import { useLanguage } from '../utils/LanguageContext';
import './Navbar.css';

export default function Navbar({ activeTab, setActiveTab, userProfile }) {
  const { t, language, setLanguage } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const tabs = [
    { id: 'dashboard', label: t('navbar.dashboard'), icon: LayoutDashboard },
    { id: 'calendar', label: t('navbar.calendar'), icon: CalendarDays },
    ...(userProfile ? [{ id: 'my-projects', label: t('navbar.myProjects'), icon: Briefcase }] : []),
    { id: 'pipeline', label: t('navbar.pipeline'), icon: ListTodo },
    { id: 'costs', label: t('navbar.costs'), icon: CircleDollarSign },
    { id: 'materials', label: t('navbar.materials'), icon: Hammer },
    { id: 'quality', label: language === 'es' ? 'Calidad' : 'Quality', icon: Award }
  ];

  const languages = [
    {
      code: 'en',
      label: 'English',
      flag: (
        <svg className="flag-icon" viewBox="0 0 36 36" width="18" height="18" style={{ borderRadius: '50%' }}>
          <rect width="36" height="36" fill="#00247D"/>
          <path fill="#FFF" d="M15 0h6v36h-6zm0 0h36v6H0z"/>
          <path fill="#FFF" d="M0 0l36 36M36 0L0 36" stroke="#FFF" strokeWidth="4"/>
          <path fill="#CF142B" d="M16 0h4v36h-4zm-16 16h36v4H0z"/>
          <path fill="#CF142B" d="M0 0l36 36M36 0L0 36" stroke="#CF142B" strokeWidth="2"/>
        </svg>
      )
    },
    {
      code: 'es',
      label: 'Español',
      flag: (
        <svg className="flag-icon" viewBox="0 0 36 36" width="18" height="18" style={{ borderRadius: '50%' }}>
          <path fill="#FFD15C" d="M0 12h36v12H0z"/>
          <path fill="#E65545" d="M0 0h36v12H0zm0 24h36v12H0z"/>
        </svg>
      )
    }
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
          {/* Custom Language Dropdown Selector */}
          <div className="lang-selector-container">
            <button 
              className="lang-selector-btn"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              type="button"
            >
              <span>{language === 'es' ? 'ESPAÑOL' : 'ENGLISH'}</span>
              <ChevronDown size={14} className={`chevron-arrow ${isDropdownOpen ? 'open' : ''}`} />
            </button>
            
            {isDropdownOpen && (
              <div className="lang-dropdown-menu">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    className={`lang-dropdown-item ${language === lang.code ? 'active' : ''}`}
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <span className="lang-item-label">{lang.label}</span>
                    <span className="lang-item-flag">{lang.flag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="nav-user-profile">
            <div className="user-avatar">
              <User size={18} />
            </div>
            <div className="user-details">
              <span className="user-name">{userProfile.designerName || 'Designer'}</span>
              <span className="user-role">{t('common.engineering')}</span>
            </div>
          </div>
          <button 
            className="nav-btn signout-btn" 
            onClick={async () => {
              if (auth) {
                try {
                  await signOut(auth);
                } catch (error) {
                  alert(t('common.error') + ': ' + error.message);
                }
              }
            }}
            title={t('common.signOut')}
          >
            <LogOut size={18} className="nav-icon" />
            <span className="nav-label">{t('common.signOut')}</span>
          </button>
        </div>
      )}
    </nav>
  );
}

