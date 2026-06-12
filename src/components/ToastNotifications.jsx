import React, { useState, useEffect } from 'react';
import { Bell, X, AlertCircle, CheckCircle } from 'lucide-react';
import './ToastNotifications.css';

const MOCK_ALERTS = [
  { type: 'warning', text: 'Project #90210 has been put ON HOLD.' },
  { type: 'success', text: 'Engineering check completed for Project #88214.' },
  { type: 'info', text: 'New project assigned to Miami team.' },
  { type: 'error', text: 'High priority bottleneck detected: 4 installations tomorrow.' }
];

export default function ToastNotifications() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    // Simulate WebSocket connection and incoming messages
    const interval = setInterval(() => {
      const randomAlert = MOCK_ALERTS[Math.floor(Math.random() * MOCK_ALERTS.length)];
      const id = Date.now();
      setToasts(prev => [...prev, { id, ...randomAlert }]);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
    }, 45000); // Every 45 seconds mock a notification

    return () => clearInterval(interval);
  }, []);

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
