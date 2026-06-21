import React, { useState } from 'react';
import { LayoutDashboard, ListTodo, CircleDollarSign, Hammer, CalendarDays, LogOut, User, Briefcase, ChevronDown, Award } from 'lucide-react';
import { auth, db, ref, set, signOut } from '../utils/firebase';
import { useLanguage } from '../utils/LanguageContext';
import './Navbar.css';

export default function Navbar({ activeTab, setActiveTab, userProfile }) {
  const { t, language, setLanguage } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('engineer');

  const tabs = [
    { id: 'dashboard', label: t('navbar.dashboard'), icon: LayoutDashboard },
    { id: 'calendar', label: t('navbar.calendar'), icon: CalendarDays },
    ...(userProfile ? [{ id: 'my-projects', label: t('navbar.myProjects'), icon: Briefcase }] : []),
    { id: 'pipeline', label: t('navbar.pipeline'), icon: ListTodo },
    { id: 'materials', label: t('navbar.materials'), icon: Hammer },
    { id: 'quality', label: 'Team Stats', icon: Award }
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

  const openModal = () => {
    setNewName(userProfile?.designerName || '');
    setNewRole(userProfile?.role || 'engineer');
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !db) return;
    try {
      const userRef = ref(db, `users/${auth.currentUser.uid}`);
      await set(userRef, {
        ...userProfile,
        designerName: newName,
        role: newRole
      });
      setIsProfileModalOpen(false);
    } catch (error) {
      alert("Error saving profile: " + error.message);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (error) {
        alert(t('common.error') + ': ' + error.message);
      }
    }
  };

  const getRoleLabel = () => {
    if (userProfile?.role === 'administrative') {
      return language === 'es' ? 'Administrativo' : 'Administrative';
    }
    if (userProfile?.role === 'engineer_nester') {
      return language === 'es' ? 'Ingeniero - Nester' : 'Engineer - Nester';
    }
    return language === 'es' ? 'Ingeniero' : 'Engineering';
  };

  return (
    <>
      {/* Top Mobile Header */}
      {userProfile && (
        <div className="mobile-header">
          <div className="mobile-brand">
            <span className="brand-logo">JL</span>
            <span className="brand-text text-gradient">Engineering</span>
          </div>
          <div className="mobile-header-right">
            {/* Custom Language Dropdown Selector for Mobile */}
            <div className="lang-selector-container mobile-lang">
              <button 
                className="lang-selector-btn"
                onClick={() => setIsMobileDropdownOpen(!isMobileDropdownOpen)}
                type="button"
              >
                <span>{language.toUpperCase()}</span>
                <ChevronDown size={12} className={`chevron-arrow ${isMobileDropdownOpen ? 'open' : ''}`} />
              </button>
              
              {isMobileDropdownOpen && (
                <div className="lang-dropdown-menu">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      type="button"
                      className={`lang-dropdown-item ${language === lang.code ? 'active' : ''}`}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsMobileDropdownOpen(false);
                      }}
                    >
                      <span className="lang-item-label">{lang.label}</span>
                      <span className="lang-item-flag">{lang.flag}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Profile Capsule on Mobile */}
            <div className="nav-user-profile mobile-profile" onClick={openModal}>
              <div className="user-avatar">
                <User size={16} />
              </div>
              <div className="user-details">
                <span className="user-name">{userProfile.designerName || 'Designer'}</span>
                <span className="user-role">{getRoleLabel()}</span>
              </div>
            </div>

            {/* Sign Out Button on Mobile */}
            <button className="mobile-signout-btn" onClick={handleSignOut} title={t('common.signOut')}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation (Sidebar on Desktop, Tabbar on Mobile) */}
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

            <div className="nav-user-profile" onClick={openModal}>
              <div className="user-avatar">
                <User size={18} />
              </div>
              <div className="user-details">
                <span className="user-name">{userProfile.designerName || 'Designer'}</span>
                <span className="user-role">{getRoleLabel()}</span>
              </div>
            </div>
            <button 
              className="nav-btn signout-btn" 
              onClick={handleSignOut}
              title={t('common.signOut')}
            >
              <LogOut size={18} className="nav-icon" />
              <span className="nav-label">{t('common.signOut')}</span>
            </button>
          </div>
        )}
      </nav>

      {/* Profile Configuration Modal */}
      {isProfileModalOpen && (
        <div className="profile-modal-overlay" onClick={() => setIsProfileModalOpen(false)}>
          <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>{language === 'es' ? 'Configuración de Perfil' : 'Profile Settings'}</h3>
              <p>{language === 'es' ? 'Ajusta tu nombre o tu rol en la aplicación' : 'Adjust your name or app role'}</p>
            </div>
            <form onSubmit={handleSaveProfile} className="profile-modal-form">
              <div className="form-group">
                <label className="form-label">{language === 'es' ? 'Nombre del Diseñador' : 'Designer Name'}</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  className="form-input"
                  placeholder={language === 'es' ? 'Tu nombre de diseñador' : 'Your designer name'}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{language === 'es' ? 'Rol' : 'Role'}</label>
                <select 
                  value={newRole} 
                  onChange={(e) => setNewRole(e.target.value)} 
                  className="form-input form-select"
                >
                  <option value="engineer">{language === 'es' ? 'Ingeniero (Engineer)' : 'Engineer'}</option>
                  <option value="administrative">{language === 'es' ? 'Administrativo (Administrative)' : 'Administrative'}</option>
                  <option value="engineer_nester">{language === 'es' ? 'Ingeniero - Nester (Engineer - Nester)' : 'Engineer - Nester'}</option>
                </select>
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setIsProfileModalOpen(false)}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn-save">
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


