'use client';

import { useState, useEffect } from 'react';
import { apiClient, Wallet, Payment, Transfer } from '../lib/api';
import { ClientBalanceCalculator, ClientBalance } from '../lib/balanceCalculator';

interface ClientAccountPageProps {
  onBack: () => void;
  wallets: Wallet[];
  todayPrice: string;
  averagePrice: string;
  selectedAccountId: string;
}

interface ClientDetails {
  primaryWallet: Wallet;
  owner: {
    firstName: string;
    lastName: string;
    email: string;
    username: string;
  };
  balance: ClientBalance;
  payments: Payment[];
  transfers: Transfer[];
}

export default function ClientAccountPage({ onBack, wallets, todayPrice, averagePrice, selectedAccountId }: ClientAccountPageProps) {
  const [clientDetails, setClientDetails] = useState<ClientDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const loadClientDetails = async (accountId: string) => {
    if (!accountId) return;

    setLoading(true);
    try {
      // all wallets that belong to this account
      const clientWallets = wallets.filter(w => w.account?.id === accountId);
      if (clientWallets.length === 0) {
        throw new Error('Wallet not found');
      }

      // use first wallet as representative for owner info
      const primaryWallet = clientWallets[0];

      // Load payments for any of these wallets
      const paymentsResponse = await apiClient.getAllPayments();
      const allPayments = Array.isArray(paymentsResponse.data) ? paymentsResponse.data : [];
      const clientPayments = allPayments.filter((p: Payment) =>
        clientWallets.some(w => w.id === p.walletId)
      );

      // Load transfers involving any of these wallets
      const transfersResponse = await apiClient.getAllTransfers();
      const allTransfers = Array.isArray(transfersResponse.data) ? transfersResponse.data : [];
      const clientTransfers = allTransfers.filter((t: Transfer) =>
        clientWallets.some(w => w.id === t.fromWalletId || w.id === t.toWalletId)
      );

      // Calculate balance across both gold and money wallets
      const paymentTransactions = clientPayments.map(p => {
        const amountGrams = parseFloat(p.amountMg) / 1000;
        
        let transactionType = p.paymentType === 'DEPOSIT' ? 'وارد ذهب' : 'منصرف ذهب';
        if (p.description.startsWith('بيع:')) {
          transactionType = 'بيع';
        } else if (p.description.startsWith('شراء:')) {
          transactionType = 'شراء';
        } else if (p.description.startsWith('وارد نقدية:')) {
          transactionType = 'وارد نقدية';
        } else if (p.description.startsWith('منصرف نقدية:')) {
          transactionType = 'منصرف نقدية';
        }
        
        let amountCash = 0;
        let savedPrice = null;
        
        const priceMatch = p.description.match(/سعر:\s*(\d+)/);
        if (priceMatch) {
          savedPrice = priceMatch[1];
        }
        
        if (transactionType === 'بيع' || transactionType === 'شراء') {
          const valueMatch = p.description.match(/قيمة:\s*(\d+)/);
          amountCash = valueMatch ? parseFloat(valueMatch[1]) : 0;
        } else if (transactionType === 'وارد نقدية' || transactionType === 'منصرف نقدية') {
          const amountMatch = p.description.match(/مبلغ:\s*(\d+)/);
          amountCash = amountMatch ? parseFloat(amountMatch[1]) : 0;
        }

        return {
          id: p.id,
          type: transactionType,
          amountGrams: amountGrams,
          weight: amountGrams.toString(),
          net21: amountGrams.toString(),
          clientId: p.walletId,
          status: p.status,
          createdAt: p.createdAt,
          amountCash: amountCash,
          price: savedPrice
        };
      });

      const transferTransactions = clientTransfers.map(t => {
        const involved = clientWallets.some(w => w.id === t.toWalletId);
        const isIncoming = involved && clientWallets.some(w => w.id === t.toWalletId);
        const amountGrams = parseFloat(t.amountMg) / 1000;
        return {
          id: t.id,
          type: isIncoming ? 'وارد ذهب' : 'منصرف ذهب',
          amountGrams: amountGrams,
          weight: amountGrams.toString(),
          net21: amountGrams.toString(),
          clientId: involved ? (t.toWalletId === clientWallets[0].id ? t.toWalletId : t.fromWalletId) : t.fromWalletId,
          status: t.status,
          createdAt: t.createdAt
        };
      });

      const allTransactions = [...paymentTransactions, ...transferTransactions];
      const balance = ClientBalanceCalculator.calculateBalance(
        allTransactions,
        parseFloat(todayPrice) || 2100
      );

      setClientDetails({
        primaryWallet,
        owner: {
          firstName: primaryWallet.account?.owner?.firstName || '',
          lastName: primaryWallet.account?.owner?.lastName || '',
          email: primaryWallet.account?.owner?.email || '',
          username: primaryWallet.account?.owner?.username || ''
        },
        balance,
        payments: clientPayments,
        transfers: clientTransfers
      });

    } catch (error) {
      console.error('Error loading client details:', error);
      alert('فشل تحميل بيانات العميل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      loadClientDetails(selectedAccountId);
    }
  }, [selectedAccountId, todayPrice]);

  const clientWallets = wallets.filter(w => w.account?.id === selectedAccountId);

  const formatBalance = (balance: ClientBalance) => {
    return ClientBalanceCalculator.formatBalance(balance);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white rounded-lg shadow flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-blue-50 rounded-t-lg">
          <h2 className="text-xl font-bold text-blue-800">حساب العميل - تفاصيل كاملة</h2>
          <button
            onClick={onBack}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
          >
            رجوع
          </button>
        </div>

        {/* Client Info Display */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-gray-700">العميل المحدد:</span>
              <span className="text-lg font-bold text-blue-800">
                {(() => {
                  const wallet = wallets.find(w => w.account?.id === selectedAccountId);
                  if (wallet?.account?.owner) {
                    const owner = wallet.account.owner;
                    return `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || wallet.name;
                  }
                  return wallet?.name || 'لم يتم اختيار عميل';
                })()}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <span>سعر اليوم: </span>
                <span className="font-bold text-green-600">{todayPrice}</span>
              </div>
              <div className="text-sm text-gray-600">
                <span>متوسط السعر: </span>
                <span className="font-bold text-blue-600">{averagePrice}</span>
              </div>
              <button
                onClick={() => selectedAccountId && loadClientDetails(selectedAccountId)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                disabled={!selectedAccountId}
              >
                تحديث البيانات
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-lg text-gray-500">جاري تحميل بيانات العميل...</div>
            </div>
          ) : !selectedAccountId ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-lg text-orange-500">يرجى اختيار عميل من الشاشة الرئيسية أولاً</div>
            </div>
          ) : !clientDetails ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-lg text-red-500">لا توجد بيانات للعميل المحدد</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Client Info Card */}
              <div className="bg-white rounded-lg shadow border">
                <div className="p-4 bg-blue-100 border-b">
                  <h3 className="font-bold text-blue-800">معلومات العميل</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-600">الاسم:</span>
                    <span className="font-semibold ml-2">
                      {`${clientDetails.owner.firstName} ${clientDetails.owner.lastName}`.trim() || 'غير محدد'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">اسم المستخدم:</span>
                    <span className="font-semibold ml-2">{clientDetails.owner.username || 'غير محدد'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">البريد الإلكتروني:</span>
                    <span className="font-semibold ml-2">{clientDetails.owner.email || 'غير محدد'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">معرف المحفظة الرئيسي:</span>
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {clientDetails.primaryWallet.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance Summary */}
              <div className="bg-white rounded-lg shadow border">
                <div className="p-4 bg-green-100 border-b">
                  <h3 className="font-bold text-green-800">ملخص الأرصدة</h3>
                </div>
                <div className="p-4">
                  {(() => {
                    const formatted = formatBalance(clientDetails.balance);
                    return (
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-700">الذهب</h4>
                          <div className={`p-3 rounded ${
                            formatted.goldStatus === 'له ذهب' ? 'bg-green-100 text-green-800' :
                            formatted.goldStatus === 'عليه ذهب' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            <div className="font-bold text-lg">{formatted.goldAmount.toFixed(3)}g</div>
                            <div className="text-sm">{formatted.goldStatus}</div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-700">النقدية</h4>
                          <div className={`p-3 rounded ${
                            formatted.cashStatus === 'له نقدية' ? 'bg-green-100 text-green-800' :
                            formatted.cashStatus === 'عليه نقدية' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            <div className="font-bold text-lg">{formatted.cashAmount.toFixed(2)}</div>
                            <div className="text-sm">{formatted.cashStatus}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Transaction Statistics */}
              <div className="bg-white rounded-lg shadow border">
                <div className="p-4 bg-yellow-100 border-b">
                  <h3 className="font-bold text-yellow-800">إحصائيات المعاملات</h3>
                </div>
                <div className="p-4 grid grid-cols-4 gap-4 text-center">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-2xl font-bold text-blue-600">{clientDetails.payments.length}</div>
                    <div className="text-sm text-blue-600">إجمالي المدفوعات</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-2xl font-bold text-green-600">{clientDetails.transfers.length}</div>
                    <div className="text-sm text-green-600">إجمالي التحويلات</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <div className="text-2xl font-bold text-purple-600">
                      {clientDetails.payments.filter(p => p.description.includes('بيع:')).length}
                    </div>
                    <div className="text-sm text-purple-600">عمليات البيع</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded">
                    <div className="text-2xl font-bold text-orange-600">
                      {clientDetails.payments.filter(p => p.description.includes('شراء:')).length}
                    </div>
                    <div className="text-sm text-orange-600">عمليات الشراء</div>
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-white rounded-lg shadow border">
                <div className="p-4 bg-gray-100 border-b">
                  <h3 className="font-bold text-gray-800">آخر المعاملات</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-right border-r">الكود</th>
                        <th className="px-4 py-3 text-right border-r">النوع</th>
                        <th className="px-4 py-3 text-right border-r">المبلغ/الوزن</th>
                        <th className="px-4 py-3 text-right border-r">التاريخ</th>
                        <th className="px-4 py-3 text-right border-r">الحالة</th>
                        <th className="px-4 py-3 text-right">التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...clientDetails.payments, ...clientDetails.transfers]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .slice(0, 10)
                        .map((transaction, index) => {
                          const isPayment = 'paymentType' in transaction;
                          let displayType = '';
                          let amount = '';
                          
                          if (isPayment) {
                            const payment = transaction as Payment;
                            if (payment.description.startsWith('بيع:')) {
                              displayType = 'بيع';
                              const valueMatch = payment.description.match(/قيمة:\s*(\d+)/);
                              amount = valueMatch ? `${valueMatch[1]} ج.م` : '';
                            } else if (payment.description.startsWith('شراء:')) {
                              displayType = 'شراء';
                              const valueMatch = payment.description.match(/قيمة:\s*(\d+)/);
                              amount = valueMatch ? `${valueMatch[1]} ج.م` : '';
                            } else if (payment.description.startsWith('وارد نقدية:')) {
                              displayType = 'وارد نقدية';
                              const amountMatch = payment.description.match(/مبلغ:\s*(\d+)/);
                              amount = amountMatch ? `${amountMatch[1]} ج.م` : '';
                            } else if (payment.description.startsWith('منصرف نقدية:')) {
                              displayType = 'منصرف نقدية';
                              const amountMatch = payment.description.match(/مبلغ:\s*(\d+)/);
                              amount = amountMatch ? `${amountMatch[1]} ج.م` : '';
                            } else {
                              displayType = payment.paymentType === 'DEPOSIT' ? 'إيداع ذهب' : 'سحب ذهب';
                              amount = `${(parseFloat(payment.amountMg) / 1000).toFixed(3)}g`;
                            }
                          } else {
                            const transfer = transaction as Transfer;
                            displayType = clientWallets.some(w => w.id === transfer.toWalletId) ? 'تحويل وارد' : 'تحويل صادر';
                            amount = `${(parseFloat(transfer.amountMg) / 1000).toFixed(3)}g`;
                          }

                          return (
                            <tr key={transaction.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="px-4 py-3 border-r font-mono text-xs">
                                {transaction.id.slice(-8)}
                              </td>
                              <td className="px-4 py-3 border-r">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  displayType.includes('بيع') ? 'bg-red-100 text-red-800' :
                                  displayType.includes('شراء') ? 'bg-green-100 text-green-800' :
                                  displayType.includes('وارد') ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {displayType}
                                </span>
                              </td>
                              <td className="px-4 py-3 border-r font-semibold">{amount}</td>
                              <td className="px-4 py-3 border-r text-xs">
                                {new Date(transaction.createdAt).toLocaleDateString('ar')}
                              </td>
                              <td className="px-4 py-3 border-r">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                  transaction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {transaction.status === 'COMPLETED' ? 'مكتملة' :
                                   transaction.status === 'PENDING' ? 'معلقة' : transaction.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-xs">
                                {'description' in transaction 
                                  ? (transaction.description || '').split('|')[0].replace(/^(بيع|شراء|وارد نقدية|منصرف نقدية):/, '').trim()
                                  : (transaction as Transfer).description || ''
                                }
                              </td>
                            </tr>
                          );
                        })
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}