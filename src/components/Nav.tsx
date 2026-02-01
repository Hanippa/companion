import logo from "../assets/Logo.svg";

export default function Nav() {

  return (
    <header className="">
      <nav className="mx-auto bg-white p-3">
        <div className="flex h-12 items-center justify-between">
          <div className="flex items-end w-1/6 gap-2">
          
            <img src={logo} alt="Logo"  className="h-8 w-auto"/>
            <div className="hidden md:block text-2xl">Demo</div>
          </div>
          
          <div className=" whitespace-nowrap text-xl md:text-xl flex justify-end w-5/6 gap-2"> <div className="text-2xl">19874374</div> תיקון מספר</div>
          
        </div>

      </nav>
    </header>
  );
}