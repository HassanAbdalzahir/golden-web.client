import { useState, useEffect } from 'react';
import { apiClient, Payment, StatementType } from '../lib/api';

interface LocalBullionScreenProps {
  onBack: () => void;
}

export default function LocalBullionScreen({ onBack }: LocalBullionScreenProps) {
  const [vaultTransactions, setVaultTransactions] = useState<Payment[]>([]);
  const [statementTypes, setStatementTypes] = useState<StatementType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVaultData();
  }, []);

  const loadVaultData = async () => {
    try {
      setLoading(true);
      const [paymentsResponse, statementTypesResponse] = await Promise.all([
        apiClient.getAllPayments(),
        apiClient.getStatementTypes()
      ]);
      setVaultTransactions(paymentsResponse.data);
      setStatementTypes(statementTypesResponse.data);
    } catch (error) {
      console.error('Failed to load vault data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amountMg: string | number) => {
    const mg = typeof amountMg === 'string' ? parseInt(amountMg) : amountMg;
    return (mg / 1000).toFixed(3); // Convert mg to grams
  };

  const getStatementType = (statementTypeId?: string) => {
    if (!statementTypeId) return null;
    return statementTypes.find(type => type.id === statementTypeId);
  };

  const isBtcTransaction = (transaction: Payment) => {
    const statementType = getStatementType(transaction.statementTypeId);
    return statementType?.isBtc || false;
  };

  const formatAmountDisplay = (transaction: Payment) => {
    const mg = typeof transaction.amountMg === 'string' ? parseInt(transaction.amountMg) : transaction.amountMg;

    if (isBtcTransaction(transaction)) {
      return `${(mg / 1000).toFixed(0)} قطعة`;
    } else {
      return `${(mg / 1000).toFixed(3)} جرام`;
    }
  };

  // Filter statement types to only those marked as local
  const localTypes = statementTypes.filter(t => t.isLocal);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with Back Button */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center">
        <button
          onClick={onBack}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm ml-4"
        >
          ← رجوع
        </button>
        <h1 className="text-2xl font-bold text-gray-800">منصرف السبائك</h1>
      </div>

      {/* Vault Content */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">البيان</h2>

        {loading ? (
          <div className="text-center py-8">
            <p>جاري التحميل...</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 relative">
            <div className="overflow-auto h-full">
              <div className="h-full relative shadow-lg border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm border-collapse h-full">
                  <thead className="bg-gradient-to-b from-blue-100 to-blue-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50">البيان</th>
                      <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50">العيار</th>
                      <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50">وزن القطعة</th>
                      <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50">الكمية بالخزنة</th>
                    </tr>
                  </thead>
                  <tbody>
                {localTypes.map((type, index) => {
                  const typeTransactions = vaultTransactions.filter(t => t.statementTypeId === type.id && t.status === 'COMPLETED');

                  const netMg = typeTransactions.reduce((sum, t) => {
                    const amount = typeof t.amountMg === 'string' ? parseInt(t.amountMg) : t.amountMg;
                    return sum + (t.paymentType === 'DEPOSIT' ? amount : -amount);
                  }, 0);

                  const netGrams = netMg / 1000;

                  return (
                    <tr key={type.id} className="hover:bg-blue-50">
                      <td className="px-2 py-3 text-right border border-gray-300 font-medium">{type.name}</td>
                      <td className="px-2 py-3 text-right border border-gray-300">{type.purity || '-'}</td>
                      <td className="px-2 py-3 text-right border border-gray-300 text-gray-600">{type.isBtc && type.weight ? `${type.weight} جرام` : '-'}</td>
                      <td className="px-2 py-3 text-right border border-gray-300 font-mono text-blue-700 font-bold">
                        {type.isBtc ? (
                          `${(type.weight && type.weight > 0 ? netGrams / type.weight : 0).toFixed(0)} قطعة`
                        ) : (
                          `${netGrams.toFixed(3)} جرام`
                        )}
                      </td>
                    </tr>
                  );
                })}
                {localTypes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-8 text-center text-gray-500 border border-gray-300">لا توجد بيانات</td>
                  </tr>
                )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Summary Section */}
        {vaultTransactions.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-800 mb-2">إجمالي الإيداعات</h3>
              <div className="space-y-1">
                <p className="text-lg font-bold text-green-600">
                  ذهب: {(vaultTransactions
                    .filter(t => t.paymentType === 'DEPOSIT' && t.status === 'COMPLETED' && !isBtcTransaction(t))
                    .reduce((sum, t) => sum + parseInt(t.amountMg.toString()), 0) / 1000).toFixed(3)} جرام
                </p>
                <p className="text-lg font-bold text-green-600">
                  BTC: {vaultTransactions
                    .filter(t => t.paymentType === 'DEPOSIT' && t.status === 'COMPLETED' && isBtcTransaction(t))
                    .reduce((sum, t) => {
                      const st = getStatementType(t.statementTypeId);
                      const grams = parseInt(t.amountMg.toString()) / 1000;
                      return sum + ((st && st.weight) ? grams / st.weight : 0);
                    }, 0).toFixed(0)} قطعة
                </p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-800 mb-2">إجمالي السحوبات</h3>
              <div className="space-y-1">
                <p className="text-lg font-bold text-red-600">
                  ذهب: {(vaultTransactions
                    .filter(t => t.paymentType === 'WITHDRAWAL' && t.status === 'COMPLETED' && !isBtcTransaction(t))
                    .reduce((sum, t) => sum + parseInt(t.amountMg.toString()), 0) / 1000).toFixed(3)} جرام
                </p>
                <p className="text-lg font-bold text-red-600">
                  BTC: {vaultTransactions
                    .filter(t => t.paymentType === 'WITHDRAWAL' && t.status === 'COMPLETED' && isBtcTransaction(t))
                    .reduce((sum, t) => {
                      const st = getStatementType(t.statementTypeId);
                      const grams = parseInt(t.amountMg.toString()) / 1000;
                      return sum + ((st && st.weight) ? grams / st.weight : 0);
                    }, 0).toFixed(0)} قطعة
                </p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">الرصيد الصافي</h3>
              <div className="space-y-1">
                <p className="text-lg font-bold text-blue-600">
                  ذهب: {(vaultTransactions
                    .filter(t => t.status === 'COMPLETED' && !isBtcTransaction(t))
                    .reduce((sum, t) => {
                      return sum + (t.paymentType === 'DEPOSIT' ? 1 : -1) * parseInt(t.amountMg.toString());
                    }, 0) / 1000).toFixed(3)} جرام
                </p>
                <p className="text-lg font-bold text-blue-600">
                  BTC: {vaultTransactions
                    .filter(t => t.status === 'COMPLETED' && isBtcTransaction(t))
                    .reduce((sum, t) => {
                      const st = getStatementType(t.statementTypeId);
                      const grams = parseInt(t.amountMg.toString()) / 1000;
                      const units = (st && st.weight) ? grams / st.weight : 0;
                      return sum + (t.paymentType === 'DEPOSIT' ? 1 : -1) * units;
                    }, 0).toFixed(0)} قطعة
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
