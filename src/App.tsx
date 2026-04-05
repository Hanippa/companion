
import { BrowserRouter, Routes, Route ,Navigate} from "react-router-dom"
import { useState, useEffect  } from 'react';
import { useNavigate } from "react-router-dom"
import './App.css'
import { useAuth  } from "./contexts/AuthContext"
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import { Spinner } from "./components/ui/spinner";
import { supabase } from "./lib/supabase";
import { TooltipProvider } from "@/components/ui/tooltip"


function App() {
    


  const { session , loading } = useAuth()
   useEffect(() => {
  }, [])

  if (loading){return <Spinner/>}
  return (
    <BrowserRouter>
    <TooltipProvider>
 <Routes>
      <Route
        path="/"
        element={
          session
            ? <Navigate to="/dashboard" replace />
            : <Navigate to="/login" replace />
        }
      />

      <Route path="/login" element={
        !session ? 
        <LoginPage /> : <Navigate to="/dashboard" replace/>} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

    </Routes>
    </TooltipProvider>
    </BrowserRouter>
  )
}

export default App