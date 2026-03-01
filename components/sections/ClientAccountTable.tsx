import { useEffect, useState } from 'react';
import { Wallet, apiClient } from '../../lib/api';
import { ClientBalanceCalculator, ClientBalance, TransactionForBalance } from '../../lib/balanceCalculator';

interface ClientAccountTableProps {
  wallets: Wallet[];
  selectedClient: string;
  todayPrice: string;
  transactions: TransactionForBalance[]; // Expecting unified ledger transactions
  systemUserId?: string | null;
  onDataChange?: () => void;
  onInvoiceView?: (invoiceData: any) => void;
  onDeleteTransaction?: (deletedTransaction: any) => void;
  onEditJournalEntry?: (id: string, newAmount: number, newDescription: string, isGold: boolean, adjustmentType: 'INCREASE' | 'DECREASE') => Promise<void>;
  onDeleteJournalEntry?: (id: string) => Promise<void>;
}

interface ProcessedRow extends TransactionForBalance {
  goldBalance: number;
  cashBalance: number;
  goldCredit: number;
  goldDebit: number;
  cashCredit: number;
  cashDebit: number;
}

export default function ClientAccountTable({
  wallets,
  selectedClient,
  todayPrice,
  transactions = [],
  onInvoiceView,
  onDeleteTransaction,
  onEditJournalEntry,
  onDeleteJournalEntry
}: ClientAccountTableProps) {

  const [rows, setRows] = useState<ProcessedRow[]>([]);
  const [currentBalance, setCurrentBalance] = useState<ClientBalance | null>(null);

  // Edit Journal Entry State
  const [editingEntry, setEditingEntry] = useState<ProcessedRow | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAdjustmentType, setEditAdjustmentType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [isEditingSubmit, setIsEditingSubmit] = useState(false);

  // Inject Excel-like styles
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const styleId = 'client-excel-table-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .excel-table {
            font-family: 'Segoe UI', 'Arial', sans-serif;
            border-spacing: 0;
            border-collapse: separate;
          }
          .excel-table td {
            border: 1px solid #d1d5db;
            padding: 8px 6px;
          }
          .excel-table tbody tr:nth-child(even) { background-color: #f8fafc; }
          .excel-table tbody tr:hover { background-color: #e0f2fe; }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  // Process Transactions and Calculate Running Balances
  useEffect(() => {
    if (!transactions || transactions.length === 0) {
      setRows([]);
      setCurrentBalance(null);
      return;
    }

    // 1. Sort Chronologically (Oldest First) for calculation
    const chronological = [...transactions].sort((a, b) =>
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    let runningGold = 0;
    let runningCash = 0;

    // 2. Calculate Running Balances
    const processed = chronological.map(tx => {
      let goldCredit = 0;
      let goldDebit = 0;
      let cashCredit = 0;
      let cashDebit = 0;

      // Logic must match ClientBalanceCalculator for consistency
      // Note: amountGrams and amountCash in TransactionForBalance are ABSOLUTE values.
      const grams = tx.amountGrams || 0;
      const cash = tx.amountCash || 0;

      switch (tx.type) {
        case 'بيع': // System Sells to Client: Client Gets Gold (Credit), Client Owes Cash (Debit)
          goldCredit = grams;
          if (cash > 0) {
            cashDebit = cash;
          } else {
            // Infer Cash Value for Gold Transaction (match Calculator logic)
            const price = parseFloat(tx.price || '0');
            if (price > 0 && grams > 0) {
              cashDebit = grams * price;
            }
          }
          break;

        case 'شراء': // System Buys from Client: Client Gives Gold (Debit), Client Gets Cash (Credit)
          goldDebit = grams;
          if (cash > 0) {
            cashCredit = cash;
          } else {
            // Infer Cash Value for Gold Transaction (match Calculator logic)
            const price = parseFloat(tx.price || '0');
            if (price > 0 && grams > 0) {
              cashCredit = grams * price;
            }
          }
          break;

        case 'وارد ذهب': // Deposit Gold
          goldCredit = grams;
          break;

        case 'منصرف ذهب': // Withdraw Gold
          goldDebit = grams;
          break;

        case 'وارد نقدية': // Deposit Cash
          cashCredit = cash;
          break;

        case 'منصرف نقدية': // Withdraw Cash
          cashDebit = cash;
          break;

        default:
          // Fallback based on implied type?
          break;
      }

      runningGold += (goldCredit - goldDebit);
      runningCash += (cashCredit - cashDebit);

      return {
        ...tx,
        goldCredit,
        goldDebit,
        cashCredit,
        cashDebit,
        goldBalance: runningGold,
        cashBalance: runningCash
      };
    });

    // 3. Update Current Balance (Final State)
    setCurrentBalance({
      goldCredit: 0, // Not tracked cumulatively here, just Net
      goldDebt: 0,
      cashCredit: 0,
      cashDebt: 0,
      netGold: runningGold,
      netCash: runningCash
    });

    // 4. Reverse for Display (Newest First)
    setRows(processed.reverse());

  }, [transactions]);


  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (tx: TransactionForBalance) => {
    if (confirm('هل أنت متأكد من حذف هذا القيد؟')) {
      if ((tx as any).referenceType === 'JOURNAL_ENTRY' && onDeleteJournalEntry) {
        setIsDeleting(tx.id);
        try {
          await onDeleteJournalEntry(tx.id);
        } catch (error) {
          console.error(error);
        } finally {
          setIsDeleting(null);
        }
      } else if (onDeleteTransaction) {
        onDeleteTransaction({
          ...tx,
          deletedAt: new Date().toISOString(),
          deletionReason: 'User deleted from table'
        });
      }
    }
  };

  const openEditModal = (row: ProcessedRow) => {
    setEditingEntry(row);
    const isGold = row.amountGrams !== undefined && row.amountGrams > 0;
    const amount = isGold ? row.amountGrams : row.amountCash;
    setEditAmount(amount?.toString() || '0');
    setEditDescription(row.description || '');

    // Determine adjustment type
    // If it was a credit, then it was DEPOSIT / INCREASE, if debit then WITHDRAWAL / DECREASE
    const isCredit = row.goldCredit > 0 || row.cashCredit > 0;
    setEditAdjustmentType(isCredit ? 'INCREASE' : 'DECREASE');
  };

  const handleEditSubmit = async () => {
    if (!editingEntry || !onEditJournalEntry) return;
    setIsEditingSubmit(true);

    try {
      const isGold = editingEntry.amountGrams !== undefined && editingEntry.amountGrams > 0;
      await onEditJournalEntry(
        editingEntry.id,
        parseFloat(editAmount),
        editDescription,
        isGold,
        editAdjustmentType
      );
      setEditingEntry(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsEditingSubmit(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-full overflow-hidden">

      {/* Header & Balance Summary */}
      <div className="p-3 border-b bg-gray-50 rounded-t-lg flex-shrink-0">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-700">حساب العميل (سجل المعاملات)</h3>
          {currentBalance && (
            <div className="flex gap-4 text-sm font-mono">
              <span className={currentBalance.netGold >= 0 ? 'text-green-700' : 'text-red-700'}>
                ذهب: {currentBalance.netGold.toFixed(3)}g
              </span>
              <span className={currentBalance.netCash >= 0 ? 'text-green-700' : 'text-red-700'}>
                نقدية: {currentBalance.netCash.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="relative shadow-lg border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs border-collapse excel-table text-center">
            <thead className="bg-gradient-to-b from-blue-100 to-blue-200 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700">الكود</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700 bg-yellow-50">رصيد الذهب</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700 bg-green-50">رصيد النقدية</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700">الحركة</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700">التاريخ</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700">ذهب له</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700">ذهب عليه</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700">نقدي له</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700">نقدية عليه</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700">سعر</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700">ملاحظات</th>
                <th className="px-2 py-3 border border-gray-300 font-semibold text-gray-700">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={12} className="py-8 text-gray-500">لا توجد حركات</td></tr>
              ) : (
                rows.map((row) => {
                  // Extract Invoice ID if present
                  const invoiceIdMatch = row.description?.match(/(?:فاتورة|Invoice)[:\s]+(INV-[\w-]+)/i);
                  const isInvoice = !!invoiceIdMatch;

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${isInvoice ? 'cursor-pointer hover:bg-blue-100' : 'hover:bg-blue-50'}`}
                      onClick={() => {
                        if (isInvoice && onInvoiceView) {
                          const invoiceId = invoiceIdMatch![1];
                          // Find all related transactions for this invoice
                          const relatedRows = transactions.filter(t => t.description?.includes(invoiceId));
                          const sourceRows = relatedRows.length > 0 ? relatedRows : [row];

                          // Adapt for viewer which expects payment object
                          const adaptedItems = sourceRows.map(r => ({
                            ...r,
                            payment: {
                              id: r.id,
                              description: r.description || '',
                              createdAt: r.createdAt
                            }
                          }));

                          // Calculate totals from all parts
                          const totalGold = sourceRows.reduce((sum, t) => sum + (t.amountGrams || 0), 0);
                          const totalCash = sourceRows.reduce((sum, t) => sum + (t.amountCash || 0), 0);

                          onInvoiceView({
                            id: invoiceId,
                            isInvoice: true,
                            invoiceItems: adaptedItems,
                            amountGrams: totalGold,
                            amountCash: totalCash,
                            type: row.type,
                            createdAt: row.createdAt
                          });
                        }
                      }}
                    >
                      <td className="px-2 py-2 font-mono">
                        {isInvoice && <span className="text-blue-500 mr-1">📄</span>}
                        {row.id.slice(-8)}
                      </td>

                      {/* Running Balances */}
                      <td className="px-2 py-2 font-bold bg-yellow-50 text-yellow-800 dir-ltr">
                        {row.goldBalance.toFixed(3)}g
                      </td>
                      <td className="px-2 py-2 font-bold bg-green-50 text-green-800 dir-ltr">
                        {row.cashBalance.toFixed(2)}
                      </td>

                      <td className="px-2 py-2 font-medium">
                        {(row as any).referenceType === 'JOURNAL_ENTRY' ? 'سند قيد' : row.type}
                      </td>
                      <td className="px-2 py-2 dir-ltr">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString('ar-EG') : '-'}
                      </td>

                      {/* Transaction Amounts */}
                      <td className="px-2 py-2 text-green-600 font-semibold">
                        {row.goldCredit > 0 ? row.goldCredit.toFixed(3) : ''}
                      </td>
                      <td className="px-2 py-2 text-red-600 font-semibold">
                        {row.goldDebit > 0 ? row.goldDebit.toFixed(3) : ''}
                      </td>
                      <td className="px-2 py-2 text-green-600 font-semibold">
                        {row.cashCredit > 0 ? row.cashCredit.toFixed(2) : ''}
                      </td>
                      <td className="px-2 py-2 text-red-600 font-semibold">
                        {row.cashDebit > 0 ? row.cashDebit.toFixed(2) : ''}
                      </td>

                      <td className="px-2 py-2 font-mono">
                        {row.price || todayPrice}
                      </td>

                      <td className="px-2 py-2 text-right max-w-xs truncate" title={row.description}>
                        {row.description}
                      </td>

                      <td className="px-2 py-2 flex justify-center gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                        {(row as any).referenceType === 'JOURNAL_ENTRY' && onEditJournalEntry && (
                          <button
                            onClick={() => openEditModal(row)}
                            className="text-blue-500 hover:text-blue-700"
                            title="تعديل"
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={isDeleting === row.id}
                          className={`text-red-500 hover:text-red-700 ${isDeleting === row.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="حذف"
                        >
                          {isDeleting === row.id ? '⏳' : '🗑️'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Journal Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 transform transition-all text-right" dir="rtl">
            <h3 className="font-bold text-lg mb-4 text-gray-800">تعديل سند قيد</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع العملية</label>
                <select
                  value={editAdjustmentType}
                  onChange={e => setEditAdjustmentType(e.target.value as 'INCREASE' | 'DECREASE')}
                  className="w-full border p-2 rounded focus:ring-blue-500 outline-none"
                >
                  <option value="INCREASE">إضافة رصيد (له)</option>
                  <option value="DECREASE">خصم رصيد (عليه)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الكمية {(editingEntry.amountGrams !== undefined && editingEntry.amountGrams > 0) ? '(جرام)' : '(مبلغ)'}
                </label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full border p-2 rounded focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className="w-full border p-2 rounded focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-4 py-2 border rounded hover:bg-gray-50 text-gray-600"
              >
                إلغاء
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={isEditingSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isEditingSubmit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}