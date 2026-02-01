import ProfileIcon from "../assets/ProfileIcon.png";
import ContactIcon from "../assets/ContactIcon.png"
import TechIcon from "../assets/TechIcon.png"


const handleCall = () => {
  window.open('tel:*6656');
};
export default function Technician() {
  return (
<div className=" flex justify-center items-center w-full h-20 md:h-32 bg-white opacity-90 rounded-2xl p-4">
  <div onClick={handleCall} className="flex flex-col md:flex-row  justify-center md:justify-start md:items-center w-1/4 cursor-pointer ">
  <img className="ml-4 w-8 h-8 md:w-14 md:h-14" src={ContactIcon} alt="contact icon" />
  <div className="text-md md:text-2xl cursor-pointer ">צור קשר</div>
  </div>
  <div className="flex w-3/4 justify-end items-center gap-2">
  <div dir="rtl" className="flex flex-col content-start">
  <div className="text-2xl md:text-4xl">רעות</div>
<div className="text-md md:text-2xl flex items-center">טכנאית סלולר <img className="w-4 h-4 m-2" src={TechIcon} alt="tehcnicion icon" /></div>

  </div>
  <img className="w-14 h-14 md:w-20 md:h-20 rounded-full" src={ProfileIcon} alt="technician icon" />

  </div>
<div>

</div>
</div>
  );
}

