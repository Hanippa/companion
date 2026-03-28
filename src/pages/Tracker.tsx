import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom"

export default function Tracker() {
    const navigate = useNavigate()
    async function handleLogout() {
      await supabase.auth.signOut()
      navigate("/login")
    }
  return (
  <div className="">
    Dashboard
      <button onClick={handleLogout}>
      Log out
    </button>
  </div>
  );
}