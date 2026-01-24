import infoIcon from "../assets/InfoIcon.png";
import { useState } from "react";
import BottomSheet from "../components/BottomSheet";


type TimelineItem = {
  title: string;
  description: string;
  highlighted?: boolean;
  info?:boolean;
};

const items: TimelineItem[] = [
  {
    title: "מכשירך הופקד בסניף דיזנגוף סנטר",
    description: "15/1   בשעה - 9:15",
    highlighted: false,
    info :false,
  },
  {
    title: "מכשירך נכנס למעבדת תיקונים ",
    description: "15/1   בשעה - 9:18",
    highlighted: false,
    info :false,
  },
  {
    title: "מכשירך נשלח לתיקון מעבדה ארצית",
    description: "15/1   בשעה - 9:20",
    highlighted: true,
    info :true,
  },
  {
    title: "התחלת תיקון המכשיר",
    description: "",
    highlighted: false,
    info :false,
  },
];

export default function Timeline() {

    const [open, setOpen] = useState(false);

  return (
    <div className="h-full w-full relative" dir="rtl">
      {/* Vertical line */}
      

      <ul className="h-full w-full flex flex-col justify-between content-between p-4">
      <div className="absolute right-6.5 top-0 w-0.5 h-full bg-gray-100" />
        {
        items.map((item, index) => { 
          const isActive = item.highlighted;

          return (
          
          <li key={index} className="relative">
            {/* Dot */}
            <div className={`
                  ${isActive
                    ? "absolute right-0 top-2 h-6 w-6 rounded-sm bg-dyellow"
                    : "absolute right-0 top-2 h-6 w-6 rounded-sm bg-white border-2 border-gray-100"}
                `} />

            {/* Content */}
            <div className="pr-8">
              <div className="flex justify-start items-center">
              <h3 className={`
                  ${isActive
                    ? "text-xl md:text-2xl text-black"
                    : "text-xl md:text-2xl text-gray-400"}
                `}>
                {item.title}
              </h3>
              {item.info ? <img onClick={() => setOpen(true)} className="w-6 h-6 mr-4" src={infoIcon} alt=""/> : ""}
              </div>
              <p className={`
                  ${isActive
                    ? "text-md md:text-xl text-black"
                    : "text-md md:text-xl text-gray-400"}
                `}>
                {item.description}
              </p>
            
            </div>
          </li>
        )})}
      </ul>
      <BottomSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}