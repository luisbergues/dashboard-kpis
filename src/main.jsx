import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LanguageProvider } from './utils/LanguageContext'
import { ThemeProvider } from './utils/ThemeContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { enableServiceWorkerAutoReload } from './utils/swAutoReload'
import './index.css'

// Antes de montar: si ya hay una version nueva esperando, mejor recargar ahora
// que despues de que el usuario empiece a trabajar.
enableServiceWorkerAutoReload()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30 seconds
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)

