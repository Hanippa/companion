import SupportIcon from "../assets/SupportIcon.png"
type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
};



export default function BottomSheet({ open, onClose }: BottomSheetProps) {

  const handleWhatsapp = () => {
  window.open('https://api.whatsapp.com/send?phone=972522027185');
};
  const handleCallSupport = () => {
  window.open('tel:*6656');
};


  return (
    <>
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

          <h2 dir="rtl" className="text-3xl font-semibold text-black">
            שליחה למעבדה ארצית
          </h2>

          <p  dir="rtl" className="mt-2 text-xl text-gray-400">
           המכשיר שלך זקוק לטיפול מקיף ומורכב, 
אבל לא לדאוג... המכשיר יתוקן באופן מקצועי
במעבדה הארצית שלנו.
אנו נעשה את המירב על מנת שהפרידה תהיינה
קצרה ככל הניתן
צפי לקבלת המכשיר עד שלושה ימי עסקים. 

          </p>
          <div className=" p-4 flex justify-between items-center w-full h-24 bg-gray-100 rounded-lg mt-6">
            <div className="flex flex-col items-start">
            <div>יש עוד שאלות?</div>
            <div onClick={handleCallSupport}>אנחנו זמינים לרשתוך ב*6656</div>
            <div className="" onClick={handleWhatsapp} >או בוואצאפ ב052-2027185</div>
            </div>
            <img className="w-16 h-18" src={SupportIcon}/>
          </div>

          <button
            onClick={onClose}
            className="mt-6 w-full rounded-md px-4 py-2 text-black bg-gray-100"
          >
            סגור
          </button>
        </div>
      </div>
    </>
  );
}
