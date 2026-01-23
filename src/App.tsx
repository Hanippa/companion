
import './App.css'
import Nav from './components/Nav';
import Tracker from "./pages/Tracker";

function App() {

  return (
    <div className='font-fredoka flex flex-col h-full w-full'>
      <Nav/>
      <Tracker />
    </div>
  )
}

export default App
