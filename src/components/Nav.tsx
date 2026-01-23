import { useState } from "react";
import logo from "../assets/Logo.svg";

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-white">
      <nav className="mx-auto ">
        <div className="flex h-16 items-center justify-between">
          <img src={logo} alt="Logo"  className="h-8 w-auto"/>
          <div> 1953498534 תיקון מספר</div>
          
        </div>

      </nav>
    </header>
  );
}