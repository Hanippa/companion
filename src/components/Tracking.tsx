import Timeline from "./Timeline";


export default function Tracking() {
  return (
<div className="w-full h-full bg-white rounded-xl">
<div className='flex flex-col p-4 md:p-14  h-full w-full justify-end items-center'>
  <div className=' w-full flex flex-col items-end content-start mb-14'>
  <div className="text-2xl" dir='rtl'>זמן תיקון משוער : </div>
<div className="text-6xl" >20\01\2026</div>
  </div>
<Timeline/>
</div>

</div>
  );
}


