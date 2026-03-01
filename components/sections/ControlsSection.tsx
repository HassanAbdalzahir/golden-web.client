import { useState } from 'react';
import { Wallet } from '../../lib/api';
import StatementTypeModal from '../StatementTypeModal';

interface ClientWalletGroup {
  accountId: string;
  accountName: string;
  goldWallet: Wallet | null;
  moneyWallet: Wallet | null;
}

interface ControlsSectionProps {
  wallets: Wallet[];
  clientGroups?: ClientWalletGroup[];
  selectedClient: string;
  setSelectedClient: (client: string) => void;
  fromDate: string;
  setFromDate: (date: string) => void;
  toDate: string;
  setToDate: (date: string) => void;
  todayPrice: string;
  setTodayPrice: (price: string) => void;
  averagePrice: string;
  setAveragePrice: (price: string) => void;
  onAddClient?: () => void;

  onNewTransaction?: () => void;
  onDeleteAll?: () => void;
  isTransactionFormDirty?: boolean;
  pendingTransactionsCount?: number;
}

export default function ControlsSection({
  wallets,
  clientGroups = [],
  selectedClient,
  setSelectedClient,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  todayPrice,
  setTodayPrice,
  averagePrice,
  setAveragePrice,
  onAddClient,
  onNewTransaction,
  onDeleteAll,
  isTransactionFormDirty = false,
}: ControlsSectionProps) {
  const [showStatementModal, setShowStatementModal] = useState(false);

  return (
    <>
      <div className="col-span-5 h-full">
        <div className="grid grid-cols-1 gap-4 h-full">
          <div className="grid grid-cols-2 gap-3 h-full">
            {/* Client Operations */}
            <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
              >
                <option value="">اختر عميل</option>
                {clientGroups.map((group) => (
                  <option key={group.accountId} value={group.accountId}>
                    {group.accountName}
                  </option>
                ))}
                {clientGroups.length === 0 && (
                  <option value="" disabled>لا توجد عملاء - اضغط "اضافة عميل"</option>
                )}
              </select>

              <div className="grid grid-cols-2 gap-2 mb-3 flex-1">


              </div>

              {/* Statement Type Management Button */}
              <div className="mb-3">
                <button
                  onClick={() => setShowStatementModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-2 rounded text-xs transition-colors"
                >
                  إضافة بيان
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 flex-1">



              </div>

              <div className="grid grid-cols-2 gap-2 h-full">
                <div className="bg-white border rounded-lg p-3 flex justify-between items-center cursor-pointer" onClick={() => {
                  const newValue = prompt('أدخل سعر اليوم:', todayPrice);
                  if (newValue) setTodayPrice(newValue);
                }}>
                  <div className="text-lg font-bold text-blue-600">{todayPrice}</div>
                  <div className="text-xs text-gray-600">سعر اليوم</div>
                </div>
                <div className="bg-gray-50 border rounded-lg p-3 flex justify-between items-center">
                  <div className="text-lg font-bold text-green-600">{averagePrice}</div>
                  <div className="text-xs text-gray-600">متوسط السعر</div>
                  <div className="text-xs text-gray-400 mt-1">محسوب تلقائياً</div>
                </div>
              </div>
            </div>

            {/* Client Management */}
            <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
              <button
                onClick={onAddClient}
                className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 px-4 rounded text-sm mb-3">
                اضافة عميل
              </button>
              <div className="space-y-2 flex-1">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">تاريخ اليوم</label>
                  <input
                    type="date"
                    value={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">من تاريخ</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StatementTypeModal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        onSuccess={() => {
          setShowStatementModal(false);
          // Optionally refresh data or show success message
        }}
      />
    </>
  );
}