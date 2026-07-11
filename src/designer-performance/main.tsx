import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import BaseErrorBoundary from '../components/BaseErrorBoundary'
import './index.css'

class ErrorBoundary extends BaseErrorBoundary {
  renderFallback() {
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h1>Something went wrong.</h1>
        <pre>{this.state.error?.toString()}</pre>
        <pre>{this.state.error?.stack}</pre>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
