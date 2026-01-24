import Timeline from '../components/Timeline'


export default function Tracker() {
  return (
  <div className="bg-gray-100 flex flex-col-reverse md:flex-row w-full h-full gap-3 p-3 md:gap-4 md:p-4">
    <div className="md:w-4/6 md:flex-col flex flex-col w-full h-full md:h-full gap-3 md:gap-4">
    <div className="w-full h-full bg-white rounded-xl">
      <div className='flex flex-col p-4 md:p-14  h-full w-full justify-end items-center'>
        <div className=' w-full flex flex-col items-end content-start mb-14'>
        <div className="text-2xl" dir='rtl'>זמן תיקון משוער : </div>
      <div className="text-6xl" >20\01\2026</div>
        </div>
      <Timeline/>
      </div>
      
    </div>
      <div className="w-full h-20 md:h-32 bg-white rounded-xl">
        technician
      </div>
      
    </div>

    <div className="md:w-2/6 w-full md:h-full h-20 flex flex-col gap-3 md:gap-4 ">
      <div className="w-full  h-full md:h-1/6 bg-white rounded-xl">
        <div className="text-2xl" dir="rtl">
        אייפון 15 פרו מקס
        </div>
        <div className="text-2xl" dir="rtl">
        מסך שבור + בעיית שמע +...         </div>
      </div>
      <div className="w-full md:h-5/6 bg-white hidden md:block rounded-xl">
        extra information
      </div>
    </div>
  </div>
  );
}