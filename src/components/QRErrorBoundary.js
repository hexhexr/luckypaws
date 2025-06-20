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
      // FIX: Display a generic message to the user instead of the raw error string.
      return this.props.fallback || (
        <div className="alert alert-danger">
          <p>⚠️ Error displaying QR code.</p>
          <p>Please try copying the invoice text manually.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default QRErrorBoundary;