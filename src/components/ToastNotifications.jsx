import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, AlertCircle, CheckCircle } from 'lucide-react';
import './ToastNotifications.css';

/**
 * ToastNotifications - Displays real-time notifications based on actual app data.
 * Receives an optional `alerts` prop (array of { type, text }) from the parent.
 * No mock data — only real events are shown.
 */
export default function ToastNotifications({ alerts = [] }) {
  const [toasts, setToasts] = useState([]);
  const shownIds = useRef(new Set());

  useEffect(() => {
    if (!alerts || alerts.length === 0) return;

    alerts.forEach((alert) => {
      // Create a stable ID based on the alert content to avoid duplicates
      const stableId = `${alert.type}_${alert.text}`;
      if (shownIds.current.has(stableId)) return;

      shownIds.current.add(stableId);
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, ...alert }]);

      // Auto-remove after 6 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 6000);
    });
  }, [alerts]);

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle size={18} className="text-neon-green" />;
      case 'error': return <AlertCircle size={18} className="text-danger" />;
      case 'warning': return <AlertCircle size={18} className="text-yellow" />;
      default: return <Bell size={18} className="text-mint" />;
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast-notification toast-${toast.type}`}>
          <div className="toast-icon">{getIcon(toast.type)}</div>
          <div className="toast-content">{toast.text}</div>
          <button className="toast-close" onClick={() => dismissToast(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
