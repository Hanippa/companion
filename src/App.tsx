
import { BrowserRouter, Routes, Route } from "react-router-dom"
import './App.css'
import Footer from './components/Footer';
import Nav from './components/Nav';
import Tracker from "./pages/Tracker";
import LoginPage from "./pages/LoginPage";
import AccessibilityIcon from "./assets/AccessibilityIcon.png"


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
              <div className='font-fredoka flex flex-col h-full w-full'>
      <Nav/>
      <img className='absolute w-10 h-auto top-48 z-20' src={AccessibilityIcon}/>
      <Tracker />
      <Footer/>
    </div>
        } />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App