import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './app/App.jsx'
import { AuthProvider } from './features/auth/AuthProvider.jsx'
import './styles/base.css'
import './styles/studio.css'

try { document.documentElement.dataset.motion = localStorage.getItem('apexlog-motion') || 'full' } catch { /* Storage can be unavailable in private browsers. */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              fontFamily: 'DM Sans, sans-serif',
            },
            success: { iconTheme: { primary: '#f1b657', secondary: '#181c1d' } },
            error: { iconTheme: { primary: '#f19a9a', secondary: '#181c1d' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
