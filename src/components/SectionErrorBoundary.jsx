import { AlertCircle } from 'lucide-react';
import BaseErrorBoundary from './BaseErrorBoundary';

export default class SectionErrorBoundary extends BaseErrorBoundary {
  renderFallback() {
    const { title = 'Error loading section', style = {} } = this.props;
    return (
      <div
        className="glass-card section-error-fallback"
        style={{
          borderColor: 'rgba(255, 46, 147, 0.2)',
          background: 'linear-gradient(135deg, rgba(255, 46, 147, 0.05) 0%, rgba(18, 33, 48, 0.2) 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          minHeight: '150px',
          gap: '10px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(255, 46, 147, 0.2)',
          ...style
        }}
      >
        <AlertCircle className="text-danger" size={24} style={{ color: 'var(--color-pink)' }} />
        <h4 style={{ fontSize: '1rem', color: '#fff', fontWeight: 600 }}>{title}</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Something went wrong when displaying this KPI component.
        </p>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            marginTop: '4px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
        >
          Retry
        </button>
      </div>
    );
  }
}
