import React, { useState } from 'react';
import { LayoutDashboard, ListTodo, CircleDollarSign, Hammer, CalendarDays, LogOut, User, Briefcase, ChevronDown, Award, Sun, Moon, Activity, ShieldCheck } from 'lucide-react';
import { auth, db, ref, set, signOut } from '../utils/firebase';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import './Navbar.css';

export default function Navbar({ activeTab, setActiveTab, userProfile, isSuperAdmin, pendingUsersCount = 0 }) {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const isDesigner = userProfile?.role === 'designer';

  const tabs = isDesigner ? [
    { id: 'pipeline', label: t('navbar.pipeline'), icon: ListTodo },
    { id: 'calendar', label: t('navbar.calendar'), icon: CalendarDays },
    { id: 'designer-performance', label: 'Designer Perf.', icon: Activity },
  ] : [
    { id: 'dashboard', label: t('navbar.dashboard'), icon: LayoutDashboard },
    { id: 'calendar', label: t('navbar.calendar'), icon: CalendarDays },
    ...(userProfile ? [{ id: 'my-projects', label: t('navbar.myProjects'), icon: Briefcase }] : []),
    { id: 'pipeline', label: t('navbar.pipeline'), icon: ListTodo },
    { id: 'materials', label: t('navbar.materials'), icon: Hammer },
    ...(userProfile?.role !== 'administrative' ? [{ id: 'quality', label: 'Team Stats', icon: Award }] : []),
    { id: 'designer-performance', label: 'Designer Perf.', icon: Activity },
    ...(isSuperAdmin ? [{ id: 'admin', label: t('navbar.admin'), icon: ShieldCheck, badge: pendingUsersCount > 0 }] : [])
  ];

  const openModal = () => {
    setNewName(userProfile?.designerName || '');
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !db) return;
    try {
      const nameRef = ref(db, `users/${auth.currentUser.uid}/designerName`);
      await set(nameRef, newName);
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
    if (userProfile?.role === 'designer') {
      return language === 'es' ? 'Diseñador' : 'Designer';
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
            {/* Theme Toggle Selector for Mobile */}
            <button 
              type="button"
              className={`theme-toggle-btn ${theme}`} 
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
            >
              <div className="theme-toggle-knob" />
              <span className="theme-toggle-icon sun">
                <Sun size={12} strokeWidth={2.5} />
              </span>
              <span className="theme-toggle-icon moon">
                <Moon size={12} fill="currentColor" strokeWidth={0} />
              </span>
            </button>

            {/* Language Slider Selector for Mobile */}
            <button 
              type="button"
              className={`lang-toggle-btn ${language}`} 
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              title={language === 'es' ? 'English' : 'Español'}
            >
              <div className="lang-toggle-knob" />
              <span className="lang-toggle-label es">ES</span>
              <span className="lang-toggle-label en">EN</span>
            </button>

            {/* Profile Capsule on Mobile */}
            <button type="button" className="nav-user-profile mobile-profile" onClick={openModal} aria-label={language === 'es' ? 'Editar perfil' : 'Edit profile'}>
              <div className="user-avatar">
                <User size={16} />
              </div>
              <div className="user-details">
                <span className="user-name">{userProfile.designerName || 'Designer'}</span>
                <span className="user-role">{getRoleLabel()}</span>
              </div>
            </button>

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
                  <span className="nav-icon-wrapper">
                    <Icon className="nav-icon" size={20} />
                    {tab.badge && <span className="nav-badge-dot" />}
                  </span>
                  <span className="nav-label">{tab.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {userProfile && (
          <div className="nav-user-section">
            {/* Controls Row (Theme & Language side-by-side) */}
            <div className="nav-controls-row">
              {/* Theme Toggle Selector */}
              <button 
                type="button"
                className={`theme-toggle-btn ${theme}`} 
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              >
                <div className="theme-toggle-knob" />
                <span className="theme-toggle-icon sun">
                  <Sun size={14} strokeWidth={2.5} />
                </span>
                <span className="theme-toggle-icon moon">
                  <Moon size={14} fill="currentColor" strokeWidth={0} />
                </span>
              </button>

              {/* Language Slider Selector */}
              <button 
                type="button"
                className={`lang-toggle-btn ${language}`} 
                onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
                title={language === 'es' ? 'English' : 'Español'}
              >
                <div className="lang-toggle-knob" />
                <span className="lang-toggle-label es">ES</span>
                <span className="lang-toggle-label en">EN</span>
              </button>
            </div>

            <button type="button" className="nav-user-profile" onClick={openModal} aria-label={language === 'es' ? 'Editar perfil' : 'Edit profile'}>
              <div className="user-avatar">
                <User size={18} />
              </div>
              <div className="user-details">
                <span className="user-name">{userProfile.designerName || 'Designer'}</span>
                <span className="user-role">{getRoleLabel()}</span>
              </div>
            </button>
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
              <p>{language === 'es' ? 'Ajusta tu nombre en la aplicación' : 'Adjust your name'}</p>
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
                <p className="form-static-value">{getRoleLabel()}</p>
                <p className="text-muted" style={{ fontSize: '0.8em', marginTop: '4px' }}>
                  {language === 'es' ? 'Solo un administrador puede cambiar tu rol.' : 'Only an administrator can change your role.'}
                </p>
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


