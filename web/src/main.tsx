import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import Preloader from './components/Preloader'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Preloader />
        <div className="grain-overlay" aria-hidden="true" />
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
