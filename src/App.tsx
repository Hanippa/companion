
import { BrowserRouter, Routes, Route ,Navigate} from "react-router-dom"
import { useAuth  } from "./contexts/AuthContext"
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import PointPage from "./pages/PointPage";
import PointEditPage from "./pages/PointEditPage";
import PointTeamPage from "./pages/PointTeamPage";
import TrackCreatePage from "./pages/TrackCreatePage";
import TrackPage from "./pages/TrackPage";
import TrackTypesPage from "./pages/TrackTypesPage";
import OrganizationTeamPage from "./pages/OrganizationTeamPage";
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
        <Route path="/:organizationSlug/team" element={<OrganizationTeamPage />} />
        <Route path="/:organizationSlug/track-types" element={<TrackTypesPage />} />
        <Route path="/:organizationSlug/:pointSlug/team" element={<PointTeamPage />} />
        <Route path="/:organizationSlug/:pointSlug/edit" element={<PointEditPage />} />
        <Route path="/:organizationSlug/:pointSlug/track/new" element={<TrackCreatePage />} />
        <Route path="/:organizationSlug/:pointSlug/track/:trackSlug" element={<TrackPage />} />
        <Route path="/:organizationSlug/:pointSlug" element={<PointPage />} />
      </Route>

    </Routes>
    </TooltipProvider>
    </BrowserRouter>
  )
}

export default App
