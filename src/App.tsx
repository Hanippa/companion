
import './App.css'
import Footer from './components/Footer';
import Nav from './components/Nav';
import Tracker from "./pages/Tracker";
import AccessibilityIcon from "./assets/AccessibilityIcon.png"


function App() {

  return (
    <div className='font-fredoka flex flex-col h-full w-full'>
      <Nav/>
      <img className='absolute w-10 h-auto top-48 z-20' src={AccessibilityIcon}/>
      <Tracker />
      <Footer/>
    </div>
  )
}

export default App
