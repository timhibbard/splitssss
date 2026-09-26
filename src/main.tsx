import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { pageAt } from './lib/pages'
import { followNewBuilds } from './lib/update'

followNewBuilds(() => pageAt(window.location.pathname, import.meta.env.BASE_URL) != null)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
