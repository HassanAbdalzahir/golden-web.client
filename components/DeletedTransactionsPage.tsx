'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

interface DeletedTransaction {
  id: string;
  originalId: string;
  type: string;
  clientName: string;
  barcode: string;
  description: string;
  weight: string;
  purity: string;
  fee: string;
  feeType: string;
  net21: string;
  value: string;
  notes: string;
  deletedAt: string;
  deletedBy: string;
  deletionReason: string;
}

interface DeletedTransactionsPageProps {
  onBack: () => void;
  showSuccess?: (message: string) => void;
  showError?: (message: string) => void;
  showWarning?: (message: string) => void;
  transactions?: any[]; // Main transactions array including deleted ones
  setTransactions?: (updater: (prev: any[]) => any[]) => void;
  wallets?: any[];
  payments?: any[]; // API payments array
  setPayments?: (payments: any[]) => void;
}

export default function DeletedTransactionsPage({ 
  onBack, 
  showSuccess, 
  showError, 
  showWarning,
  transactions = [], // Main transactions array
  setTransactions,
  payments = [], // API payments array  
  setPayments,
  wallets = []
}: DeletedTransactionsPageProps) {
  const [deletedTransactions, setDeletedTransactions] = useState<DeletedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Set default date range to current month
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setFromDate(firstDayOfMonth.toISOString().split('T')[0]);
    setToDate(lastDayOfMonth.toISOString().split('T')[0]);
    
    loadDeletedTransactions();
  }, []);

  useEffect(() => {
    // Reload data when filters change or when transactions change
    if (fromDate && toDate) {
      loadDeletedTransactions();
    }
  }, [fromDate, toDate, selectedClient, transactions.length, payments.length]);

  const loadDeletedTransactions = async () => {
    setLoading(true);
    try {
      let allDeletedTransactions: DeletedTransaction[] = [];
      
      // First, try to load from database API
      try {
        const response = await apiClient.getDeletedTransactions({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          clientId: selectedClient || undefined
        });
        
        if (response.data && Array.isArray(response.data)) {
          const apiDeletedTransactions = response.data.map((item: any) => ({
            id: item.id || `api-${Date.now()}-${Math.random()}`,
            originalId: item.originalId || item.id,
            type: item.transactionType || item.type,
            clientName: item.clientName,
            barcode: item.barcode || '',
            description: item.description || '',
            weight: item.weight?.toString() || '0',
            purity: item.purity?.toString() || '21',
            fee: item.fee?.toString() || '0',
            feeType: item.feeType || 'نقدي',
            net21: item.net21?.toString() || item.weight?.toString() || '0',
            value: item.value?.toString() || '0',
            notes: item.notes || item.description || '',
            deletedAt: item.deletedAt || item.createdAt || new Date().toISOString(),
            deletedBy: item.deletedBy || 'مستخدم',
            deletionReason: item.deletionReason || 'غير محدد'
          }));
          allDeletedTransactions.push(...apiDeletedTransactions);
        }
        
        console.log('Loaded deleted transactions from API:', allDeletedTransactions.length);
      } catch (apiError) {
        console.warn('Could not load deleted transactions from API:', apiError);
      }
      
      // Get soft deleted transactions from main transactions array
      const softDeletedTransactions = transactions
        .filter(t => t.deleted)
        .map(transaction => {
          const clientWallet = wallets.find(w => w.id === transaction.clientId);
          const clientName = clientWallet ? 
            (clientWallet.account?.owner ? 
              `${clientWallet.account.owner.firstName || ''} ${clientWallet.account.owner.lastName || ''}`.trim() : 
              clientWallet.name) : 
            'عميل غير معروف';

          return {
            id: transaction.id,
            originalId: transaction.id,
            type: transaction.type,
            clientName: clientName,
            barcode: transaction.barcode || '',
            description: transaction.description || transaction.notes || '',
            weight: transaction.weight?.toString() || '0',
            purity: transaction.purity?.toString() || '21',
            fee: transaction.fee?.toString() || '0',
            feeType: transaction.feeType || 'نقدي',
            net21: transaction.net21?.toString() || transaction.weight?.toString() || '0',
            value: transaction.value?.toString() || '0',
            notes: transaction.notes || transaction.description || '',
            deletedAt: transaction.deletedAt || new Date().toISOString(),
            deletedBy: transaction.deletedBy || 'مستخدم',
            deletionReason: transaction.deletionReason || 'غير محدد'
          };
        });
      
      // Get soft deleted payments from API payments array
      const softDeletedPayments = payments
        .filter(p => (p as any).deleted)
        .map(payment => {
          const clientWallet = wallets.find(w => w.id === payment.walletId);
          const clientName = clientWallet ? 
            (clientWallet.account?.owner ? 
              `${clientWallet.account.owner.firstName || ''} ${clientWallet.account.owner.lastName || ''}`.trim() : 
              clientWallet.name) : 
            'عميل غير معروف';

          return {
            id: `payment-${payment.id}`,
            originalId: payment.id,
            type: payment.paymentType === 'DEPOSIT' ? 'وارد ذهب' : 'منصرف ذهب',
            clientName: clientName,
            barcode: payment.id.slice(-8),
            description: payment.description,
            weight: (parseFloat(payment.amountMg) / 1000).toFixed(3),
            purity: '21',
            fee: '0',
            feeType: 'نقدي',
            net21: (parseFloat(payment.amountMg) / 1000).toFixed(3),
            value: '0',
            notes: payment.description,
            deletedAt: (payment as any).deletedAt || new Date().toISOString(),
            deletedBy: (payment as any).deletedBy || 'مستخدم',
            deletionReason: (payment as any).deletionReason || 'غير محدد'
          };
        });
      
      // Combine all deleted transactions
      allDeletedTransactions.push(...softDeletedTransactions, ...softDeletedPayments);
      
      // Apply client and date filters
      let filteredTransactions = allDeletedTransactions;
      
      if (selectedClient) {
        filteredTransactions = filteredTransactions.filter(t => {
          // Check if transaction is from selected client
          const wallet = wallets.find(w => w.id === selectedClient);
          return t.clientName === (wallet ? 
            (wallet.account?.owner ? 
              `${wallet.account.owner.firstName || ''} ${wallet.account.owner.lastName || ''}`.trim() : 
              wallet.name) : 
            'عميل غير معروف');
        });
      }
      
      if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999); // End of day
        
        filteredTransactions = filteredTransactions.filter(t => {
          const transactionDate = new Date(t.deletedAt);
          return transactionDate >= from && transactionDate <= to;
        });
      }
      
      // Sort by deletion date (newest first)
      filteredTransactions.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
      
      setDeletedTransactions(filteredTransactions);
    } catch (error) {
      console.error('Error loading deleted transactions:', error);
      if (showError) {
        showError('فشل في تحميل المعاملات المحذوفة');
      }
    } finally {
      setLoading(false);
    }
  };

  const restoreTransaction = async (transaction: DeletedTransaction) => {
    try {
      // Try to call the API to restore the transaction
      try {
        await apiClient.restoreTransaction(transaction.originalId, 'current-user-id');
      } catch (apiError) {
        console.warn('Restore API not available, restoring locally:', apiError);
      }
      
      // Check if this is a local transaction (from main transactions array)
      const isLocalTransaction = transactions.some(t => t.id === transaction.originalId);
      const isPaymentTransaction = transaction.id.startsWith('payment-');
      
      if (isLocalTransaction) {
        // Restore soft deleted local transaction
        if (setTransactions) {
          setTransactions(prev => prev.map(t => 
            t.id === transaction.originalId ? {
              ...t,
              deleted: false,
              deletedAt: undefined,
              deletedBy: undefined,
              deletionReason: undefined
            } : t
          ));
        }
      } else if (isPaymentTransaction) {
        // Restore soft deleted payment
        if (setPayments) {
          setPayments(payments.map(p => 
            p.id === transaction.originalId ? {
              ...p,
              deleted: false,
              deletedAt: undefined,
              deletedBy: undefined,
              deletionReason: undefined
            } : p
          ));
        }
      } else {
        // This is a database-only deleted transaction, restore to local transactions
        if (setTransactions) {
          const restoredTransaction = {
            id: transaction.originalId,
            type: transaction.type,
            clientId: wallets.find(w => 
              (w.account?.owner ? 
                `${w.account.owner.firstName || ''} ${w.account.owner.lastName || ''}`.trim() : 
                w.name) === transaction.clientName
            )?.id || '',
            barcode: transaction.barcode,
            description: transaction.description,
            weight: transaction.weight,
            purity: transaction.purity,
            fee: transaction.fee,
            feeType: transaction.feeType,
            net21: transaction.net21,
            value: transaction.value,
            notes: transaction.notes,
            createdAt: new Date().toISOString(),
            deleted: false // Ensure not marked as deleted
          };
          
          setTransactions(prev => [...prev, restoredTransaction]);
        }
      }
      
      // Update component state - reload transactions to reflect the restore
      loadDeletedTransactions();
      
      if (showSuccess) {
        showSuccess(`تم استعادة المعاملة ${transaction.barcode} بنجاح`);
      }
    } catch (error) {
      console.error('Error restoring transaction:', error);
      if (showError) {
        showError('فشل في استعادة المعاملة');
      }
    }
  };

  const permanentDelete = async (transaction: DeletedTransaction) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف المعاملة ${transaction.barcode} نهائياً؟ لن يمكن استعادتها بعد ذلك.`);
    
    if (confirmed) {
      try {
        // Try to call the API to permanently delete
        try {
          await apiClient.permanentDeleteTransaction(transaction.originalId, 'current-user-id');
        } catch (apiError) {
          console.warn('Permanent delete API not available, deleting locally:', apiError);
        }
        
        // Remove from local deleted list
        // Note: This is handled by the reload function below
        
        // Update component state by reloading
        loadDeletedTransactions();
        
        if (showSuccess) {
          showSuccess(`تم حذف المعاملة ${transaction.barcode} نهائياً`);
        }
      } catch (error) {
        console.error('Error permanently deleting transaction:', error);
        if (showError) {
          showError('فشل في حذف المعاملة نهائياً');
        }
      }
    }
  };

  const filteredTransactions = deletedTransactions.filter(transaction => {
    const matchesSearch = searchTerm === '' || 
      transaction.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClient = selectedClient === '' || transaction.clientName.includes(selectedClient);
    
    const transactionDate = new Date(transaction.deletedAt).toISOString().split('T')[0];
    const matchesDateRange = (!fromDate || transactionDate >= fromDate) && 
                            (!toDate || transactionDate <= toDate);
    
    return matchesSearch && matchesClient && matchesDateRange;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">جاري تحميل المعاملات المحذوفة...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">المعاملات المحذوفة</h1>
          <div className="flex gap-2">
            <button
              onClick={loadDeletedTransactions}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'جاري التحديث...' : '🔄 تحديث'}
            </button>
            <button
              onClick={onBack}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← العودة
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">العميل</label>
            <input
              type="text"
              placeholder="اختر عميل أو اتركه فارغاً"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">بحث</label>
            <input
              type="text"
              placeholder="باركود، عميل، أو وصف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{filteredTransactions.length}</div>
            <div className="text-sm text-gray-600">إجمالي المحذوفات</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {filteredTransactions.filter(t => t.type === 'وارد ذهب' || t.type === 'منصرف ذهب').length}
            </div>
            <div className="text-sm text-gray-600">معاملات الذهب</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {filteredTransactions.filter(t => t.type === 'بيع' || t.type === 'شراء').length}
            </div>
            <div className="text-sm text-gray-600">معاملات البيع/الشراء</div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاريخ الحذف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  النوع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  العميل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الباركود
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الوصف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الوزن
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  القيمة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  سبب الحذف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  محذوف بواسطة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  العمليات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(transaction.deletedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      transaction.type === 'وارد ذهب' ? 'bg-green-100 text-green-800' :
                      transaction.type === 'منصرف ذهب' ? 'bg-red-100 text-red-800' :
                      transaction.type === 'بيع' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.clientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {transaction.barcode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.weight}g
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {parseFloat(transaction.value).toLocaleString()} ر.س
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {transaction.deletionReason}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {transaction.deletedBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2 space-x-reverse">
                      <button
                        onClick={() => restoreTransaction(transaction)}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded text-xs transition-colors"
                      >
                        استعادة
                      </button>
                      <button
                        onClick={() => permanentDelete(transaction)}
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded text-xs transition-colors"
                      >
                        حذف نهائي
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">لا توجد معاملات محذوفة</div>
              <div className="text-gray-400 text-sm mt-2">جرب تعديل معايير البحث أو الفترة الزمنية</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}