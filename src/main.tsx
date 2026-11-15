import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AstryxRoot } from './components/AstryxRoot.tsx'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AstryxRoot>
      <App />
    </AstryxRoot>
  </StrictMode>,
)
