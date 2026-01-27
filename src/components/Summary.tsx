import RepairIcon from "../assets/RepairIcon.png";
import { useState } from "react";
import BottomSheetInfo from "../components/BottomSheetInfo";

export default function Summary() {
    const [open, setOpen] = useState(false);
  return (
    <div  onClick={() => {setOpen(true)}} className="flex items-center justify-end w-full  h-full md:h-1/6 bg-white rounded-xl p-4">
    <div className="">
    <div className="text-xl md:text-2xl" dir="rtl">
    אייפון 15 פרו מקס
    </div>
    <div className="truncate text-lg md:text-xl text-gray-500" dir="rtl">
    מסך שבור + בעיית שמע +...         </div>
  </div>
  <img src={RepairIcon} alt="Logo"  className="h-12 w-auto m-4"/>
  <BottomSheetInfo open={open} onClose={() => {setOpen(false);console.log("爱")}} />
  </div>
 

  );
}