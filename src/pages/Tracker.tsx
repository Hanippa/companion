
import Tracking from '../components/Tracking';
import Technician from '../components/Technician';
import Summary from '../components/Summary';
import Info from '../components/Info';

export default function Tracker() {
  return (
  <div className="from-dgreen to-gray-100 bg-linear-to-b flex flex-col-reverse md:flex-row w-full h-full gap-3 p-3 md:gap-4 md:p-4">
    <div className="md:w-4/6 md:flex-col flex flex-col w-full h-full md:h-full gap-3 md:gap-4">
<Tracking/>
<Technician/>
      
    </div>

    <div className="md:w-2/6 w-full md:h-full h-20 flex flex-col gap-3 md:gap-4 ">
<Summary/>
<Info/>
    </div>
  </div>
  );
}