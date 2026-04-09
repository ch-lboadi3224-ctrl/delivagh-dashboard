import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Admin from './Admin.jsx'

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
const RootComponent = normalizedPath === '/admin' ? Admin : App

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Root render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117', color: '#e6edf3', padding: '24px', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ maxWidth: '760px', background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: '18px' }}>Runtime Error</h2>
            <p style={{ margin: '0 0 10px', color: '#9fb0c3', fontSize: '14px' }}>The app failed to render. The details below will help us fix it quickly.</p>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px', color: '#fca5a5' }}>
              {String(this.state.error?.message || this.state.error || 'Unknown render error')}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <RootComponent />
    </RootErrorBoundary>
  </StrictMode>,
)
