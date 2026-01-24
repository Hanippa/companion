import RepairIcon from "../assets/RepairIcon.png";

export default function Summary() {

  return (
    <div className=" flex items-center justify-end w-full  h-full md:h-1/6 bg-white rounded-xl p-4">
    <div className="">
    <div className="text-2xl" dir="rtl">
    אייפון 15 פרו מקס
    </div>
    <div className="text-xl text-gray-500" dir="rtl">
    מסך שבור + בעיית שמע +...         </div>
  </div>
  <img src={RepairIcon} alt="Logo"  className="h-12 w-auto m-4"/>
  </div>
 

  );
}