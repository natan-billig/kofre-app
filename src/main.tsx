import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './lib/i18n/LanguageContext'
import { ThemeProvider } from './lib/theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)

// Auto-update transparente e invalidação de cache do Service Worker PWA
if ('serviceWorker' in navigator) {
  let isRefreshing = false

  // Dispara recarga transparente assim que o novo SW assume o controle
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isRefreshing) {
      isRefreshing = true
      window.location.reload()
    }
  })

  // Ao alternar para o app/aba visível, força verificação de versão no servidor
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.update().catch(() => {})
        }
      }).catch(() => {})
    }
  })
}

