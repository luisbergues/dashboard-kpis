import React, { useState } from 'react';
import { Bell, X, AlertCircle, Clock, MessageSquare, Flag, AtSign } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import './NotificationBubble.css';

// El widget ya no se puede "ocultar" de forma permanente. Antes una X de 22x22
// flotaba encima de la campana y, al tocarla, hacia desaparecer TODO el widget
// por el resto de la sesion: sin confirmacion, sin deshacer y sin manera de
// recuperarlo salvo recargar — y lo que se perdia eran las alertas de
// instalaciones urgentes y notas. La unica via de retorno era un efecto que lo
// restauraba al entrar a Dashboard, un comportamiento invisible para el
// usuario. Ahora la X solo cierra el desplegable abierto, que es lo que
// cualquiera espera de una X en un popover.
export default function NotificationBubble({ alerts = [], onAlertClick }) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  if (!alerts || alerts.length === 0) return null;

  const toggleLabel = isOpen
    ? (language === 'es' ? 'Cerrar notificaciones' : 'Close notifications')
    : (language === 'es'
      ? `Notificaciones: ${alerts.length} sin leer`
      : `Notifications: ${alerts.length} unread`);

  return (
    <div className="notification-bubble-widget">
      {/* Floating Toggle Button */}
      <button
        type="button"
        className={`notification-toggle-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={toggleLabel}
        aria-expanded={isOpen}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="notification-count">{alerts.length} {language === 'es' ? 'nuevas' : 'new'}</span>
              {/* Cierra el desplegable, no oculta el widget: las alertas
                  siguen accesibles desde la campana. */}
              <button
                type="button"
                className="notification-dismiss-btn-inline"
                onClick={() => setIsOpen(false)}
                aria-label={language === 'es' ? 'Cerrar notificaciones' : 'Close notifications'}
              >
                {language === 'es' ? 'Cerrar' : 'Close'}
              </button>
            </div>
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
                  {alert.type === 'tag' ? <AtSign size={18} />
                    : alert.type === 'note' ? <MessageSquare size={18} />
                    : alert.type === 'designer_review' ? <Flag size={18} />
                    : alert.type === 'error' ? <AlertCircle size={18} />
                    : <Clock size={18} />}
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
