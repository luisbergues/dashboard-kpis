import BaseErrorBoundary from './BaseErrorBoundary';

class ErrorBoundary extends BaseErrorBoundary {
  renderFallback() {
    return (
      <div className="error-state" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Something went wrong loading this view.</h2>
        <p style={{ color: 'var(--accent)', marginTop: '1rem' }}>
          The data might be corrupted or missing fields. Try reloading the page.
        </p>
        <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', textAlign: 'left', opacity: 0.8, fontSize: '0.85em' }}>
          {this.state.error && this.state.error.toString()}
          <br />
          {this.state.errorInfo?.componentStack}
        </details>
        <button
          className="nav-btn"
          style={{ marginTop: '2rem', display: 'inline-block' }}
          onClick={() => window.location.reload()}
        >
          Reload Page
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
