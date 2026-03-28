
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { useState, useEffect  } from 'react';
import './App.css'
import Footer from './components/Footer';
import Nav from './components/Nav';
import Tracker from "./pages/Tracker";
import AccessibilityIcon from "./assets/AccessibilityIcon.png"
import { useAuth } from "./contexts/AuthContext"
import { supabase } from './lib/supabase'
import LoginPage from "./pages/LoginPage";


function App() {

const [organizations, setOrganizations] = useState<any[]>([])
const [points , setPoints] = useState<any[]>([])
const [allusers , setAllusers] = useState<any[]>([])

  const fetchUserOrganizations = async () => {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')  // you can select specific columns: 'id, name, status'
  
  if (error) {
    console.error('Error fetching orgs:', error)
    return []
  }

  return data
}

  const fetchUserPoints = async () => {
  const { data, error } = await supabase
    .from('points')
    .select('*')  // you can select specific columns: 'id, name, status'
  
  if (error) {
    console.error('Error fetching orgs:', error)
    return []
  }

  return data
}

  const fetchAllUsers = async () => {
  const { data, error } = await supabase
    .from('point_users')
    .select('*')  // you can select specific columns: 'id, name, status'
  
  if (error) {
    console.error('Error fetching orgs:', error)
    return []
  }

  return data
}

  const { session } = useAuth()

   useEffect(() => {
    const loadOrganizations = async () => {
      const data = await fetchUserOrganizations()
      setOrganizations(data)
    }
      const loadPoints = async () => {
      const data = await fetchUserPoints()
      setPoints(data)
    }
       const loadAllusers = async () => {
      const data = await fetchAllUsers()
      setAllusers(data)
    }


    loadOrganizations()
    loadPoints()
    loadAllusers()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
              <div className='font-fredoka flex flex-col h-full w-full'>
      <Nav/>
      <img className='absolute w-10 h-auto top-48 z-20' src={AccessibilityIcon}/>
      {/* <Tracker /> */}
      <h1>Supabase testing data</h1>
      <h1>user : {session?.user.email}</h1>
          <div>
      <h1>Your Organizations</h1>
      {organizations.map(org => (
        <div key={org.id}>
          <h2>{org.name} , {org.notes} , {org.status}</h2>
        </div>
      ))}
      <h1>Your Points</h1>
            {points.map(point => (
        <div key={point.id}>
          <h2>{point.name} , {point.notes} , {point.status}</h2>
        </div>
      ))}
       {allusers.map(allusers => (
        <div key={allusers.id}>
          <h2>{allusers.title} , {allusers.status} , {allusers.role}</h2>
        </div>
      ))}
    </div>
      <Footer/>
    </div>
        } />
        <Route path="/login" element={<div className='flex justify-center items-center h-full w-full'><LoginPage/></div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App