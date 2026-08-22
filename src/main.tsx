import { Component, StrictMode, type PropsWithChildren } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends Component<PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ padding: '2rem', fontFamily: 'system-ui', color: '#e5e7eb', background: '#07140d', minHeight: '100vh' }}>
          <h1>Kebo could not start</h1>
          <p>{this.state.error.message}</p>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
