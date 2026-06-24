import React, { useState } from 'react';
import { Bell, X, AlertCircle, Clock, MessageSquare } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import './NotificationBubble.css';

export default function NotificationBubble({ alerts = [], activeTab, onAlertClick }) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isSuppressed, setIsSuppressed] = useState(false);

  React.useEffect(() => {
    if (activeTab === 'dashboard') {
      setIsSuppressed(false);
    }
  }, [activeTab]);

  if (!alerts || alerts.length === 0 || isSuppressed) return null;

  return (
    <div className="notification-bubble-widget">
      {/* Dismiss Button */}
      {!isOpen && activeTab !== 'dashboard' && (
        <button 
          className="notification-dismiss-btn"
          onClick={() => setIsSuppressed(true)}
          title={language === 'es' ? 'Ocultar notificaciones' : 'Hide notifications'}
        >
          <X size={12} />
        </button>
      )}

      {/* Floating Toggle Button */}
      <button 
        className={`notification-toggle-btn ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        title={language === 'es' ? 'Notificaciones de Instalaciones Urgentes y Notas' : 'Urgent Install and Note Notifications'}
      >
        {isOpen ? <X size={24} /> : <Bell size={24} />}
        {!isOpen && (
          <span className="notification-badge">{alerts.length}</span>
        )}
      </button>

      {/* Popover Window */}
      {isOpen && (
        <div className="notification-window animate-slide-down">
          <div className="notification-header">
            <h3>{language === 'es' ? 'Notificaciones' : 'Notifications'}</h3>
            <span className="notification-count">{alerts.length} {language === 'es' ? 'nuevas' : 'new'}</span>
          </div>

          <div className="notification-list">
            {alerts.map((alert, idx) => (
              <div 
                key={`${alert.so}-${idx}`} 
                className={`notification-item ${alert.type}`}
                onClick={() => {
                  setIsOpen(false);
                  onAlertClick(alert);
                }}
              >
                <div className="notification-icon">
                  {alert.type === 'note' ? <MessageSquare size={18} /> : (alert.type === 'error' ? <AlertCircle size={18} /> : <Clock size={18} />)}
                </div>
                <div className="notification-content">
                  <p className="notification-text">{alert.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
