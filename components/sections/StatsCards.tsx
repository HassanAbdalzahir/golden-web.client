import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';

interface StatsCardsProps {
  totalGold: number;
  fromDate: string;
  toDate: string;
}

interface SystemStats {
  totalGoldInVault: number;     // Card 1: Total gold weight in vault
  totalMoneyInVault: number;    // Card 2: Total money in vault
  goldMovementDiff: number;     // Card 3: Gold in - Gold out difference
  availableGold: number;        // Card 4: Gold in vault - gold owed to clients
}

export default function StatsCards({ totalGold, fromDate, toDate }: StatsCardsProps) {
  const [stats, setStats] = useState<SystemStats>({
    totalGoldInVault: 0,
    totalMoneyInVault: 0, 
    goldMovementDiff: 0,
    availableGold: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (fromDate && toDate) {
      calculateSystemStats();
    }
  }, [fromDate, toDate]);

  const calculateSystemStats = async () => {
    try {
      setLoading(true);
      
      // Parse date range
      const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
      const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
      const fromDateObj = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
      const toDateObj = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

      // Get all payments (vault transactions) and wallets
      const [paymentsResponse, walletsResponse, statementTypesResponse] = await Promise.all([
        apiClient.getAllPayments(),
        apiClient.getWallets(),
        apiClient.getStatementTypes()
      ]);
      
      const payments = Array.isArray(paymentsResponse.data) ? paymentsResponse.data : [];
      const wallets = Array.isArray(walletsResponse.data) ? walletsResponse.data : [];
      const statementTypes = Array.isArray(statementTypesResponse.data) ? statementTypesResponse.data : [];
      
      // Card 1: Calculate physical gold in vault (from vault payments/statement types)
      // This matches the Gold Vault Screen calculation
      let totalGoldInVault = 0;
      const completedPayments = payments.filter((p: any) => p.status === 'COMPLETED');
      
      statementTypes.forEach((type: any) => {
        const typeTransactions = completedPayments.filter((t: any) => t.statementTypeId === type.id);
        
        // Calculate net balance for this statement type
        const netMg = typeTransactions.reduce((sum: number, t: any) => {
          const amount = typeof t.amountMg === 'string' ? parseInt(t.amountMg) : t.amountMg;
          return sum + (t.paymentType === 'DEPOSIT' ? amount : -amount);
        }, 0);
        
        // Include in gold total if:
        // 1. Not BTC type (isBtc: false), OR
        // 2. BTC type BUT has purity (meaning it's physical gold bars/bullion tracked by pieces)
        const isPhysicalGold = !type.isBtc || (type.isBtc && type.purity != null);
        
        if (isPhysicalGold) {
          totalGoldInVault += netMg / 1000; // Convert mg to grams
        }
      });
      
      // Card 2: Total money in all wallets
      let totalMoneyInVault = 0;
      wallets.forEach((wallet: any) => {
        const isMoneyWallet = wallet.currency !== 'GOLD' && wallet.currency !== 'XAU';
        if (isMoneyWallet) {
          const walletBalance = parseFloat(wallet.balanceMg || '0');
          totalMoneyInVault += walletBalance / 100; // Convert from cents
        }
      });
      
      // Card 3: Gold movement (وارد ذهب - منصرف ذهب) in date range
      let goldIn = 0;
      let goldOut = 0;
      
      completedPayments.forEach((payment: any) => {
        const paymentDate = new Date(payment.createdAt);
        if (paymentDate >= fromDateObj && paymentDate <= toDateObj) {
          const statementType = statementTypes.find((st: any) => st.id === payment.statementTypeId);
          
          // Only count non-BTC transactions
          if (!statementType?.isBtc) {
            const amountGrams = (typeof payment.amountMg === 'string' ? parseInt(payment.amountMg) : payment.amountMg) / 1000;
            
            if (payment.paymentType === 'DEPOSIT') {
              goldIn += amountGrams;
            } else if (payment.paymentType === 'WITHDRAWAL') {
              goldOut += amountGrams;
            }
          }
        }
      });
      
      const goldMovementDiff = goldIn - goldOut;
      
      // Card 4: Available gold (vault gold - gold owed to clients)
      let clientGoldBalance = 0;
      wallets.forEach((wallet: any) => {
        const isGoldWallet = wallet.currency === 'GOLD' || wallet.currency === 'XAU';
        if (isGoldWallet && wallet.account && !wallet.account.isSystem) {
          const balanceGrams = parseFloat(wallet.balanceMg || '0') / 1000;
          if (balanceGrams > 0) {
            clientGoldBalance += balanceGrams;
          }
        }
      });
      
      const availableGold = totalGoldInVault - clientGoldBalance;

      setStats({
        totalGoldInVault,       // Card 1: Physical gold in vault (matches Gold Vault screen)
        totalMoneyInVault,      // Card 2: Total money in wallets
        goldMovementDiff,       // Card 3: Net gold movement (وارد - منصرف)
        availableGold           // Card 4: Available gold after client obligations
      });
      
    } catch (error) {
      console.error('Error calculating system stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getValueColor = (value: number) => {
    if (value > 0) return 'text-blue-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-lg p-4 text-center border border-gray-300 shadow-sm">
            <div className="text-sm text-gray-400 mb-1">جاري التحميل...</div>
            <div className="text-xl font-bold text-gray-400">---</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {/* Card 1: Total Gold in Vault */}
      <div className="bg-white rounded-lg p-4 text-center border border-gray-300 shadow-sm">
        <div className="text-sm text-black mb-1">ذهب الخزنة</div>
        <div className={`text-xl font-bold ${getValueColor(stats.totalGoldInVault)}`}>
          {stats.totalGoldInVault.toFixed(3)}g
        </div>
        <div className="text-xs text-gray-500">إجمالي الوزن</div>
      </div>

      {/* Card 2: Total Money in Vault */}
      <div className="bg-white rounded-lg p-4 text-center border border-gray-300 shadow-sm">
        <div className="text-sm text-black mb-1">نقدية الخزنة</div>
        <div className={`text-xl font-bold ${getValueColor(stats.totalMoneyInVault)}`}>
          {stats.totalMoneyInVault.toLocaleString()}
        </div>
        <div className="text-xs text-gray-500">إجمالي النقدية</div>
      </div>

      {/* Card 3: Gold Movement Difference */}
      <div className="bg-white rounded-lg p-4 text-center border border-gray-300 shadow-sm">
        <div className="text-sm text-black mb-1">حركة الذهب</div>
        <div className={`text-xl font-bold ${getValueColor(stats.goldMovementDiff)}`}>
          {stats.goldMovementDiff > 0 ? '+' : ''}{stats.goldMovementDiff.toFixed(3)}g
        </div>
        <div className="text-xs text-gray-500">وارد - منصرف</div>
      </div>

      {/* Card 4: Gold owed / in vault (display) */}
      <div className="bg-white rounded-lg p-4 text-center border border-gray-300 shadow-sm">
        <div className="text-sm text-black mb-1">بالنقد</div>
        <div className={`text-xl font-bold ${getValueColor(stats.availableGold)}`}>
          {stats.availableGold.toFixed(3)}g
        </div>
        <div className="text-xs text-gray-500">ذهب في الخزنة - المستحق للعملاء</div>
      </div>
    </div>
  );
}