// src/components/QRErrorBoundary.js
import React from 'react';

class QRErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("QR Code Generation/Display Error Caught by Boundary:", error, errorInfo);
    this.setState({ errorInfo: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="alert alert-danger">
          <p>⚠️ Error displaying QR code.</p>
          {/* --- FIX: Display generic message instead of raw error --- */}
          <p>Please try copying the invoice text manually. Details have been logged.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default QRErrorBoundary;