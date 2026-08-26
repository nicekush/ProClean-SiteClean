import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error atrapado por ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    localStorage.removeItem('siteclean_session');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', padding: '24px', fontFamily: 'sans-serif' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '16px', maxWidth: '540px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '2px solid #FCA5A5' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#991B1B', marginBottom: '12px' }}>
              ⚠️ Se ha detectado un inconveniente de renderizado
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6, marginBottom: '20px' }}>
              La aplicación ha capturado una excepción no controlada en el navegador:
            </p>

            <div style={{ backgroundColor: '#FEF2F2', padding: '14px', borderRadius: '8px', border: '1px solid #FCA5A5', fontFamily: 'monospace', fontSize: '12px', color: '#991B1B', marginBottom: '24px', wordBreak: 'break-all' }}>
              {this.state.error?.toString() || 'Error desconocido de la interfaz.'}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={this.handleReset}
                style={{ backgroundColor: '#05A6A6', color: '#FFFFFF', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
              >
                🔄 Reiniciar Sesión y Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
