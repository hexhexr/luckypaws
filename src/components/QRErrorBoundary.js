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
          <p>Please try copying the invoice text manually.</p>
          {this.state.error && <p style={{fontSize: 'small', marginTop: '10px'}}><strong>Error details:</strong> {this.state.error.toString()}</p>}
        </div>
      );
    }
    return this.props.children;
  }
}

export default QRErrorBoundary;