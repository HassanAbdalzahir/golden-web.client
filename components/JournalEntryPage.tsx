'use client';

import { useState, useEffect } from 'react';
import { apiClient, Wallet } from '../lib/api';
import { useToast } from '../hooks/useToast';

interface JournalEntryPageProps {
  onClose: () => void;
}

interface JournalEntry {
  id: string;
  walletId: string;
  entryType: 'MANUAL_ADJUSTMENT' | 'BALANCE_CORRECTION' | 'ADMIN_OVERRIDE';
  adjustmentType: 'INCREASE' | 'DECREASE';
  currencyType: 'GOLD' | 'MONEY';
  amount: string;
  description: string;
  isLocal?: boolean;
  createdBy: string;
  createdAt: string;
  referenceId?: string;
  wallet?: {
    name: string;
    currency: string;
    account?: {
      name: string;
      owner?: {
        firstName: string;
        lastName: string;
      };
    };
  };
  user?: {
    firstName: string;
    lastName: string;
    username: string;
  };
}

export default function JournalEntryPage({ onClose }: JournalEntryPageProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [currencyType, setCurrencyType] = useState<'GOLD' | 'MONEY'>('GOLD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [isLocal, setIsLocal] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentWalletBalance, setCurrentWalletBalance] = useState<number | null>(null);
  const { addToast } = useToast();

  // Load wallets on component mount
  useEffect(() => {
    loadWallets();
  }, []);

  // Load wallet balance when wallet selection changes
  useEffect(() => {
    if (selectedWallet) {
      loadWalletBalance();
      // Auto-detect currency type based on wallet
      const wallet = wallets.find(w => w.id === selectedWallet);
      if (wallet) {
        const isGoldWallet = wallet.currency === 'GOLD' || wallet.currency === 'XAU';
        const isMoneyWallet = wallet.currency === 'USD' || wallet.currency === 'EGP' || wallet.currency === 'CASH';

        if (isGoldWallet) {
          setCurrencyType('GOLD');
        } else if (isMoneyWallet) {
          setCurrencyType('MONEY');
        }
      }
    }
  }, [selectedWallet, wallets]);

  // Load journal entries when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadJournalEntries();
    }
  }, [isAuthenticated]);

  const loadWallets = async () => {
    try {
      const response = await apiClient.getWallets();
      setWallets(response.data);
    } catch (error) {
      addToast('خطأ في تحميل المحافظ', 'error');
    }
  };

  const loadWalletBalance = async () => {
    if (!selectedWallet) return;

    try {
      const response = await apiClient.getWalletBalance(selectedWallet);
      setCurrentWalletBalance(response.data.balanceGrams);
    } catch (error) {
      addToast('خطأ في تحميل رصيد المحفظة', 'error');
    }
  };

  const loadJournalEntries = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getJournalEntries();
      setJournalEntries(response.data);
    } catch (error) {
      addToast('خطأ في تحميل السجلات', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const validatePassword = async (enteredPassword: string): Promise<boolean> => {
    try {
      const response = await apiClient.validateJournalPassword('admin', enteredPassword);
      return response.data.valid;
    } catch (error) {
      return false;
    }
  };

  const handlePasswordSubmit = async () => {
    const isValid = await validatePassword(password);
    if (isValid) {
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      addToast('تم التحقق من كلمة المرور بنجاح', 'success');
    } else {
      addToast('كلمة مرور خاطئة', 'error');
      setPassword('');
    }
  };

  const handleSubmit = async () => {
    if (!selectedWallet || !amount || !description) {
      addToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }

    if (!isAuthenticated) {
      setShowPasswordModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert amount based on currency type
      let finalAmount: number;
      if (currencyType === 'GOLD') {
        finalAmount = Math.round(parseFloat(amount) * 1000); // Convert grams to milligrams
      } else {
        finalAmount = Math.round(parseFloat(amount) * 100); // Convert currency units to cents
      }

      await apiClient.createJournalEntry({
        walletId: selectedWallet,
        entryType: 'MANUAL_ADJUSTMENT',
        adjustmentType,
        currencyType,
        amount: finalAmount,
        description,
        isLocal,
        username: 'admin',
        password: 'journal123', // This should match the backend password
        referenceId: referenceId || undefined,
      });

      addToast('تم إنشاء القيد بنجاح', 'success');
      // Reset form
      setAmount('');
      setDescription('');
      setReferenceId('');
      // Reload data
      await loadJournalEntries();
      await loadWalletBalance();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'خطأ في إنشاء القيد';
      addToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (amount: string, currencyType: string) => {
    if (currencyType === 'GOLD') {
      return (parseFloat(amount) / 1000).toFixed(3) + ' جرام';
    } else {
      return (parseFloat(amount) / 100).toFixed(2) + ' وحدة نقدية';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-screen overflow-auto m-4">

        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Alexandria, sans-serif' }}>
            سند قيد - تعديل أرصدة المحافظ
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Entry Form */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: 'Alexandria, sans-serif' }}>
              إنشاء قيد جديد
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Wallet Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المحفظة
                </label>
                <select
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">اختر المحفظة</option>
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} ({wallet.currency})
                      {wallet.account && ` - ${wallet.account.name}`}
                    </option>
                  ))}
                </select>
                {currentWalletBalance !== null && (
                  <div className="text-sm text-gray-600 mt-1">
                    الرصيد الحالي: {currentWalletBalance.toFixed(3)} جرام
                  </div>
                )}
              </div>

              {/* Adjustment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع التعديل
                </label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value as 'INCREASE' | 'DECREASE')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="INCREASE">زيادة الرصيد</option>
                  <option value="DECREASE">نقص الرصيد</option>
                </select>
              </div>

              {/* Currency Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع العملة
                </label>
                <select
                  value={currencyType}
                  onChange={(e) => setCurrencyType(e.target.value as 'GOLD' | 'MONEY')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GOLD">ذهب</option>
                  <option value="MONEY">نقود</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الكمية ({currencyType === 'GOLD' ? 'جرام' : 'وحدة نقدية'})
                </label>
                <input
                  type="number"
                  step={currencyType === 'GOLD' ? '0.001' : '0.01'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={currencyType === 'GOLD' ? '0.000' : '0.00'}
                />
              </div>

              {/* Local flag */}
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <input
                  type="checkbox"
                  id="isLocalModal"
                  checked={isLocal}
                  onChange={e => setIsLocal(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isLocalModal" className="text-sm font-medium text-gray-700">
                  سبيكة بلدي
                </label>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وصف القيد
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="اكتب وصف للقيد..."
                />
              </div>

              {/* Reference ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم المرجع (اختياري)
                </label>
                <input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="رقم المرجع"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedWallet || !amount || !description}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium"
              >
                {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء القيد'}
              </button>
            </div>
          </div>

          {/* Journal Entries Table */}
          {isAuthenticated && (
            <div className="bg-white rounded-lg border">
              <div className="bg-gray-100 px-4 py-3 border-b">
                <h3 className="text-lg font-semibold" style={{ fontFamily: 'Alexandria, sans-serif' }}>
                  سجل القيود
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">التاريخ</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المحفظة</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">نوع التعديل</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">نوع العملة</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الكمية</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الوصف</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">بلدي</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المستخدم</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المرجع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          جاري التحميل...
                        </td>
                      </tr>
                    ) : journalEntries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          لا توجد قيود مسجلة
                        </td>
                      </tr>
                    ) : (
                      journalEntries.map((entry) => (
                        <tr key={entry.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            {new Date(entry.createdAt).toLocaleString('ar-EG')}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {entry.wallet?.name || 'غير معروف'}
                            {entry.wallet?.account && (
                              <div className="text-xs text-gray-500">
                                {entry.wallet.account.name}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${entry.adjustmentType === 'INCREASE'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                              }`}>
                              {entry.adjustmentType === 'INCREASE' ? 'زيادة' : 'نقص'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${entry.currencyType === 'GOLD'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                              }`}>
                              {entry.currencyType === 'GOLD' ? 'ذهب' : 'نقود'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">
                            {formatAmount(entry.amount, entry.currencyType)}
                          </td>
                          <td className="px-4 py-3 text-sm">{entry.description}</td>
                          <td className="px-4 py-3 text-sm text-center">{entry.isLocal ? 'نعم' : 'لا'}</td>
                          <td className="px-4 py-3 text-sm">
                            {entry.user
                              ? `${entry.user.firstName} ${entry.user.lastName}`
                              : entry.createdBy
                            }
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {entry.referenceId || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: 'Alexandria, sans-serif' }}>
                كلمة مرور سند القيد
              </h3>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل كلمة المرور"
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
              <div className="flex justify-end space-x-3 space-x-reverse">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  تأكيد
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}