import SimIcon from "../assets/SimIcon.png"
import DateIcon from "../assets/DateIcon.png"
import RepairIcon from "../assets/RepairIcon.png"
import ProtectIcon from "../assets/ProtectIcon.png"
import LocationIcon from "../assets/LocationIcon.png"
import WazeIcon from "../assets/WazeIcon.png"
type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
};
const handleNavigate = () => {
  window.open('https://ul.waze.com/ul?place=ChIJHVPHZIBLHRUR39I7WNDlIVU&ll=32.07512110%2C34.77493420&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location');
};

export default function BottomSheetInfo({ open, onClose }: BottomSheetProps) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50
          transform transition-transform duration-300 ease-out
          ${open ? "translate-y-0" : "translate-y-full"}
        `}
      >
        <div className="mx-auto max-w-lg rounded-t-2xl bg-white p-6 shadow-xl">
          {/* Drag handle */}
          <div onClick={onClose} className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-dyellow" />
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
      <li className="">
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

          <button
            onClick={onClose}
            className="mt-6 text-md w-full rounded-md px-4 py-2 text-black bg-gray-100"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
