import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from "./contexts/AuthContext"
import './index.css'
import App from './App.tsx'
import { DirectionProvider } from "@/components/ui/direction"

createRoot(document.getElementById('root')!).render(
    <StrictMode>
    <AuthProvider>
      <DirectionProvider dir="rtl">
      <App />
      </DirectionProvider>
    </AuthProvider>
  </StrictMode>
)
