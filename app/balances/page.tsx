'use client';

import { useState, useEffect } from 'react';
import { apiClient, Wallet } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ToastContainer';

interface WalletGroup {
  accountId: string;
  accountName: string;
  goldBalance: number;   // grams
  moneyBalance: number;  // units
}

export default function BalancesPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [groups, setGroups] = useState<WalletGroup[]>([]);
  const [filter, setFilter] = useState('');

  const { addToast, toasts, removeToast } = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWallets();
  }, []);

  useEffect(() => {
    // recalc groups whenever wallets change
    const map = new Map<string, WalletGroup>();
    wallets.forEach(w => {
      const accountId = w.account?.id || '';
      const accountName = w.account?.name || '-';
      if (!map.has(accountId)) {
        map.set(accountId, {
          accountId,
          accountName,
          goldBalance: 0,
          moneyBalance: 0,
        });
      }
      const grp = map.get(accountId)!;
      if (w.currency === 'GOLD' || w.currency === 'XAU') {
        grp.goldBalance += w.balanceGrams ?? 0;
      } else {
        grp.moneyBalance += w.balanceMg ? parseFloat(w.balanceMg) / 100 : 0;
      }
    });
    setGroups(Array.from(map.values()));
  }, [wallets]);

  const loadWallets = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getWallets();
      setWallets(res.data);
    } catch (error) {
      addToast('خطأ في تحميل الأرصدة', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (amount: number, currency: 'GOLD' | 'MONEY') => {
    if (currency === 'GOLD') {
      return amount.toFixed(3) + ' جرام';
    }
    return amount.toFixed(2) + ' وحدة';
  };

  const walletOwner = (grp: WalletGroup) => {
    return grp.accountName;
  };

  const displayed = groups.filter(g =>
    g.accountName.toLowerCase().includes(filter.toLowerCase()) ||
    g.accountId.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 text-right" dir="rtl" style={{ fontFamily: 'Alexandria, sans-serif' }}>
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      <header className="bg-blue-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">أرصدة المحافظ</h1>
          <div className="flex gap-2">
            <button onClick={() => window.history.back()} className="bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded-lg transition-colors">
              رجوع
            </button>
            <button onClick={loadWallets} className="bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded-lg transition-colors">
              تحديث
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading && <div className="text-center text-gray-600 mb-4">جاري التحميل...</div>}

        <div className="mb-4">
          <input
            type="text"
            placeholder="ابحث عن عميل أو رمز"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full md:w-1/3 border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border">العميل</th>
                <th className="px-4 py-2 border">رصيد ذهب</th>
                <th className="px-4 py-2 border">رصيد نقدي</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((g) => (
                <tr key={g.accountId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border text-sm">{walletOwner(g)}</td>
                  <td
                    className={`px-4 py-2 border text-sm ${
                      g.goldBalance < 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {formatBalance(g.goldBalance, 'GOLD')}
                  </td>
                  <td
                    className={`px-4 py-2 border text-sm ${
                      g.moneyBalance < 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {formatBalance(g.moneyBalance, 'MONEY')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
