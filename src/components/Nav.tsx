import logo from "../assets/Logo.svg";

export default function Nav() {

  return (
    <header className="">
      <nav className="mx-auto bg-white p-3">
        <div className="flex h-12 items-center justify-between">
          <img src={logo} alt="Logo"  className="h-8 w-auto"/>
          <div className="text-2xl"> 195349843 תיקון מספר</div>
          
        </div>

      </nav>
    </header>
  );
}