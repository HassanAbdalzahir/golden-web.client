import Link from 'next/link';

interface ActionButtonsProps {
  onShowDeleted?: () => void;
  onShowBuySell?: () => void;
}

export default function ActionButtons({ onShowDeleted, onShowBuySell }: ActionButtonsProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-center space-x-4 space-x-reverse">
        <Link 
          href="/journal-entry"
          className="bg-gray-300 hover:bg-white text-black hover:text-red-600 hover:border-2 px-6 py-3 rounded-lg font-medium transition-colors"
        >
          سند قيد
        </Link>
        <button className="bg-gray-300 hover:bg-white text-black hover:text-red-600 hover:border-2 px-6 py-3 rounded-lg font-medium">
          فاتورة سبائك
        </button>
        <Link
          href="/balances"
          className="bg-gray-300 hover:bg-white text-black hover:text-red-600 hover:border-2  px-6 py-3 rounded-lg font-medium transition-colors"
        >
          أرصدة
        </Link>
        <button 
          onClick={onShowBuySell}
          className="bg-gray-300 hover:bg-white text-black hover:text-red-600 hover:border-2 px-6 py-3 rounded-lg font-medium transition-colors"
        >
          بيع وشراء
        </button>
        <button 
          onClick={onShowDeleted}
          className="bg-gray-300 hover:bg-white text-black hover:text-red-600 hover:border-2 px-6 py-3 rounded-lg font-medium transition-colors"
        >
          المحذوف
        </button>
      </div>
    </div>

  );
}