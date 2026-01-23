export default function Tracker() {
  return (
  <div className="bg-gray-100 flex flex-col md:flex-row w-full h-full gap-3 p-3 md:gap-4 md:p-4">
    <div className="md:w-4/6 md:flex-col flex flex-col-reverse w-full h-full gap-3 md:gap-4">
    <div className="w-full h-5/6 bg-white rounded-xl"></div>
      <div className="w-full h-1/6 bg-white rounded-xl"></div>
      
    </div>

    <div className="md:w-2/6 w-full h-full flex flex-col gap-3 md:gap-4 ">
      <div className="w-full  h-full md:h-1/6 bg-white rounded-xl"></div>
      <div className="w-full md:h-5/6 bg-white hidden md:block rounded-xl"></div>
    </div>
  </div>
  );
}