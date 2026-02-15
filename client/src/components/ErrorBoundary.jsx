import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div style={{
                    padding: '20px',
                    backgroundColor: '#ffebee',
                    color: '#b71c1c',
                    height: '100vh',
                    overflow: 'auto',
                    fontFamily: 'monospace'
                }}>
                    <h1>⚠️ Algo salió mal</h1>
                    <p>La aplicación ha detectado un error.</p>

                    <div style={{ marginTop: '20px', padding: '10px', background: '#fff', border: '1px solid #ffcdd2' }}>
                        <h3>Error:</h3>
                        <pre style={{ whiteSpace: 'pre-wrap' }}>
                            {this.state.error && this.state.error.toString()}
                        </pre>
                    </div>

                    <div style={{ marginTop: '20px', padding: '10px', background: '#fff', border: '1px solid #ffcdd2' }}>
                        <h3>Stack Trace:</h3>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8em' }}>
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '30px',
                            padding: '15px 30px',
                            fontSize: '18px',
                            backgroundColor: '#d32f2f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px'
                        }}
                    >
                        RECARGAR APLICACIÓN
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
