'use client';

import { useState } from 'react';
import StatementTypeModal from '../../components/StatementTypeModal';

export default function StatementTypesPage() {
  const [showModal, setShowModal] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 text-right" dir="rtl" style={{ fontFamily: 'Alexandria, sans-serif' }}>
      <StatementTypeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => setShowModal(false)}
      />
      {!showModal && (
        <div className="p-8">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            onClick={() => setShowModal(true)}
          >
            إدارة أنواع البيان
          </button>
        </div>
      )}
    </div>
  );
}