'use client';

import { useState, useEffect } from 'react';
import { apiClient, Payment, Transfer } from '../lib/api';

// Add Excel-like styles
const excelStyles = [
  '.excel-table {',
  '  font-family: "Segoe UI", "Arial", sans-serif;',
  '  border-spacing: 0;',
  '  border-collapse: separate;',
  '}',
  '.excel-table td {',
  '  position: relative;',
  '  border: 1px solid #d1d5db;',
  '  padding: 8px 6px;',
  '  transition: all 0.15s ease;',
  '}',
  '.excel-table th {',
  '  border: 1px solid #9ca3af;',
  '  background: linear-gradient(to bottom, #f3f4f6, #e5e7eb);',
  '  font-weight: 600;',
  '  color: #374151;',
  '  transition: all 0.15s ease;',
  '}',
  '.excel-table th:hover {',
  '  background: linear-gradient(to bottom, #e5e7eb, #d1d5db);',
  '}',
  '.excel-table tbody tr:nth-child(even) {',
  '  background-color: #f8fafc;',
  '}',
  '.excel-table tbody tr:nth-child(odd) {',
  '  background-color: #ffffff;',
  '}',
  '.excel-table tbody tr:hover {',
  '  background-color: #e0f2fe !important;',
  '  box-shadow: 0 2px 4px rgba(0,0,0,0.1);',
  '  transform: translateZ(0);',
  '}'
].join('\n');

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'excel-table-styles-cashvault';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = excelStyles;
    document.head.appendChild(style);
  }
}

interface CashVaultScreenProps {
  onBack: () => void;
}

interface CashTransaction {
  id: string;
  type: 'بيع' | 'شراء' | 'وارد نقدية' | 'منصرف نقدية';
  amount: number;
  description: string;
  clientName: string;
  date: string;
  status: string;
}

export default function CashVaultScreen({ onBack }: CashVaultScreenProps) {
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [totalCashIn, setTotalCashIn] = useState(0);
  const [totalCashOut, setTotalCashOut] = useState(0);
  const [netCash, setNetCash] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCashData();
  }, []);

  const loadCashData = async () => {
    setLoading(true);
    try {
      // Load all payments to find cash-related transactions
      const paymentsResponse = await apiClient.getAllPayments();
      const payments = Array.isArray(paymentsResponse.data) ? paymentsResponse.data : [];
      
      // Also load wallets to get client names
      const walletsResponse = await apiClient.getWallets();
      const wallets = Array.isArray(walletsResponse.data) ? walletsResponse.data : [];
      
      // Create a map for wallet ID to client name
      const walletToClientName: { [key: string]: string } = {};
      wallets.forEach((wallet: any) => {
        if (wallet.account?.owner) {
          const owner = wallet.account.owner;
          const firstName = owner.firstName || '';
          const lastName = owner.lastName || '';
          const fullName = (firstName + ' ' + lastName).trim();
          walletToClientName[wallet.id] = fullName || wallet.name;
        } else {
          walletToClientName[wallet.id] = wallet.name;
        }
      });
      
      // Process payments for cash transactions (بيع/شراء)
      const cashTransactionsFromPayments: CashTransaction[] = [];
      let cashIn = 0;
      let cashOut = 0;

      payments.forEach((payment: Payment) => {
        let transactionType: 'بيع' | 'شراء' | 'وارد نقدية' | 'منصرف نقدية' | null = null;
        let cashAmount = 0;

        if (payment.description.startsWith('بيع:')) {
          transactionType = 'بيع';
          // For بيع: client owes cash (cash out from system perspective)
          const numbers = payment.description.split('').filter(c => c.charCodeAt(0) >= 48 && c.charCodeAt(0) <= 57).join('');
          cashAmount = numbers ? parseFloat(numbers) : 0;
          cashOut += cashAmount;
        } else if (payment.description.startsWith('شراء:')) {
          transactionType = 'شراء'; 
          // For شراء: system owes cash to client (cash in from system perspective)
          const numbers = payment.description.split('').filter(c => c.charCodeAt(0) >= 48 && c.charCodeAt(0) <= 57).join('');
          cashAmount = numbers ? parseFloat(numbers) : 0;
          cashIn += cashAmount;
        } else if (payment.description.startsWith('وارد نقدية:')) {
          transactionType = 'وارد نقدية';
          // For وارد نقدية: cash coming into system
          const numbers = payment.description.split('').filter(c => c.charCodeAt(0) >= 48 && c.charCodeAt(0) <= 57).join('');
          cashAmount = numbers ? parseFloat(numbers) : 0;
          cashIn += cashAmount;
        } else if (payment.description.startsWith('منصرف نقدية:')) {
          transactionType = 'منصرف نقدية';
          // For منصرف نقدية: cash going out of system
          const numbers = payment.description.split('').filter(c => c.charCodeAt(0) >= 48 && c.charCodeAt(0) <= 57).join('');
          cashAmount = numbers ? parseFloat(numbers) : 0;
          cashOut += cashAmount;
        }

        if (transactionType && cashAmount > 0) {
          cashTransactionsFromPayments.push({
            id: payment.id,
            type: transactionType,
            amount: cashAmount,
            description: payment.description,
            clientName: walletToClientName[payment.walletId] || payment.walletId,
            date: payment.createdAt,
            status: payment.status
          });
        }
      });

      // TODO: Add support for pure cash transactions (وارد نقدية/منصرف نقدية)
      // These might be stored locally in the transactions state
      
      // Sort transactions by date (newest first)
      cashTransactionsFromPayments.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setCashTransactions(cashTransactionsFromPayments);
      setTotalCashIn(cashIn);
      setTotalCashOut(cashOut);
      setNetCash(cashIn - cashOut);
      
    } catch (error) {
      console.error('Error loading cash data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm mr-4"
          >
            ← رجوع
          </button>
          <h2 className="text-xl font-bold text-green-800">حركة الخزنة نقدية</h2>
        </div>
      </div>

        {/* Cash Summary Cards */}
        <div className="p-4 bg-gray-50 rounded-lg mb-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-100 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-800">
                {totalCashIn.toFixed(2)}
              </div>
              <div className="text-sm text-green-600">إجمالي النقدية الواردة</div>
              <div className="text-xs text-gray-600">من عمليات الشراء</div>
            </div>
            
            <div className="bg-red-100 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-800">
                {totalCashOut.toFixed(2)}
              </div>
              <div className="text-sm text-red-600">إجمالي النقدية الصادرة</div>
              <div className="text-xs text-gray-600">من عمليات البيع</div>
            </div>
            
            <div className={`rounded-lg p-4 text-center ${
              netCash >= 0 ? 'bg-blue-100' : 'bg-yellow-100'
            }`}>
              <div className={`text-2xl font-bold ${
                netCash >= 0 ? 'text-blue-800' : 'text-yellow-800'
              }`}>
                {netCash.toFixed(2)}
              </div>
              <div className={`text-sm ${
                netCash >= 0 ? 'text-blue-600' : 'text-yellow-600'
              }`}>
                صافي النقدية
              </div>
              <div className="text-xs text-gray-600">
                {netCash >= 0 ? 'للنظام' : 'للعملاء'}
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="flex-1 p-4">
          <div className="bg-white rounded-lg shadow h-full flex flex-col">
            <div className="p-3 bg-gray-50 border-b rounded-t-lg">
              <h3 className="font-semibold text-gray-700">جميع المعاملات النقدية</h3>
            </div>
            
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                جاري تحميل البيانات...
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm excel-table">
                  <thead className="bg-gradient-to-b from-blue-100 to-blue-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">الكود</th>
                      <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">نوع العملية</th>
                      <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">المبلغ</th>
                      <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">العميل</th>
                      <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">التاريخ</th>
                      <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">الحالة</th>
                      <th className="px-4 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500 border border-gray-300">
                          لا توجد معاملات نقدية
                        </td>
                      </tr>
                    ) : (
                      cashTransactions.map((transaction) => (
                        <tr 
                          key={transaction.id}
                          className="hover:bg-blue-50 transition-colors duration-150"
                        >
                          <td className="px-4 py-3 border border-gray-300 text-xs font-mono">
                            {transaction.id.slice(-8)}
                          </td>
                          <td className="px-4 py-3 border border-gray-300">
                            <span className={`px-2 py-1 rounded text-xs ${
                              transaction.type === 'بيع' 
                                ? 'bg-red-100 text-red-800'
                                : transaction.type === 'شراء'
                                ? 'bg-green-100 text-green-800'
                                : transaction.type === 'وارد نقدية'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {transaction.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 border border-gray-300 text-right font-semibold">
                            {transaction.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 border border-gray-300 text-xs">
                            {transaction.clientName}
                          </td>
                          <td className="px-4 py-3 border border-gray-300 text-xs">
                            {new Date(transaction.date).toLocaleDateString('ar')}
                          </td>
                          <td className="px-4 py-3 border border-gray-300">
                            <span className={`px-2 py-1 rounded text-xs ${
                              transaction.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800'
                                : transaction.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.status === 'COMPLETED' ? 'مكتملة' : 
                               transaction.status === 'PENDING' ? 'معلقة' : transaction.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 border border-gray-300 text-xs text-gray-600">
                            {(() => {
                              let text = transaction.description.split('|')[0];
                              // Use string replacement instead of startsWith to avoid parsing issues
                              text = text.replace(/^بيع:/, '').replace(/^شراء:/, '');
                              return text.trim();
                            })()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer with action buttons */}
        <div className="p-4 bg-gray-50 border-t rounded-b-lg flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {'إجمالي المعاملات: '}{cashTransactions.length}
          </div>
          <button
            onClick={loadCashData}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
          >
            {'تحديث البيانات'}
          </button>
        </div>
      </div>
  );
}