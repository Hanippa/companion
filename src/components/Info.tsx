import SimIcon from "../assets/SimIcon.png"
import DateIcon from "../assets/DateIcon.png"
import RepairIcon from "../assets/RepairIcon.png"
import ProtectIcon from "../assets/ProtectIcon.png"
import LocationIcon from "../assets/LocationIcon.png"
import WazeIcon from "../assets/WazeIcon.png"
const handleNavigate = () => {
  window.open('https://ul.waze.com/ul?place=ChIJHVPHZIBLHRUR39I7WNDlIVU&ll=32.07512110%2C34.77493420&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location');
};
export default function Info() {
  return (
    <div className="w-full md:h-5/6 p-4 bg-white opacity-90 hidden md:flex md:flex-col items-end rounded-2xl">
      <div dir="rtl" className="text-4xl m-4">מידע מורחב</div>
    <ul className="flex w-full h-full flex-col justify-around pb-4">
    <li className="border-b-2 border-gray-100">
        <div className="flex justify-end items-center">
        
          <div dir="rtl" className="text-xl md:text-2xl">FIX 42 שירות תיקונים</div>
          <img className="w-6 m-4" src={ProtectIcon} alt="" />
        </div>
      </li>
      <li className="border-b-2 border-gray-100 ">
      <div className="flex justify-end items-center">
          <div className="flex flex-col items-end">
          <div className="text-xl md:text-2xl flex items-center justify-end">אייפון 15 פרו מקס <img className="w-6 m-4" src={RepairIcon} alt="" /></div>
          <div className="flex flex-col justify-end items-end gap-2">
          <div dir="rtl" className="text-md text-gray-400 pr-12">- מסך שבור </div>
          <div dir="rtl" className="text-md text-gray-400 pr-12">- בעיות שמע </div>
          <div dir="rtl" className="text-md text-gray-400 pr-12">- בעיות קליטה </div>

        
          </div>
          </div>
          
          
        </div>
      </li>
      <li className="border-b-2 border-gray-100">
        <div className="flex justify-end items-center">
          
          <div dir="rtl" className="text-xl md:text-2xl">356303483147250</div>
          <img className="w-6 m-4" src={SimIcon} alt="" />
        </div>
      </li>
      <li className="border-b-2 border-gray-100 ">
        <div className="flex justify-end items-center">
          <div className="text-xl md:text-2xl">15/01/2026 - 9:15</div>
          <img className="w-6 m-4" src={DateIcon} alt="" />
        </div>
      </li>
      <li className=" ">
        <div className="flex justify-end items-center">
          <div className="flex flex-col items-end">
          <div dir="rtl" className="text-xl md:text-2xl">מרכז שירות דיזנגוף</div>
          <div className="flex gap-2">
          <img onClick={handleNavigate} className="w-6 h-6 cursor-pointer" src={WazeIcon} alt="" />
            <div onClick={handleNavigate} className="flex cursor-pointer" dir="rtl">נווט בwaze </div>
          <div dir="rtl" className="text-md text-gray-400">דיזנגוף 50, תל אביב - יפו</div>
        
          </div>
          </div>
          
          <img className="w-6 m-4" src={LocationIcon} alt="" />
        </div>
      </li>
    </ul>
  </div>
  );
}