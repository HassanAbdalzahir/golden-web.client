'use client';

import { useState, useEffect } from 'react';
import { apiClient, Wallet } from '../lib/api';
import { useToast } from '../hooks/useToast';

// Simple UUID v4 generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Add Excel-like styles
const excelStyles = `
  .excel-table {
    font-family: 'Segoe UI', 'Arial', sans-serif;
    border-spacing: 0;
    border-collapse: separate;
  }
  .excel-table td {
    position: relative;
    border: 1px solid #d1d5db;
    padding: 8px 6px;
    transition: all 0.15s ease;
  }
  .excel-table th {
    border: 1px solid #9ca3af;
    background: linear-gradient(to bottom, #f3f4f6, #e5e7eb);
    font-weight: 600;
    color: #374151;
    transition: all 0.15s ease;
  }
  .excel-table th:hover {
    background: linear-gradient(to bottom, #e5e7eb, #d1d5db);
  }
  .excel-table tbody tr:nth-child(even) {
    background-color: #f8fafc;
  }
  .excel-table tbody tr:nth-child(odd) {
    background-color: #ffffff;
  }
  .excel-table tbody tr:hover {
    background-color: #e0f2fe !important;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transform: translateZ(0);
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'excel-table-styles-transfer';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = excelStyles;
    document.head.appendChild(style);
  }
}

interface TransferScreenProps {
  onBack: () => void;
  wallets: Wallet[];
  selectedClient?: string;
  todayPrice: string;
  onRefreshWallets?: () => void;
  systemUserId: string;
}

interface TransferData {
  fromWalletId: string;
  toWalletId: string;
  amountGrams: number;
  transferType: 'GOLD' | 'CASH';
  description: string;
  notes?: string;
}

export default function TransferScreen({ 
  onBack, 
  wallets, 
  selectedClient, 
  todayPrice,
  onRefreshWallets,
  systemUserId
}: TransferScreenProps) {
  const [transferData, setTransferData] = useState<TransferData>({
    fromWalletId: selectedClient || '',
    toWalletId: '',
    amountGrams: 0,
    transferType: 'GOLD',
    description: '',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [transfers, setTransfers] = useState<any[]>([]);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadTransfers();
  }, []);

  const loadTransfers = async () => {
    try {
      // Load transfers from API
      const response = await apiClient.getTransfers();
      setTransfers(response.data || []);
    } catch (error) {
      console.error('Error loading transfers:', error);
    }
  };

  const handleInputChange = (field: keyof TransferData, value: string | number) => {
    setTransferData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transferData.fromWalletId || !transferData.toWalletId || transferData.amountGrams <= 0) {
      showError('يرجى إكمال جميع البيانات المطلوبة');
      return;
    }

    if (transferData.fromWalletId === transferData.toWalletId) {
      showError('لا يمكن التحويل من نفس المحفظة إلى نفسها');
      return;
    }

    try {
      setLoading(true);
      
      // Create transfer via API
      await apiClient.createTransfer({
        fromWalletId: transferData.fromWalletId,
        toWalletId: transferData.toWalletId,
        amountGrams: transferData.amountGrams,
        description: transferData.description,
        idempotencyKey: generateUUID()
      }, systemUserId);

      showSuccess('تم تنفيذ التحويل بنجاح');
      
      // Reset form
      setTransferData({
        fromWalletId: selectedClient || '',
        toWalletId: '',
        amountGrams: 0,
        transferType: 'GOLD',
        description: '',
        notes: ''
      });
      
      // Reload transfers
      await loadTransfers();
      
      // Refresh wallets if callback provided
      if (onRefreshWallets) {
        onRefreshWallets();
      }
      
    } catch (error) {
      console.error('Error creating transfer:', error);
      showError('فشل في تنفيذ التحويل');
    } finally {
      setLoading(false);
    }
  };

  const getWalletName = (walletId: string) => {
    const wallet = wallets.find(w => w.id === walletId);
    return wallet?.name || `Wallet ${walletId.substring(0, 8)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
          >
            ← العودة
          </button>
          <h1 className="text-xl font-bold text-gray-800">تحويل الأرصدة</h1>
        </div>
        <div className="text-sm text-gray-600">
          سعر اليوم: {todayPrice}
        </div>
      </div>

      {/* Transfer Form */}
      <div className="p-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">تحويل جديد</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">من المحفظة</label>
              <select
                value={transferData.fromWalletId}
                onChange={(e) => handleInputChange('fromWalletId', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                required
              >
                <option value="">اختر المحفظة المرسلة</option>
                {wallets?.map(wallet => {
                  const goldBalance = wallet.balanceGrams || 0;
                  const cashBalance = 0; // TODO: Get cash balance from proper source
                  return (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} - ذهب: {goldBalance.toFixed(3)}ج - نقد: {cashBalance.toFixed(2)}
                    </option>
                  );
                }) || []}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">إلى المحفظة</label>
              <select
                value={transferData.toWalletId}
                onChange={(e) => handleInputChange('toWalletId', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                required
              >
                <option value="">اختر المحفظة المستقبلة</option>
                {wallets
                  ?.filter(wallet => wallet.id !== transferData.fromWalletId)
                  .map(wallet => {
                    const goldBalance = wallet.balanceGrams || 0;
                    const cashBalance = (wallet as any).balanceCash || 0;
                    return (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} - ذهب: {goldBalance.toFixed(3)}ج - نقد: {cashBalance.toFixed(2)}
                      </option>
                    );
                  }) || []
                }
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">نوع التحويل</label>
              <select
                value={transferData.transferType}
                onChange={(e) => handleInputChange('transferType', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
              >
                <option value="GOLD">ذهب</option>
                <option value="CASH">نقدية</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {transferData.transferType === 'GOLD' ? 'الكمية (جرام)' : 'المبلغ'}
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={transferData.amountGrams}
                onChange={(e) => handleInputChange('amountGrams', parseFloat(e.target.value) || 0)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder={transferData.transferType === 'GOLD' ? 'أدخل الكمية بالجرام' : 'أدخل المبلغ'}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">الوصف</label>
              <input
                type="text"
                value={transferData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="وصف التحويل"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">ملاحظات</label>
              <input
                type="text"
                value={transferData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="ملاحظات إضافية"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg disabled:opacity-50"
            >
              {loading ? 'جاري التحويل...' : 'تنفيذ التحويل'}
            </button>
          </div>
        </form>
      </div>

      {/* Transfers History Table */}
      <div className="flex-1 p-4">
        <div className="bg-white rounded-lg shadow h-full flex flex-col">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">سجل التحويلات</h3>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm excel-table">
              <thead className="bg-gradient-to-b from-blue-100 to-blue-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">التاريخ</th>
                  <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">من</th>
                  <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">إلى</th>
                  <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">الكمية</th>
                  <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">الوصف</th>
                  <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer, index) => (
                  <tr key={transfer.id} className="hover:bg-blue-50 transition-colors duration-150">
                    <td className="px-4 py-3 border border-gray-300">
                      {formatDate(transfer.createdAt)}
                    </td>
                    <td className="px-4 py-3 border border-gray-300">
                      {getWalletName(transfer.fromWalletId)}
                    </td>
                    <td className="px-4 py-3 border border-gray-300">
                      {getWalletName(transfer.toWalletId)}
                    </td>
                    <td className="px-4 py-3 border border-gray-300">
                      {transfer.amountMg ? (parseInt(transfer.amountMg) / 1000).toFixed(3) : '0'}g
                    </td>
                    <td className="px-4 py-3 border border-gray-300">
                      {transfer.description}
                    </td>
                    <td className="px-4 py-3 border border-gray-300">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        transfer.status === 'COMPLETED' 
                          ? 'bg-green-100 text-green-800' 
                          : transfer.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transfer.status === 'COMPLETED' ? 'مكتمل' : 
                         transfer.status === 'PENDING' ? 'قيد المراجعة' : 'ملغي'}
                      </span>
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 border border-gray-300">
                      لا توجد تحويلات بعد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}