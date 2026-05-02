import { StrictMode, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './components/App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 14 }}>
          <h1 style={{ color: 'red' }}>Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Also catch unhandled errors
window.addEventListener('error', (e) => {
  document.getElementById('root')!.innerHTML += `<pre style="color:red;padding:20px;font-size:12px">GLOBAL: ${e.message}\n${e.filename}:${e.lineno}</pre>`;
});
window.addEventListener('unhandledrejection', (e) => {
  document.getElementById('root')!.innerHTML += `<pre style="color:red;padding:20px;font-size:12px">PROMISE: ${e.reason}</pre>`;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
