import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Admin from './Admin.jsx'

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
const RootComponent = normalizedPath === '/admin' ? Admin : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
)
