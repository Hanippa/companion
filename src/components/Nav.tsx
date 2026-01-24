import logo from "../assets/Logo.svg";

export default function Nav() {

  return (
    <header className="">
      <nav className="mx-auto bg-white p-3">
        <div className="flex h-12 items-center justify-between">
          <div className="flex items-end gap-2">
          
            <img src={logo} alt="Logo"  className="h-8 w-auto"/>
            <div className="hidden md:block text-2xl font-bold">Tracker demo</div>
          </div>
          
          <div className="text-2xl flex gap-2"> <div className="font-bold">19874374</div>: תיקון מספר</div>
          
        </div>

      </nav>
    </header>
  );
}