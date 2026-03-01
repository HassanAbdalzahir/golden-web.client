import { useState } from 'react';
import StatementTypeModal from '../StatementTypeModal';

interface HeaderProps {
  onLogout: () => void;
}

export default function Header({ onLogout }: HeaderProps) {
  const [showStatementModal, setShowStatementModal] = useState(false);

  return (
    <>
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">نظام إدارة الذهب الذكي</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowStatementModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            إضافة بيان
          </button>
          <button 
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            خروج
          </button>
        </div>
      </div>

      <StatementTypeModal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        onSuccess={() => {
          setShowStatementModal(false);
          // Trigger refresh if needed
        }}
      />
    </>
  );
}