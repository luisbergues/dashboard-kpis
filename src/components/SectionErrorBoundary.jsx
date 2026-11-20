import { AlertCircle } from 'lucide-react';
import BaseErrorBoundary from './BaseErrorBoundary';

export default class SectionErrorBoundary extends BaseErrorBoundary {
  renderFallback() {
    const { title = 'Error loading section', style = {} } = this.props;
    return (
      <div
        className="glass-card section-error-fallback"
        style={{
          borderColor: 'var(--danger-line)',
          background: 'var(--danger-soft)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          minHeight: '150px',
          gap: '10px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--danger-line)',
          ...style
        }}
      >
        <AlertCircle className="text-danger" size={24} style={{ color: 'var(--color-pink)' }} />
        <h4 style={{ fontSize: '1rem', color: 'var(--text)', fontWeight: 600 }}>{title}</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Something went wrong when displaying this KPI component.
        </p>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          style={{
            background: 'var(--overlay-05)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            marginTop: '4px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = 'var(--overlay-10)'}
          onMouseOut={(e) => e.target.style.background = 'var(--overlay-05)'}
        >
          Retry
        </button>
      </div>
    );
  }
}
