'use client';

import { useState, useEffect } from 'react';
import { apiClient, Wallet, LedgerEntry } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ToastContainer';

interface ClientWalletGroup {
  accountId: string;
  accountName: string;
  goldWallet: Wallet | null;
  moneyWallet: Wallet | null;
  goldBalance: { balanceGrams: number; balanceMg: string } | null;
  moneyBalance: { balanceGrams: number; balanceMg: string } | null;
}

interface ProcessedTransaction {
  id: string;
  code: string;
  date: string;
  type: string;
  description: string;

  // Gold
  goldCredit: number; // له
  goldDebit: number;  // عليه
  goldBalance: number; // رصيد

  // Money
  cashCredit: number; // له
  cashDebit: number;  // عليه
  cashBalance: number; // رصيد

  price: number | null;
  notes: string;
}

export default function JournalEntryPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [clientGroups, setClientGroups] = useState<ClientWalletGroup[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Form State
  const [adjustmentType, setAdjustmentType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [currencyType, setCurrencyType] = useState<'GOLD' | 'MONEY'>('GOLD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [isLocal, setIsLocal] = useState(false);

  // Auth State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Data State
  const [transactions, setTransactions] = useState<ProcessedTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addToast, toasts, removeToast } = useToast();

  // Initial Load
  useEffect(() => {
    loadWallets();
    const storedUsername = localStorage.getItem('golden_username');
    if (storedUsername) {
      setUsername(storedUsername);
    } else if (localStorage.getItem('golden_auth_token')) {
      setUsername('admin');
      localStorage.setItem('golden_username', 'admin');
    }

    // Refresh on focus
    const handleFocus = () => loadWallets();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Process Wallets into Groups
  useEffect(() => {
    if (wallets.length > 0) {
      groupWalletsAndLoadBalances();
    }
  }, [wallets]);

  // Load History when Account Selected
  useEffect(() => {
    if (selectedAccountId) {
      loadLedgerHistory(selectedAccountId);
    } else {
      setTransactions([]);
    }
  }, [selectedAccountId]);

  const loadWallets = async () => {
    try {
      const response = await apiClient.getWallets();
      setWallets(response.data);
    } catch (error) {
      addToast('خطأ في تحميل المحافظ', 'error');
    }
  };

  const groupWalletsAndLoadBalances = async () => {
    const accountMap = new Map<string, ClientWalletGroup>();

    for (const wallet of wallets) {
      if (!wallet.account) continue;

      const accountId = wallet.account.id;
      if (!accountMap.has(accountId)) {
        accountMap.set(accountId, {
          accountId,
          accountName: wallet.account.name,
          goldWallet: null,
          moneyWallet: null,
          goldBalance: null,
          moneyBalance: null,
        });
      }

      const group = accountMap.get(accountId)!;
      const isGoldWallet = wallet.currency === 'GOLD' || wallet.currency === 'XAU';

      if (isGoldWallet) {
        group.goldWallet = wallet;
      } else {
        group.moneyWallet = wallet;
      }
    }

    const groups = Array.from(accountMap.values());

    // Load balances
    for (const group of groups) {
      if (group.goldWallet) {
        try {
          const res = await apiClient.getWalletBalance(group.goldWallet.id);
          group.goldBalance = res.data;
        } catch (e) {
          console.error('Error loading gold balance', e);
        }
      }
      if (group.moneyWallet) {
        try {
          const res = await apiClient.getWalletBalance(group.moneyWallet.id);
          group.moneyBalance = res.data;
        } catch (e) {
          console.error('Error loading money balance', e);
        }
      }
    }

    setClientGroups(groups);
  };

  const loadLedgerHistory = async (accountId: string) => {
    setLoadingHistory(true);
    try {
      const group = clientGroups.find(g => g.accountId === accountId);
      if (!group) return;

      const promises = [];
      if (group.goldWallet) {
        promises.push(
          apiClient.getWalletHistory(group.goldWallet.id).then(res =>
            res.data.map((entry: any) => ({ ...entry, currency: 'GOLD' }))
          )
        );
      }
      if (group.moneyWallet) {
        promises.push(
          apiClient.getWalletHistory(group.moneyWallet.id).then(res =>
            res.data.map((entry: any) => ({ ...entry, currency: 'MONEY' }))
          )
        );
      }

      const results = await Promise.all(promises);
      const rawEntries = results.flat().sort((a, b) =>
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );

      // Process entries to calculate running balances
      let runningGoldBalance = 0;
      let runningCashBalance = 0;

      const processed: ProcessedTransaction[] = rawEntries.map(entry => {
        const isGold = entry.currency === 'GOLD';
        const amount = parseFloat(entry.amountMg);
        const actualAmount = isGold ? amount / 1000 : amount / 100;

        let goldCredit = 0;
        let goldDebit = 0;
        let cashCredit = 0;
        let cashDebit = 0;

        if (entry.entryType === 'CREDIT') {
          if (isGold) {
            goldCredit = actualAmount;
            runningGoldBalance += actualAmount;
          } else {
            cashCredit = actualAmount;
            runningCashBalance += actualAmount;
          }
        } else {
          if (isGold) {
            goldDebit = actualAmount;
            runningGoldBalance -= actualAmount;
          } else {
            cashDebit = actualAmount;
            runningCashBalance -= actualAmount;
          }
        }

        // Extract price from description if exists
        const priceMatch = entry.description.match(/سعر:\s*(\d+)/);
        const price = priceMatch ? parseFloat(priceMatch[1]) : null;

        return {
          id: entry.id,
          code: entry.id.slice(-8),
          date: entry.transactionDate,
          type: entry.referenceType === 'JOURNAL_ENTRY' ? 'سند قيد' : entry.referenceType,
          description: entry.description,
          goldCredit,
          goldDebit,
          goldBalance: runningGoldBalance,
          cashCredit,
          cashDebit,
          cashBalance: runningCashBalance,
          price,
          notes: entry.description,
        };
      });

      // Show newest first
      setTransactions(processed.reverse());

    } catch (error) {
      console.error('Error loading history:', error);
      addToast('خطأ في تحميل سجل المعاملات', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const validatePassword = async (): Promise<boolean> => {
    if (!username) {
      addToast('اسم المستخدم غير موجود', 'error');
      return false;
    }
    try {
      const response = await apiClient.validateJournalPassword(username, password);
      return response.data.valid;
    } catch (error) {
      return false;
    }
  };

  const handlePasswordSubmit = async () => {
    const isValid = await validatePassword();
    if (isValid) {
      setShowPasswordModal(false);
      addToast('تم التحقق بنجاح', 'success');
      await performCreateEntry();
    } else {
      addToast('كلمة مرور خاطئة', 'error');
      setPassword('');
    }
  };

  const handleSubmit = () => {
    if (!selectedAccountId || !amount || !description) {
      addToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }
    if (!username) {
      addToast('يرجى تسجيل الدخول', 'error');
      return;
    }
    setShowPasswordModal(true);
  };

  const performCreateEntry = async () => {
    const selectedGroup = clientGroups.find(g => g.accountId === selectedAccountId);
    if (!selectedGroup) return;

    const selectedWallet = currencyType === 'GOLD' ? selectedGroup.goldWallet : selectedGroup.moneyWallet;
    if (!selectedWallet) {
      addToast(`لا يوجد محفظة ${currencyType === 'GOLD' ? 'ذهب' : 'نقدية'} لهذا العميل`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalAmount: number;
      if (currencyType === 'GOLD') {
        finalAmount = Math.round(parseFloat(amount) * 1000); // Grams to Mg
      } else {
        finalAmount = Math.round(parseFloat(amount) * 100); // Units to Cents
      }

      await apiClient.createJournalEntry({
        walletId: selectedWallet.id,
        entryType: 'MANUAL_ADJUSTMENT',
        adjustmentType,
        currencyType,
        amount: finalAmount,
        description,
        isLocal,
        username,
        password,
        referenceId: referenceId || undefined,
      });

      addToast('تم إنشاء القيد بنجاح', 'success');
      setAmount('');
      setDescription('');
      setReferenceId('');
      setPassword('');

      // Refresh
      await loadWallets();
      await loadLedgerHistory(selectedAccountId);

    } catch (error: any) {
      const msg = error.response?.data?.message || 'خطأ في العملية';
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedGroup = clientGroups.find(g => g.accountId === selectedAccountId);

  return (
    <div className="min-h-screen bg-gray-50 text-right" dir="rtl" style={{ fontFamily: 'Alexandria, sans-serif' }}>
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      <header className="bg-blue-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">سند قيد - تعديل أرصدة العملاء</h1>
            <p className="text-blue-100 mt-1">إدارة الأرصدة والقيود المالية (ذهب ونقدية)</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium">
              {username || 'غير مسجل'}
            </div>
            <button onClick={loadWallets} className="bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded-lg transition-colors">
              تحديث
            </button>
            <button onClick={() => window.history.back()} className="bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded-lg transition-colors">
              رجوع
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Balances */}
        {selectedGroup && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-x-reverse divide-gray-200">

              <div className="p-6 bg-green-50">
                <div className="text-sm text-gray-500 mb-1">له ذهب</div>
                <div className="text-2xl font-bold text-green-700">
                  {selectedGroup.goldBalance && selectedGroup.goldBalance.balanceGrams > 0
                    ? selectedGroup.goldBalance.balanceGrams.toFixed(3)
                    : '0.000'}
                  <span className="text-xs text-gray-400 mr-2">جرام</span>
                </div>
              </div>

              <div className="p-6 bg-red-50">
                <div className="text-sm text-gray-500 mb-1">عليه ذهب</div>
                <div className="text-2xl font-bold text-red-700">
                  {selectedGroup.goldBalance && selectedGroup.goldBalance.balanceGrams < 0
                    ? Math.abs(selectedGroup.goldBalance.balanceGrams).toFixed(3)
                    : '0.000'}
                  <span className="text-xs text-gray-400 mr-2">جرام</span>
                </div>
              </div>

              <div className="p-6 bg-green-50">
                <div className="text-sm text-gray-500 mb-1">له نقدية</div>
                <div className="text-2xl font-bold text-green-700">
                  {selectedGroup.moneyBalance && parseFloat(selectedGroup.moneyBalance.balanceMg) > 0
                    ? (parseFloat(selectedGroup.moneyBalance.balanceMg) / 100).toFixed(2)
                    : '0.00'}
                  <span className="text-xs text-gray-400 mr-2">وحدة</span>
                </div>
              </div>

              <div className="p-6 bg-red-50">
                <div className="text-sm text-gray-500 mb-1">عليه نقدية</div>
                <div className="text-2xl font-bold text-red-700">
                  {selectedGroup.moneyBalance && parseFloat(selectedGroup.moneyBalance.balanceMg) < 0
                    ? Math.abs(parseFloat(selectedGroup.moneyBalance.balanceMg) / 100).toFixed(2)
                    : '0.00'}
                  <span className="text-xs text-gray-400 mr-2">وحدة</span>
                </div>
              </div>

            </div>
            <div className="bg-gray-50 px-6 py-3 border-t flex justify-between items-center">
              <div className="font-mono text-sm text-gray-600">
                الكود: <span className="font-bold text-gray-800">{selectedGroup.accountId.slice(-8)}</span>
              </div>
              <div className="text-sm text-gray-500">
                {selectedGroup.accountName}
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">إنشاء عملية جديدة</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">العميل</label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- اختر العميل --</option>
                {clientGroups.map(g => (
                  <option key={g.accountId} value={g.accountId}>{g.accountName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع العملة</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrencyType('GOLD')}
                  disabled={!selectedGroup?.goldWallet}
                  className={`flex-1 py-2.5 rounded-lg font-medium ${currencyType === 'GOLD' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  ذهب
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyType('MONEY')}
                  disabled={!selectedGroup?.moneyWallet}
                  className={`flex-1 py-2.5 rounded-lg font-medium ${currencyType === 'MONEY' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  نقدية
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع العملية</label>
              <select
                value={adjustmentType}
                onChange={e => setAdjustmentType(e.target.value as any)}
                className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="INCREASE">إضافة رصيد (وارد)</option>
                <option value="DECREASE">خصم رصيد (منصرف)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {currencyType === 'GOLD' ? 'الكمية (جرام)' : 'المبلغ'}
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00"
              />
            </div>

            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <input
                type="checkbox"
                id="isLocalMain"
                checked={isLocal}
                onChange={e => setIsLocal(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isLocalMain" className="text-sm font-medium text-gray-700">
                سبيكة بلدي
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="وصف العملية..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">رقم المرجع</label>
              <input
                type="text"
                value={referenceId}
                onChange={e => setReferenceId(e.target.value)}
                className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedAccountId}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {isSubmitting ? 'جاري التنفيذ...' : 'تسجيل القيد'}
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-bold text-gray-700">سجل حركات الحساب (Ledger History)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="px-2 py-3 border border-blue-500">الكود</th>
                  <th className="px-2 py-3 border border-blue-500 bg-yellow-600">رصيد الذهب</th>
                  <th className="px-2 py-3 border border-blue-500 bg-green-600">رصيد النقدية</th>
                  <th className="px-2 py-3 border border-blue-500">الحركة</th>
                  <th className="px-2 py-3 border border-blue-500">التاريخ</th>
                  <th className="px-2 py-3 border border-blue-500">ذهب له</th>
                  <th className="px-2 py-3 border border-blue-500">ذهب عليه</th>
                  <th className="px-2 py-3 border border-blue-500">نقدي له</th>
                  <th className="px-2 py-3 border border-blue-500">نقدية عليه</th>
                  <th className="px-2 py-3 border border-blue-500">سعر</th>
                  <th className="px-2 py-3 border border-blue-500 w-1/4">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loadingHistory ? (
                  <tr><td colSpan={11} className="py-8 text-gray-500">جاري التحميل...</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={11} className="py-8 text-gray-500">لا توجد حركات</td></tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-2 py-2 border font-mono">{tx.code}</td>
                      <td className="px-2 py-2 border font-bold text-yellow-700 bg-yellow-50">{tx.goldBalance.toFixed(3)}g</td>
                      <td className="px-2 py-2 border font-bold text-green-700 bg-green-50">{tx.cashBalance.toFixed(2)}</td>
                      <td className="px-2 py-2 border">{tx.type}</td>
                      <td className="px-2 py-2 border" dir="ltr">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>

                      <td className="px-2 py-2 border font-bold text-green-600">
                        {tx.goldCredit > 0 ? tx.goldCredit.toFixed(3) : ''}
                      </td>
                      <td className="px-2 py-2 border font-bold text-red-600">
                        {tx.goldDebit > 0 ? tx.goldDebit.toFixed(3) : ''}
                      </td>
                      <td className="px-2 py-2 border font-bold text-green-600">
                        {tx.cashCredit > 0 ? tx.cashCredit.toFixed(2) : ''}
                      </td>
                      <td className="px-2 py-2 border font-bold text-red-600">
                        {tx.cashDebit > 0 ? tx.cashDebit.toFixed(2) : ''}
                      </td>

                      <td className="px-2 py-2 border font-mono">{tx.price || ''}</td>
                      <td className="px-2 py-2 border text-gray-600 text-xs text-right truncate max-w-xs" title={tx.notes}>
                        {tx.notes}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-2xl transform transition-all">
            <h3 className="text-xl font-bold mb-4">تأكيد العملية</h3>
            <p className="mb-4 text-gray-600 text-sm">أدخل كلمة المرور لتأكيد العملية</p>
            <input
              type="password"
              autoFocus
              className="w-full border p-3 rounded mb-4 outline-none focus:border-blue-500"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded"
              >
                إلغاء
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
