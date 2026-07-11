import React from 'react';

// Shared catch/recover logic for this app's error boundaries. Each concrete
// boundary (ErrorBoundary, SectionErrorBoundary, and the designer-performance
// sub-app's boundary) extends this for its own fallback UI and reset
// behavior — only the constructor/getDerivedStateFromError/componentDidCatch
// plumbing lives here, since that part was identical across all three.
export default class BaseErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`${this.constructor.name} caught an error:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }
    return this.props.children;
  }
}
