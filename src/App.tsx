
import { BrowserRouter, Routes, Route ,Navigate} from "react-router-dom"
import './App.css'
import { useAuth  } from "./contexts/AuthContext"
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import PointPage from "./pages/PointPage";
import PointEditPage from "./pages/PointEditPage";
import TrackPage from "./pages/TrackPage";
import ProfilePage from "./pages/ProfilePage";
import HelpPage from "./pages/HelpPage";
import SearchPage from "./pages/SearchPage";
import StatisticsPage from "./pages/StatisticsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { Spinner } from "./components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip"


function App() {
  const { session , loading } = useAuth()

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
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/:organizationSlug" element={<Dashboard />} />
        <Route path="/:organizationSlug/:pointSlug/edit" element={<PointEditPage />} />
        <Route path="/:organizationSlug/:pointSlug/track/:trackSlug" element={<TrackPage />} />
        <Route path="/:organizationSlug/:pointSlug" element={<PointPage />} />
      </Route>

    </Routes>
    </TooltipProvider>
    </BrowserRouter>
  )
}

export default App
