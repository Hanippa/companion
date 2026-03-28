
import { BrowserRouter, Routes, Route ,Navigate} from "react-router-dom"
import { useState, useEffect  } from 'react';
import { useNavigate } from "react-router-dom"
import './App.css'
import { useAuth  } from "./contexts/AuthContext"
import LoginPage from "./pages/LoginPage";
import Tracker from "./pages/Tracker";
import ProtectedRoute from "./components/ProtectedRoute";
import { supabase } from "./lib/supabase";


function App() {
    const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate("/login")
  }

  const { session , loading } = useAuth()
   useEffect(() => {
  }, [])

  if (loading){return <h1>loading...</h1>}
  return (
    <BrowserRouter>
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
        <Route path="/dashboard" element={<Tracker />} />
      </Route>

    </Routes>
    </BrowserRouter>
  )
}

export default App