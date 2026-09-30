import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './app/App.jsx'
import { AuthProvider } from './features/auth/AuthProvider.jsx'
import { ProfileProvider } from './features/settings/ProfileProvider.jsx'
import './styles/base.css'
import './styles/studio.css'
import './styles/workspace.css'
import './styles/ui-system.css'
import { initializeTheme } from './platform/preferences/theme'

try { document.documentElement.dataset.motion = localStorage.getItem('apexlog-motion') || 'full' } catch { /* Storage can be unavailable in private browsers. */ }
initializeTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
        <App />
        </ProfileProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              fontFamily: 'Inter, sans-serif',
            },
            success: { iconTheme: { primary: 'var(--green)', secondary: 'var(--bg-card)' } },
            error: { iconTheme: { primary: 'var(--red)', secondary: 'var(--bg-card)' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
