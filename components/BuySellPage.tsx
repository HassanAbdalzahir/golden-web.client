'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

interface BuySellTransaction {
  id: string;
  type: 'بيع' | 'شراء';
  clientName: string;
  clientId: string;
  weight: string;
  price: string;
  value: string;
  notes: string;
  createdAt: string;
  barcode?: string;
}

interface BuySellPageProps {
  onBack: () => void;
  wallets: any[];
  transactions: any[];
  clientTransactions?: any[];
  showSuccess?: (message: string) => void;
  showError?: (message: string) => void;
  showWarning?: (message: string) => void;
}

export default function BuySellPage({ 
  onBack, 
  wallets = [], 
  transactions = [],
  clientTransactions = [],
  showSuccess, 
  showError, 
  showWarning 
}: BuySellPageProps) {
  const [buySellTransactions, setBuySellTransactions] = useState<BuySellTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'بيع' | 'شراء'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'weight'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    // Set default date range to current month
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setFromDate(firstDayOfMonth.toISOString().split('T')[0]);
    setToDate(lastDayOfMonth.toISOString().split('T')[0]);
    
    loadBuySellTransactions();
  }, []);

  useEffect(() => {
    loadBuySellTransactions();
  }, [fromDate, toDate, selectedClient, transactions, clientTransactions]);

  const loadBuySellTransactions = async () => {
    setLoading(true);
    try {
      // Filter local transactions for buy/sell types (excluding deleted)
      const localBuySellTransactions = transactions.filter(t => 
        (t.type === 'بيع' || t.type === 'شراء') && !t.deleted
      ).map(transaction => {
        const clientWallet = wallets.find(w => w.id === transaction.clientId);
        const clientName = clientWallet ? 
          (clientWallet.account?.owner ? 
            `${clientWallet.account.owner.firstName || ''} ${clientWallet.account.owner.lastName || ''}`.trim() : 
            clientWallet.name) : 
          'عميل غير معروف';
        
        return {
          id: transaction.id,
          type: transaction.type as 'بيع' | 'شراء',
          clientName: clientName,
          clientId: transaction.clientId,
          weight: transaction.weight || '0',
          price: transaction.price || '0',
          value: transaction.value || '0',
          notes: transaction.notes || '',
          createdAt: transaction.createdAt || new Date().toISOString(),
          barcode: transaction.barcode || ''
        };
      });

      // Also process client transactions (from API) that are buy/sell type
      const apiBasedBuySellTransactions = clientTransactions
        .filter(payment => {
          // Check if the payment description contains buy/sell indicators
          const desc = payment.description?.toLowerCase() || '';
          return desc.includes('بيع') || desc.includes('شراء') || 
                 payment.paymentType === 'PURCHASE' || payment.paymentType === 'SALE';
        })
        .map(payment => {
          const clientWallet = wallets.find(w => w.id === payment.walletId);
          const clientName = clientWallet ? 
            (clientWallet.account?.owner ? 
              `${clientWallet.account.owner.firstName || ''} ${clientWallet.account.owner.lastName || ''}`.trim() : 
              clientWallet.name) : 
            'عميل غير معروف';
          
          // Determine transaction type from description or payment type
          const desc = payment.description?.toLowerCase() || '';
          let transactionType: 'بيع' | 'شراء';
          if (desc.includes('شراء') || payment.paymentType === 'PURCHASE') {
            transactionType = 'شراء';
          } else {
            transactionType = 'بيع';
          }
          
          // Extract price and calculate weight from payment data
          const amountGrams = payment.amountMg ? (parseFloat(payment.amountMg) / 1000) : 0;
          const priceMatch = payment.description?.match(/سعر:\s*(\d+)/); 
          const valueMatch = payment.description?.match(/قيمة:\s*(\d+)/);
          const extractedPrice = priceMatch ? priceMatch[1] : '0';
          const extractedValue = valueMatch ? valueMatch[1] : '0';
          
          return {
            id: `api-${payment.id}`,
            type: transactionType,
            clientName: clientName,
            clientId: payment.walletId,
            weight: amountGrams.toFixed(3),
            price: extractedPrice,
            value: extractedValue,
            notes: payment.description || '',
            createdAt: payment.createdAt,
            barcode: payment.id.slice(-8)
          };
        });

      // Combine both sources and remove duplicates
      const allBuySellTransactions = [...localBuySellTransactions, ...apiBasedBuySellTransactions];
      const uniqueTransactions = allBuySellTransactions.filter((transaction, index, self) => 
        index === self.findIndex(t => t.id === transaction.id)
      );

      setBuySellTransactions(uniqueTransactions);
    } catch (error) {
      console.error('Error loading buy/sell transactions:', error);
      if (showError) {
        showError('فشل في تحميل معاملات البيع والشراء');
      }
      setBuySellTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedTransactions = buySellTransactions
    .filter(transaction => {
      const matchesSearch = searchTerm === '' || 
        transaction.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (transaction.barcode && transaction.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        transaction.notes.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesClient = selectedClient === '' || transaction.clientId === selectedClient;
      const matchesType = selectedType === 'all' || transaction.type === selectedType;
      
      const transactionDate = new Date(transaction.createdAt).toISOString().split('T')[0];
      const matchesDateRange = (!fromDate || transactionDate >= fromDate) && 
                              (!toDate || transactionDate <= toDate);
      
      return matchesSearch && matchesClient && matchesType && matchesDateRange;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'value':
          aValue = parseFloat(a.value);
          bValue = parseFloat(b.value);
          break;
        case 'weight':
          aValue = parseFloat(a.weight);
          bValue = parseFloat(b.weight);
          break;
        default:
          return 0;
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

  // Calculate statistics
  const sellTransactions = filteredAndSortedTransactions.filter(t => t.type === 'بيع');
  const buyTransactions = filteredAndSortedTransactions.filter(t => t.type === 'شراء');
  
  const totalSellWeight = sellTransactions.reduce((sum, t) => sum + parseFloat(t.weight || '0'), 0);
  const totalBuyWeight = buyTransactions.reduce((sum, t) => sum + parseFloat(t.weight || '0'), 0);
  const totalSellValue = sellTransactions.reduce((sum, t) => sum + parseFloat(t.value || '0'), 0);
  const totalBuyValue = buyTransactions.reduce((sum, t) => sum + parseFloat(t.value || '0'), 0);
  
  const avgSellPrice = totalSellWeight > 0 ? (totalSellValue / totalSellWeight).toFixed(0) : '0';
  const avgBuyPrice = totalBuyWeight > 0 ? (totalBuyValue / totalBuyWeight).toFixed(0) : '0';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('ar', { maximumFractionDigits: 3 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">جاري تحميل معاملات البيع والشراء...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">معاملات البيع والشراء</h1>
          <div className="flex gap-2">
            <button
              onClick={loadBuySellTransactions}
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
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">جميع العملاء</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.account?.owner ? 
                    `${wallet.account.owner.firstName || ''} ${wallet.account.owner.lastName || ''}`.trim() : 
                    wallet.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">النوع</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as 'all' | 'بيع' | 'شراء')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع الأنواع</option>
              <option value="بيع">بيع فقط</option>
              <option value="شراء">شراء فقط</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ترتيب حسب</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'value' | 'weight')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">التاريخ</option>
              <option value="value">القيمة</option>
              <option value="weight">الوزن</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">بحث</label>
            <input
              type="text"
              placeholder="عميل، باركود، أو ملاحظة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Statistics Matrix */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">ملخص المعاملات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Sell Statistics */}
          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
            <h3 className="text-lg font-semibold text-green-700 mb-2">معاملات البيع</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">عدد المعاملات:</span>
                <span className="font-medium">{formatNumber(sellTransactions.length)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي الوزن:</span>
                <span className="font-medium">{formatNumber(totalSellWeight)}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي القيمة:</span>
                <span className="font-medium">{formatNumber(totalSellValue)} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">متوسط السعر:</span>
                <span className="font-medium">{avgSellPrice} ر.س/جم</span>
              </div>
            </div>
          </div>

          {/* Buy Statistics */}
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-blue-700 mb-2">معاملات الشراء</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">عدد المعاملات:</span>
                <span className="font-medium">{formatNumber(buyTransactions.length)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي الوزن:</span>
                <span className="font-medium">{formatNumber(totalBuyWeight)}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي القيمة:</span>
                <span className="font-medium">{formatNumber(totalBuyValue)} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">متوسط السعر:</span>
                <span className="font-medium">{avgBuyPrice} ر.س/جم</span>
              </div>
            </div>
          </div>

          {/* Net Position */}
          <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
            <h3 className="text-lg font-semibold text-purple-700 mb-2">صافي المركز</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">صافي الوزن:</span>
                <span className={`font-medium ${totalSellWeight - totalBuyWeight >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber(totalSellWeight - totalBuyWeight)}g
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">صافي القيمة:</span>
                <span className={`font-medium ${totalSellValue - totalBuyValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber(totalSellValue - totalBuyValue)} ر.س
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">الاتجاه:</span>
                <span className={`font-medium ${totalSellWeight >= totalBuyWeight ? 'text-green-600' : 'text-blue-600'}`}>
                  {totalSellWeight >= totalBuyWeight ? 'بائع صافي' : 'مشتري صافي'}
                </span>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-500">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">الإجماليات</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي المعاملات:</span>
                <span className="font-medium">{formatNumber(filteredAndSortedTransactions.length)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي الوزن:</span>
                <span className="font-medium">{formatNumber(totalSellWeight + totalBuyWeight)}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي القيمة:</span>
                <span className="font-medium">{formatNumber(totalSellValue + totalBuyValue)} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">فترة البيانات:</span>
                <span className="font-medium">
                  {fromDate && toDate ? `${fromDate} - ${toDate}` : 'جميع التواريخ'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">تفاصيل المعاملات</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">ترتيب:</span>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="text-sm bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
            >
              {sortOrder === 'asc' ? '↑ تصاعدي' : '↓ تنازلي'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  التاريخ
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
                  الوزن
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  السعر
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  القيمة الإجمالية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ملاحظات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(transaction.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      transaction.type === 'بيع' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.clientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {transaction.barcode || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {parseFloat(transaction.weight).toFixed(3)}g
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(parseFloat(transaction.price))} ر.س/جم
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatNumber(parseFloat(transaction.value))} ر.س
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {transaction.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredAndSortedTransactions.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">لا توجد معاملات بيع أو شراء</div>
              <div className="text-gray-400 text-sm mt-2">جرب تعديل معايير البحث أو الفترة الزمنية</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}