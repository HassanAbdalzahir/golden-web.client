'use client';

import React, { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { useStatementTypes } from '../../hooks/useStatementTypes';

interface TransactionRow {
  id: string;
  barcode: string;
  description: string;
  statementTypeId?: string;
  weight: string;
  units?: string; // عدد الوحدات for BTC transactions
  purity: string;
  fee: string;
  feeType: string;
  net21: string;
  value: string;
  notes: string;
  deleted?: boolean; // Soft deletion flag
  deletedAt?: string; // Deletion timestamp
  deletedBy?: string; // User who deleted it
  deletionReason?: string; // Reason for deletion
}

interface TransactionsTableProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  todayPrice: string;
  selectedClient: string;
  transactions: any[];
  onSaveAll?: (transactions: any[]) => void;
  onDeleteTransaction?: (transactionId: string, reason?: string) => void;
  showSuccess?: (message: string, duration?: number) => void;
  showError?: (message: string, duration?: number) => void;
  showWarning?: (message: string, duration?: number) => void;
  // Invoice viewing props
  isViewingInvoice?: boolean;
  invoiceData?: any;
  onExitInvoiceView?: () => void;
  onSaveInvoiceChanges?: (invoiceId: string, changes: any[]) => void;
  onDeleteInvoiceTransaction?: (transactionId: string, reason?: string) => void;
  onDeleteInvoice?: (invoiceId: string, reason?: string) => void;
}

export default function TransactionsTable({
  activeTab,
  setActiveTab,
  todayPrice,
  selectedClient,
  transactions = [],
  onSaveAll,
  onDeleteTransaction,
  showSuccess,
  showError,
  showWarning,
  isViewingInvoice = false,
  invoiceData = null,
  onExitInvoiceView,
  onSaveInvoiceChanges,
  onDeleteInvoiceTransaction,
  onDeleteInvoice
}: TransactionsTableProps) {
  const { statementTypes, loading: statementTypesLoading } = useStatementTypes();
  const tabs = ['وارد ذهب', 'منصرف ذهب', 'بيع', 'شراء', 'منصرف نقدية', 'وارد نقدية'];

  // Add Excel-like styles
  const excelStyles = `
    .excel-table {
      font-family: 'Segoe UI', 'Arial', sans-serif;
      border-spacing: 0;
      border-collapse: separate;
    }
    .excel-table td {
      position: relative;
    }
    .excel-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .excel-table tr:nth-child(odd) {
      background-color: #ffffff;
    }
    .excel-table tr:hover {
      background-color: #e0f2fe !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .excel-table input:focus,
    .excel-table select:focus {
      z-index: 10;
      position: relative;
      box-shadow: 0 0 0 2px #3b82f6, 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .excel-table td:has(input:focus),
    .excel-table td:has(select:focus) {
      background-color: #fef3c7 !important;
      box-shadow: inset 0 0 0 2px #3b82f6;
    }
  `;

  // Inject styles
  if (typeof document !== 'undefined') {
    const styleId = 'excel-table-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = excelStyles;
      document.head.appendChild(style);
    }
  }

  // Helper function to create initial row
  const createInitialRow = (tab: string, price: string) => {
    if (tab === 'وارد ذهب' || tab === 'منصرف ذهب') {
      return {
        id: Date.now().toString(),
        barcode: '',
        description: '',
        statementTypeId: '',
        weight: '',
        units: '',
        purity: '21',
        fee: '',
        feeType: 'نقدي',
        net21: '',
        value: '',
        notes: ''
      };
    } else if (tab === 'بيع' || tab === 'شراء') {
      return {
        id: Date.now().toString(),
        weight: '',
        price: price,
        value: '',
        notes: ''
      };
    } else {
      return {
        id: Date.now().toString(),
        amount: '',
        notes: ''
      };
    }
  };

  // State for multiple transaction rows that user can edit
  const [transactionRows, setTransactionRows] = useState<any[]>([]);
  const [editingRowIndex, setEditingRowIndex] = useState<number>(-1);
  const [inlineEditingRow, setInlineEditingRow] = useState<number>(-1);
  const [inlineEditingField, setInlineEditingField] = useState<string>('');

  // Excel-like cell selection state
  const [selectedCell, setSelectedCell] = useState<{ row: number, col: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [currentTransaction, setCurrentTransaction] = useState(() => createInitialRow(activeTab, todayPrice));
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);
  const tableRef = useRef<HTMLTableElement>(null);

  // Invoice editing state
  const [invoiceEditingRow, setInvoiceEditingRow] = useState<number>(-1);
  const [invoiceEditingField, setInvoiceEditingField] = useState<string>('');
  const [invoiceEditingValue, setInvoiceEditingValue] = useState<string>('');
  const [invoiceChanges, setInvoiceChanges] = useState<any[]>([]);

  // Initialize state based on active tab
  const getInitialRow = useCallback(() => {
    return createInitialRow(activeTab, todayPrice);
  }, [activeTab, todayPrice]);

  const addNewRow = () => {
    if (!selectedClient) {
      if (showWarning) {
        showWarning('يرجى اختيار عميل أولاً');
      }
      return;
    }

    // Validate current transaction before adding
    const isValid = (activeTab === 'وارد ذهب' || activeTab === 'منصرف ذهب')
      ? (() => {
        const selectedType = statementTypes.find(type => type.id === currentTransaction.statementTypeId);
        const isBtc = selectedType?.isBtc || false;
        return currentTransaction.statementTypeId &&
          (isBtc ? currentTransaction.units : currentTransaction.weight);
      })()
      : (activeTab === 'بيع' || activeTab === 'شراء')
        ? currentTransaction.weight
        : currentTransaction.amount;

    if (!isValid) {
      if (showWarning) {
        showWarning('يرجى إكمال البيانات المطلوبة');
      }
      return;
    }

    const newRow = {
      ...currentTransaction,
      id: Date.now() + Math.random(),
      type: activeTab,
      clientId: selectedClient,
      price: todayPrice
    };

    setTransactionRows(prev => [...prev, newRow]);
    setCurrentTransaction(getInitialRow());
    setCurrentRowIndex(0);

    // Focus first input
    setTimeout(() => {
      const firstInput = inputRefs.current[0]?.[0];
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
  };

  const editRow = (index: number) => {
    const rowToEdit = transactionRows[index];
    setCurrentTransaction(rowToEdit);
    setEditingRowIndex(index);
    setCurrentRowIndex(0);

    // Focus first input
    setTimeout(() => {
      const firstInput = inputRefs.current[0]?.[0];
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
  };

  const saveEditedRow = () => {
    if (editingRowIndex === -1) return;

    const updatedRows = [...transactionRows];
    updatedRows[editingRowIndex] = {
      ...currentTransaction,
      type: activeTab,
      clientId: selectedClient,
      price: todayPrice
    };

    setTransactionRows(updatedRows);
    setEditingRowIndex(-1);
    setCurrentTransaction(getInitialRow());
  };

  const deleteTransaction = (transaction: any) => {
    const reason = prompt('اختياري: أدخل سبب الحذف:');

    if (window.confirm(`هل أنت متأكد من حذف هذه المعاملة؟`)) {
      if (onDeleteTransaction) {
        onDeleteTransaction(transaction.id, reason || 'غير محدد');
      }

      if (showSuccess) {
        showSuccess('تم حذف المعاملة بنجاح');
      }
    }
  };

  const deleteRow = (index: number) => {
    setTransactionRows(prev => prev.filter((_, i) => i !== index));
    if (editingRowIndex === index) {
      setEditingRowIndex(-1);
      setCurrentTransaction(getInitialRow());
    }
  };

  const startInlineEdit = (rowIndex: number, field: string) => {
    setInlineEditingRow(rowIndex);
    setInlineEditingField(field);
  };

  const updateInlineEdit = (rowIndex: number, field: string, value: string) => {
    const updatedRows = [...transactionRows];
    updatedRows[rowIndex] = {
      ...updatedRows[rowIndex],
      [field]: value
    };

    // If editing weight or purity for gold transactions, recalculate net21 and value
    if ((field === 'weight' || field === 'purity') && (activeTab === 'وارد ذهب' || activeTab === 'منصرف ذهب')) {
      const weight = parseFloat(field === 'weight' ? value : updatedRows[rowIndex].weight) || 0;
      const purity = parseFloat(field === 'purity' ? value : updatedRows[rowIndex].purity) || 21;
      const net21 = (weight * purity / 21).toFixed(3);
      const calculatedValue = (parseFloat(net21) * parseFloat(todayPrice)).toFixed(0);

      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        net21,
        value: calculatedValue
      };
    }
    // If editing weight or price for buy/sell transactions, recalculate value
    else if ((field === 'weight' || field === 'price') && (activeTab === 'بيع' || activeTab === 'شراء')) {
      const weight = parseFloat(field === 'weight' ? value : updatedRows[rowIndex].weight) || 0;
      const price = parseFloat(field === 'price' ? value : updatedRows[rowIndex].price) || 0;
      const calculatedValue = (weight * price).toFixed(0);

      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        value: calculatedValue
      };
    }

    setTransactionRows(updatedRows);
  };

  const saveInlineEdit = (rowIndex: number, field: string, value: string) => {
    updateInlineEdit(rowIndex, field, value);
    setInlineEditingRow(-1);
    setInlineEditingField('');
  };

  const cancelInlineEdit = () => {
    setInlineEditingRow(-1);
    setInlineEditingField('');
  };

  const startInvoiceEdit = (rowIndex: number, field: string, currentValue: string) => {
    setInvoiceEditingRow(rowIndex);
    setInvoiceEditingField(field);
    setInvoiceEditingValue(currentValue);
  };

  const saveInvoiceEdit = (rowIndex: number, field: string, value: string) => {
    const updatedChanges = [...invoiceChanges];

    // Ensure we have a base object for this row
    if (!updatedChanges[rowIndex]) {
      updatedChanges[rowIndex] = {
        ...invoiceData.invoiceItems[rowIndex],
        rowIndex,
        hasChanges: true
      };
    }

    // Update the specific field
    updatedChanges[rowIndex] = {
      ...updatedChanges[rowIndex],
      [field]: value,
      hasChanges: true
    };

    // For weight changes, recalculate related values
    if (field === 'weight') {
      const weight = parseFloat(value) || 0;
      const caliber = updatedChanges[rowIndex].caliber || '21';
      const net21 = (weight * parseFloat(caliber) / 21).toFixed(3);
      updatedChanges[rowIndex].net21 = net21;
      updatedChanges[rowIndex].amountGrams = weight;
    }

    // For caliber changes, recalculate net21
    if (field === 'caliber') {
      const caliber = parseFloat(value) || 21;
      const weight = updatedChanges[rowIndex].weight || updatedChanges[rowIndex].amountGrams || 0;
      const net21 = (parseFloat(weight.toString()) * caliber / 21).toFixed(3);
      updatedChanges[rowIndex].net21 = net21;
    }

    setInvoiceChanges(updatedChanges);
    setInvoiceEditingRow(-1);
    setInvoiceEditingField('');
    setInvoiceEditingValue('');
  };

  const cancelInvoiceEdit = () => {
    setInvoiceEditingRow(-1);
    setInvoiceEditingField('');
    setInvoiceEditingValue('');
  };

  const saveInvoiceChanges = () => {
    if (onSaveInvoiceChanges && invoiceData) {
      // Filter out empty/null entries and only send actual changes
      const validChanges = invoiceChanges.filter(change => change && change.hasChanges);

      if (validChanges.length === 0) {
        if (showWarning) {
          showWarning('لا توجد تغييرات للحفظ');
        }
        return;
      }

      onSaveInvoiceChanges(invoiceData.id, validChanges);
      setInvoiceChanges([]);

      if (showSuccess) {
        showSuccess(`تم حفظ ${validChanges.length} تعديل بنجاح`);
      }
    }
  };

  const cancelAllInvoiceChanges = () => {
    setInvoiceChanges([]);
    setInvoiceEditingRow(-1);
    setInvoiceEditingField('');
    setInvoiceEditingValue('');
  };

  const saveAllTransactions = async () => {
    if (!selectedClient) {
      if (showWarning) {
        showWarning('يرجى اختيار عميل أولاً');
      }
      return;
    }

    if (transactionRows.length === 0) {
      if (showWarning) {
        showWarning('لا توجد معاملات للحفظ');
      }
      return;
    }

    if (onSaveAll) {
      try {
        await onSaveAll(transactionRows);

        // Clear all rows only after successful save
        setTransactionRows([]);
        setCurrentTransaction(getInitialRow());
        setEditingRowIndex(-1);

        if (showSuccess) {
          showSuccess(`تم حفظ ${transactionRows.length} معاملة بنجاح`);
        }
      } catch (error) {
        // Don't clear rows if save failed
        console.error('Failed to save transactions:', error);
        if (showError) {
          showError('فشل في حفظ المعاملات - يرجى المحاولة مرة أخرى');
        }
      }
    }
  };

  const moveToNextRow = () => {
    const newRowIndex = currentRowIndex + 1;
    setCurrentRowIndex(newRowIndex);
    setCurrentTransaction(getInitialRow());

    // Focus on first input of next row
    setTimeout(() => {
      const firstInput = inputRefs.current[newRowIndex]?.[0];
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
  };

  // Reset everything when tab or client changes
  useEffect(() => {
    setCurrentTransaction(getInitialRow());
    setCurrentRowIndex(0);
    setTransactionRows([]);
    setEditingRowIndex(-1);
    setSelectedCell(null);
    setIsEditing(false);
  }, [activeTab, todayPrice, selectedClient, getInitialRow]);

  // Excel-like navigation handlers
  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
    setIsEditing(false);
  }, []);

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
    setIsEditing(true);
    // Focus the input in the cell
    setTimeout(() => {
      const input = inputRefs.current[row]?.[col];
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }, []);

  const handleKeyNavigation = useCallback((e: KeyboardEvent<HTMLInputElement>, currentRow: number, currentCol: number) => {
    const maxCols = activeTab === 'وارد ذهب' || activeTab === 'منصرف ذهب' ? 8 : activeTab === 'بيع' || activeTab === 'شراء' ? 3 : 1;

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        const nextCol = e.shiftKey ? currentCol - 1 : currentCol + 1;
        if (nextCol >= 0 && nextCol <= maxCols) {
          setSelectedCell({ row: currentRow, col: nextCol });
          const nextInput = inputRefs.current[currentRow]?.[nextCol];
          if (nextInput) {
            nextInput.focus();
          }
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentRow > 0) {
          setSelectedCell({ row: currentRow - 1, col: currentCol });
          const upInput = inputRefs.current[currentRow - 1]?.[currentCol];
          if (upInput) {
            upInput.focus();
          }
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedCell({ row: currentRow + 1, col: currentCol });
        const downInput = inputRefs.current[currentRow + 1]?.[currentCol];
        if (downInput) {
          downInput.focus();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (currentCol > 0) {
          setSelectedCell({ row: currentRow, col: currentCol - 1 });
          const leftInput = inputRefs.current[currentRow]?.[currentCol - 1];
          if (leftInput) {
            leftInput.focus();
          }
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (currentCol < maxCols) {
          setSelectedCell({ row: currentRow, col: currentCol + 1 });
          const rightInput = inputRefs.current[currentRow]?.[currentCol + 1];
          if (rightInput) {
            rightInput.focus();
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isEditing) {
          setIsEditing(false);
        } else {
          setIsEditing(true);
          setTimeout(() => {
            const input = inputRefs.current[currentRow]?.[currentCol];
            if (input) {
              input.select();
            }
          }, 0);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsEditing(false);
        break;
    }
  }, [activeTab, isEditing]);

  // Calculate net21 and value based on transaction inputs
  useEffect(() => {
    if (activeTab === 'وارد ذهب' || activeTab === 'منصرف ذهب') {
      const selectedType = statementTypes.find(type => type.id === currentTransaction.statementTypeId);
      const isBtc = selectedType?.isBtc || false;

      if (isBtc) {
        // For BTC transactions: use units * weight from statement type
        const units = parseFloat(currentTransaction.units ?? '0') || 0;
        const statementWeight = selectedType?.weight || 0;
        const purity = parseFloat(currentTransaction.purity ?? '0') || parseFloat(selectedType?.purity?.toString() || '') || 875;

        if (units > 0 && statementWeight > 0) {
          const totalWeight = units * statementWeight; // Total weight in grams
          let net21 = (totalWeight * purity / 875).toFixed(3); // Use 875 as base reference

          // Handle fee calculation for BTC transactions
          let feeAmount = 0;
          if (currentTransaction.fee && currentTransaction.feeType) {
            const fee = parseFloat(currentTransaction.fee) || 0;
            if (currentTransaction.feeType === 'نقدي') {
              // Fee is in currency - add to transaction value
              feeAmount = fee;
            } else if (currentTransaction.feeType === 'ذهب') {
              // Fee is in gold weight - subtract from net gold
              const feeInGold = (fee * purity / 875); // Convert fee to net21 equivalent
              net21 = (parseFloat(net21) - feeInGold).toFixed(3);
              feeAmount = fee * parseFloat(todayPrice); // Fee value in currency
            }
          }

          const baseValue = (parseFloat(net21) * parseFloat(todayPrice));
          const value = (baseValue + feeAmount).toFixed(0);

          // Only update if values actually changed
          if ((currentTransaction as any).net21 !== net21 || (currentTransaction as any).value !== value) {
            setCurrentTransaction((prev: any) => ({
              ...prev,
              net21,
              value
            }));
          }
        }
      } else {
        // For regular gold transactions: use weight directly with 875 as base
        if (currentTransaction.weight && currentTransaction.purity) {
          const weight = parseFloat(currentTransaction.weight) || 0;
          const purity = parseFloat(currentTransaction.purity) || 21;
          let net21 = (weight * purity / 875).toFixed(3); // Use 875 as base for all calculations

          // Handle fee calculation for regular gold transactions
          let feeAmount = 0;
          if (currentTransaction.fee && currentTransaction.feeType) {
            const fee = parseFloat(currentTransaction.fee) || 0;
            if (currentTransaction.feeType === 'نقدي') {
              // Fee is in currency - add to transaction value
              feeAmount = fee;
            } else if (currentTransaction.feeType === 'ذهب') {
              // Fee is in gold weight - subtract from net gold
              const feeInGold = (fee * purity / 875); // Convert fee to net21 equivalent
              net21 = (parseFloat(net21) - feeInGold).toFixed(3);
              feeAmount = fee * parseFloat(todayPrice); // Fee value in currency
            }
          }

          const baseValue = (parseFloat(net21) * parseFloat(todayPrice));
          const value = (baseValue + feeAmount).toFixed(0);

          // Only update if values actually changed
          if ((currentTransaction as any).net21 !== net21 || (currentTransaction as any).value !== value) {
            setCurrentTransaction((prev: any) => ({
              ...prev,
              net21,
              value
            }));
          }
        }
      }
    } else if ((activeTab === 'بيع' || activeTab === 'شراء') && currentTransaction.weight && (currentTransaction as any).price) {
      const weight = parseFloat(currentTransaction.weight) || 0;
      const price = parseFloat((currentTransaction as any).price) || 0;
      const value = (weight * price).toFixed(0);

      // Only update if value actually changed
      if ((currentTransaction as any).value !== value) {
        setCurrentTransaction((prev: any) => ({
          ...prev,
          value
        }));
      }
    }
  }, [currentTransaction.weight, currentTransaction.units, currentTransaction.purity, currentTransaction.statementTypeId, currentTransaction.price, todayPrice, activeTab, statementTypes]);

  const handleInputChange = (field: string, value: string) => {
    setCurrentTransaction(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, colIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();

      let totalCols = 0;
      if (activeTab === 'وارد ذهب' || activeTab === 'منصرف ذهب') {
        totalCols = 9;
      } else if (activeTab === 'بيع' || activeTab === 'شراء') {
        totalCols = 4;
      } else {
        totalCols = 2;
      }

      if (colIndex < totalCols - 1) {
        // Move to next column
        const nextInput = inputRefs.current[currentRowIndex]?.[colIndex + 1];
        if (nextInput) {
          nextInput.focus();
        }
      } else {
        // From last column: save current row if editing, or add new row
        if (editingRowIndex !== -1) {
          saveEditedRow();
        } else {
          addNewRow();
        }
      }
    }
  };

  const setInputRef = (rowIndex: number, colIndex: number) => (el: HTMLInputElement | HTMLSelectElement | null) => {
    if (!inputRefs.current[rowIndex]) {
      inputRefs.current[rowIndex] = [];
    }
    inputRefs.current[rowIndex][colIndex] = el as HTMLInputElement;
  };

  const renderGoldTable = () => {
    // Check if any statement type is BTC to determine column headers
    const hasBtcStatementType = statementTypes.some(type => type.isBtc);
    const selectedType = statementTypes.find(type => type.id === currentTransaction.statementTypeId);
    const isBtcSelected = selectedType?.isBtc || false;

    return (
      <div className="flex-1 min-h-0 overflow-auto relative shadow-lg border border-gray-200 rounded-lg">
        <table className="w-full text-xs border-collapse excel-table">
          <thead className="bg-gradient-to-b from-blue-100 to-blue-200 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">باركود</th>
              <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">البيان</th>
              <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">
                {isBtcSelected ? 'عدد الوحدات' : 'الوزن'}
              </th>
              <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">العيار</th>
              <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">الاجر</th>
              <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">نوع الاجر</th>
              <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">صافي21</th>
              <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">قيمة</th>
              <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-blue-50 bg-gradient-to-r from-yellow-50 to-yellow-100 transition-all duration-150 border-l-4 border-l-yellow-400">
              <td className={`px-1 py-1 border border-gray-300 hover:bg-blue-50 transition-colors duration-150 ${selectedCell?.row === currentRowIndex && selectedCell?.col === 0 ? 'bg-blue-200 ring-2 ring-blue-400' : ''}`}
                onClick={() => handleCellClick(currentRowIndex, 0)}
                onDoubleClick={() => handleCellDoubleClick(currentRowIndex, 0)}>
                <input
                  ref={setInputRef(currentRowIndex, 0)}
                  type="text"
                  value={currentTransaction.barcode || ''}
                  onChange={(e) => handleInputChange('barcode', e.target.value)}
                  onKeyDown={(e) => handleKeyNavigation(e, currentRowIndex, 0)}
                  disabled={!selectedClient}
                  readOnly={selectedCell?.row === currentRowIndex && selectedCell?.col === 0 && !isEditing}
                  className={`w-full h-8 px-2 border-none outline-none bg-transparent text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded ${selectedCell?.row === currentRowIndex && selectedCell?.col === 0 && !isEditing ? 'cursor-pointer' : ''}`}
                  placeholder={selectedClient ? "" : "اختر عميل"}
                />
              </td>
              <td className={`px-1 py-1 border border-gray-300 hover:bg-blue-50 transition-colors duration-150 ${selectedCell?.row === currentRowIndex && selectedCell?.col === 1 ? 'bg-blue-200 ring-2 ring-blue-400' : ''}`}
                onClick={() => handleCellClick(currentRowIndex, 1)}
                onDoubleClick={() => handleCellDoubleClick(currentRowIndex, 1)}>
                <select
                  ref={setInputRef(currentRowIndex, 1)}
                  value={currentTransaction.statementTypeId || ''}
                  onChange={(e) => {
                    const selectedType = statementTypes.find(type => type.id === e.target.value);
                    handleInputChange('statementTypeId', e.target.value);
                    handleInputChange('description', selectedType?.name || '');
                    // Set placeholders from البيان defaults
                    if (selectedType) {
                      if (selectedType.purity) {
                        handleInputChange('purity', selectedType.purity.toString());
                      }
                      if (selectedType.weight) {
                        if (selectedType.isBtc) {
                          handleInputChange('units', selectedType.weight.toString());
                        } else {
                          handleInputChange('weight', selectedType.weight.toString());
                        }
                      }
                      if (selectedType.wage) {
                        handleInputChange('fee', selectedType.wage.toString());
                      }
                    }
                  }}
                  onKeyDown={(e) => handleKeyDown(e, 1)}
                  disabled={!selectedClient || statementTypesLoading}
                  className="w-full h-8 px-1 border-none outline-none bg-transparent text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded cursor-pointer"
                >
                  <option value="">اختر البيان</option>
                  {statementTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className={`px-3 py-2 border-r border-gray-300 hover:bg-blue-50 transition-colors duration-150 ${selectedCell?.row === currentRowIndex && selectedCell?.col === 2 ? 'bg-blue-200 ring-2 ring-blue-400' : ''}`}
                onClick={() => handleCellClick(currentRowIndex, 2)}
                onDoubleClick={() => handleCellDoubleClick(currentRowIndex, 2)}>
                {(() => {
                  const selectedType = statementTypes.find(type => type.id === currentTransaction.statementTypeId);
                  const isBtc = selectedType?.isBtc || false;

                  if (isBtc) {
                    // For BTC, show units field instead of weight
                    return (
                      <input
                        ref={setInputRef(currentRowIndex, 2)}
                        type="number"
                        step="0.000001"
                        value={currentTransaction.units || ''}
                        onChange={(e) => handleInputChange('units', e.target.value)}
                        onKeyDown={(e) => handleKeyNavigation(e, currentRowIndex, 2)}
                        disabled={!selectedClient}
                        readOnly={selectedCell?.row === currentRowIndex && selectedCell?.col === 2 && !isEditing}
                        className={`w-full h-8 px-2 border-none outline-none bg-transparent text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded ${selectedCell?.row === currentRowIndex && selectedCell?.col === 2 && !isEditing ? 'cursor-pointer' : ''}`}
                        placeholder="عدد الوحدات"
                      />
                    );
                  } else {
                    // For regular gold, show weight field
                    return (
                      <input
                        ref={setInputRef(currentRowIndex, 2)}
                        type="number"
                        step="0.001"
                        value={currentTransaction.weight || ''}
                        onChange={(e) => handleInputChange('weight', e.target.value)}
                        onKeyDown={(e) => handleKeyNavigation(e, currentRowIndex, 2)}
                        disabled={!selectedClient}
                        readOnly={selectedCell?.row === currentRowIndex && selectedCell?.col === 2 && !isEditing}
                        className={`w-full h-8 px-2 border-none outline-none bg-transparent text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded ${selectedCell?.row === currentRowIndex && selectedCell?.col === 2 && !isEditing ? 'cursor-pointer' : ''}`}
                        placeholder="الوزن"
                      />
                    );
                  }
                })()}
              </td>
              <td className={`px-3 py-2 border-r border-gray-300 hover:bg-blue-50 transition-colors duration-150 ${selectedCell?.row === currentRowIndex && selectedCell?.col === 3 ? 'bg-blue-200 ring-2 ring-blue-400' : ''}`}
                onClick={() => handleCellClick(currentRowIndex, 3)}
                onDoubleClick={() => handleCellDoubleClick(currentRowIndex, 3)}>
                {(() => {
                  const selectedType = statementTypes.find(type => type.id === currentTransaction.statementTypeId);
                  const hasPredefinedPurity = selectedType?.purity !== null && selectedType?.purity !== undefined;

                  if (hasPredefinedPurity) {
                    // For statement types with predefined purity, show it as read-only
                    return (
                      <input
                        ref={setInputRef(currentRowIndex, 3)}
                        type="number"
                        value={currentTransaction.purity || selectedType?.purity || ''}
                        disabled={true}
                        className="w-full h-8 px-2 border-none outline-none bg-gray-100 text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded"
                        readOnly
                      />
                    );
                  } else {
                    // For statement types without predefined purity, show dropdown
                    return (
                      <select
                        ref={setInputRef(currentRowIndex, 3)}
                        value={currentTransaction.purity || ''}
                        onChange={(e) => handleInputChange('purity', e.target.value)}
                        onKeyDown={(e) => handleKeyNavigation(e as any, currentRowIndex, 3)}
                        disabled={!selectedClient}
                        className="w-full h-8 px-2 border-none outline-none bg-transparent text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded cursor-pointer"
                      >
                        <option value="21">21</option>
                        <option value="18">18</option>
                        <option value="24">24</option>
                      </select>
                    );
                  }
                })()}
              </td>
              <td className={`px-3 py-2 border-r border-gray-300 hover:bg-blue-50 transition-colors duration-150 ${selectedCell?.row === currentRowIndex && selectedCell?.col === 4 ? 'bg-blue-200 ring-2 ring-blue-400' : ''}`}
                onClick={() => handleCellClick(currentRowIndex, 4)}
                onDoubleClick={() => handleCellDoubleClick(currentRowIndex, 4)}>
                <input
                  ref={setInputRef(currentRowIndex, 4)}
                  type="number"
                  value={currentTransaction.fee || ''}
                  onChange={(e) => handleInputChange('fee', e.target.value)}
                  onKeyDown={(e) => handleKeyNavigation(e, currentRowIndex, 4)}
                  disabled={!selectedClient}
                  readOnly={selectedCell?.row === currentRowIndex && selectedCell?.col === 4 && !isEditing}
                  className={`w-full h-8 px-2 border-none outline-none bg-transparent text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded ${selectedCell?.row === currentRowIndex && selectedCell?.col === 4 && !isEditing ? 'cursor-pointer' : ''}`}
                />
              </td>
              <td className={`px-3 py-2 border-r border-gray-300 hover:bg-blue-50 transition-colors duration-150 ${selectedCell?.row === currentRowIndex && selectedCell?.col === 5 ? 'bg-blue-200 ring-2 ring-blue-400' : ''}`}
                onClick={() => handleCellClick(currentRowIndex, 5)}
                onDoubleClick={() => handleCellDoubleClick(currentRowIndex, 5)}>
                <select
                  ref={setInputRef(currentRowIndex, 5)}
                  value={currentTransaction.feeType || ''}
                  onChange={(e) => handleInputChange('feeType', e.target.value)}
                  onKeyDown={(e) => handleKeyNavigation(e as any, currentRowIndex, 5)}
                  disabled={!selectedClient}
                  className="w-full h-8 px-2 border-none outline-none bg-transparent text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded cursor-pointer"
                >
                  <option value="نقدي">نقدي</option>
                  <option value="ذهب">ذهب</option>
                </select>
              </td>
              <td className={`px-3 py-2 border-r border-gray-300 hover:bg-blue-50 transition-colors duration-150 ${selectedCell?.row === currentRowIndex && selectedCell?.col === 6 ? 'bg-blue-200 ring-2 ring-blue-400' : ''}`}
                onClick={() => handleCellClick(currentRowIndex, 6)}
                onDoubleClick={() => handleCellDoubleClick(currentRowIndex, 6)}>
                <input
                  ref={setInputRef(currentRowIndex, 6)}
                  type="text"
                  value={currentTransaction.net21 || ''}
                  readOnly
                  className="w-full h-8 px-2 border-none outline-none bg-gray-100 text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded cursor-pointer"
                />
              </td>
              <td className={`px-3 py-2 border-r border-gray-300 hover:bg-blue-50 transition-colors duration-150 ${selectedCell?.row === currentRowIndex && selectedCell?.col === 7 ? 'bg-blue-200 ring-2 ring-blue-400' : ''}`}
                onClick={() => handleCellClick(currentRowIndex, 7)}
                onDoubleClick={() => handleCellDoubleClick(currentRowIndex, 7)}>
                <input
                  ref={setInputRef(currentRowIndex, 7)}
                  type="text"
                  value={currentTransaction.value || ''}
                  readOnly
                  className="w-full h-8 px-2 border-none outline-none bg-gray-100 text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded cursor-pointer"
                />
              </td>
              <td className={`px-3 py-2 hover:bg-blue-50 transition-colors duration-150 ${selectedCell?.row === currentRowIndex && selectedCell?.col === 8 ? 'bg-blue-200 ring-2 ring-blue-400' : ''}`}
                onClick={() => handleCellClick(currentRowIndex, 8)}
                onDoubleClick={() => handleCellDoubleClick(currentRowIndex, 8)}>
                <input
                  ref={setInputRef(currentRowIndex, 8)}
                  type="text"
                  value={currentTransaction.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  onKeyDown={(e) => handleKeyNavigation(e, currentRowIndex, 8)}
                  disabled={!selectedClient}
                  readOnly={selectedCell?.row === currentRowIndex && selectedCell?.col === 8 && !isEditing}
                  className={`w-full h-8 px-2 border-none outline-none bg-transparent text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded ${selectedCell?.row === currentRowIndex && selectedCell?.col === 8 && !isEditing ? 'cursor-pointer' : ''}`}
                />
              </td>
            </tr>
            {transactionRows.filter(r => r.type === activeTab).map((row, index) => (
              <tr key={row.tempId} className="bg-blue-50">
                <td className="px-3 py-2 border-r border-gray-300">
                  {inlineEditingRow === index && inlineEditingField === 'barcode' ? (
                    <input
                      type="text"
                      value={row.barcode}
                      onChange={(e) => updateInlineEdit(index, 'barcode', e.target.value)}
                      onBlur={() => cancelInlineEdit()}
                      onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                      className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block text-center"
                      onClick={() => startInlineEdit(index, 'barcode')}
                    >
                      {row.barcode || 'اضغط للتعديل'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 border-r border-gray-300">
                  {inlineEditingRow === index && inlineEditingField === 'description' ? (
                    <select
                      value={row.statementTypeId || ''}
                      onChange={(e) => {
                        const selectedType = statementTypes.find(type => type.id === e.target.value);
                        updateInlineEdit(index, 'statementTypeId', e.target.value);
                        updateInlineEdit(index, 'description', selectedType?.name || '');
                        if (selectedType?.purity) {
                          updateInlineEdit(index, 'purity', selectedType.purity.toString());
                        }
                        if (selectedType?.weight) {
                          updateInlineEdit(index, 'weight', selectedType.weight.toString());
                        }
                        if (selectedType?.wage) {
                          updateInlineEdit(index, 'fee', selectedType.wage.toString());
                        }
                      }}
                      onBlur={() => cancelInlineEdit()}
                      onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                      className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs"
                      autoFocus
                    >
                      <option value="">اختر البيان</option>
                      {statementTypes.map(type => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block text-center"
                      onClick={() => startInlineEdit(index, 'description')}
                    >
                      {row.description || 'اضغط للتعديل'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 border-r border-gray-300">
                  {inlineEditingRow === index && inlineEditingField === 'weight' ? (
                    <input
                      type="number"
                      value={row.weight}
                      onChange={(e) => updateInlineEdit(index, 'weight', e.target.value)}
                      onBlur={() => cancelInlineEdit()}
                      onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                      className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block text-center"
                      onClick={() => startInlineEdit(index, 'weight')}
                    >
                      {row.weight || 'اضغط للتعديل'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 border-r border-gray-300">
                  {inlineEditingRow === index && inlineEditingField === 'purity' ? (
                    <input
                      type="number"
                      value={row.purity}
                      onChange={(e) => updateInlineEdit(index, 'purity', e.target.value)}
                      onBlur={() => cancelInlineEdit()}
                      onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                      className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block text-center"
                      onClick={() => startInlineEdit(index, 'purity')}
                    >
                      {row.purity || '21'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 border-r border-gray-300">
                  {inlineEditingRow === index && inlineEditingField === 'fee' ? (
                    <input
                      type="number"
                      value={row.fee}
                      onChange={(e) => updateInlineEdit(index, 'fee', e.target.value)}
                      onBlur={() => cancelInlineEdit()}
                      onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                      className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block text-center"
                      onClick={() => startInlineEdit(index, 'fee')}
                    >
                      {row.fee || 'اضغط للتعديل'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 border-r border-gray-300">
                  {inlineEditingRow === index && inlineEditingField === 'feeType' ? (
                    <select
                      value={row.feeType}
                      onChange={(e) => updateInlineEdit(index, 'feeType', e.target.value)}
                      onBlur={() => cancelInlineEdit()}
                      className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs"
                      autoFocus
                    >
                      <option value="نقدي">نقدي</option>
                      <option value="ذهب">ذهب</option>
                    </select>
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block text-center"
                      onClick={() => startInlineEdit(index, 'feeType')}
                    >
                      {row.feeType || 'نقدي'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 border-r border-gray-300 text-center">{row.net21}</td>
                <td className="px-3 py-2 border-r border-gray-300 text-center">{row.value}</td>
                <td className="px-3 py-2">
                  {inlineEditingRow === index && inlineEditingField === 'notes' ? (
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateInlineEdit(index, 'notes', e.target.value)}
                      onBlur={() => cancelInlineEdit()}
                      onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                      className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block text-center"
                      onClick={() => startInlineEdit(index, 'notes')}
                    >
                      {row.notes || 'اضغط للتعديل'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 15 - transactionRows.filter(r => r.type === activeTab).length) }).map((_, index) => (
              <tr key={`empty-${index}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 border-r border-gray-300 h-10">&nbsp;</td>
                <td className="px-3 py-2 border-r border-gray-300">&nbsp;</td>
                <td className="px-3 py-2 border-r border-gray-300">&nbsp;</td>
                <td className="px-3 py-2 border-r border-gray-300">&nbsp;</td>
                <td className="px-3 py-2 border-r border-gray-300">&nbsp;</td>
                <td className="px-3 py-2 border-r border-gray-300">&nbsp;</td>
                <td className="px-3 py-2 border-r border-gray-300">&nbsp;</td>
                <td className="px-3 py-2 border-r border-gray-300">&nbsp;</td>
                <td className="px-3 py-2">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSellBuyTable = () => (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-blue-200 sticky top-0">
          <tr>
            <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">الوزن</th>
            <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">سعر</th>
            <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">قيمة النقدية</th>
            <th className="px-3 py-3 text-right font-semibold">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-gray-50 bg-yellow-50">
            <td className="px-3 py-2 border-r border-gray-300">
              <input
                ref={setInputRef(currentRowIndex, 0)}
                type="number"
                step="0.001"
                value={currentTransaction.weight || ''}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 0)}
                disabled={!selectedClient}
                className="w-full border-none outline-none bg-transparent text-center"
                placeholder={selectedClient ? "" : "اختر عميل أولاً"}
              />
            </td>
            <td className="px-3 py-2 border-r border-gray-300">
              <input
                ref={setInputRef(currentRowIndex, 1)}
                type="number"
                value={currentTransaction.price || ''}
                onChange={(e) => handleInputChange('price', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 1)}
                disabled={!selectedClient}
                className="w-full border-none outline-none bg-transparent text-center"
              />
            </td>
            <td className="px-3 py-2 border-r border-gray-300">
              <input
                ref={setInputRef(currentRowIndex, 2)}
                type="text"
                value={currentTransaction.value || ''}
                readOnly
                className="w-full border-none outline-none bg-gray-100 text-center"
              />
            </td>
            <td className="px-3 py-2">
              <input
                ref={setInputRef(currentRowIndex, 3)}
                type="text"
                value={currentTransaction.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 3)}
                disabled={!selectedClient}
                className="w-full border-none outline-none bg-transparent text-center"
              />
            </td>
          </tr>
          {transactionRows.filter(r => r.type === activeTab).map((row, index) => (
            <tr key={row.tempId} className="bg-blue-50">
              <td className="px-3 py-2 border-r border-gray-300">
                {inlineEditingRow === index && inlineEditingField === 'weight' ? (
                  <input
                    type="number"
                    value={row.weight}
                    onChange={(e) => updateInlineEdit(index, 'weight', e.target.value)}
                    onBlur={() => cancelInlineEdit()}
                    onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                    className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs"
                    autoFocus
                  />
                ) : (
                  <span
                    className="cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block text-center"
                    onClick={() => startInlineEdit(index, 'weight')}
                  >
                    {row.weight || 'اضغط للتعديل'}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 border-r border-gray-300">
                {inlineEditingRow === index && inlineEditingField === 'price' ? (
                  <input
                    type="number"
                    value={row.price}
                    onChange={(e) => updateInlineEdit(index, 'price', e.target.value)}
                    onBlur={() => cancelInlineEdit()}
                    onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                    className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs"
                    autoFocus
                  />
                ) : (
                  <span
                    className="cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block text-center"
                    onClick={() => startInlineEdit(index, 'price')}
                  >
                    {row.price || 'اضغط للتعديل'}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 border-r border-gray-300 text-center">{row.value}</td>
              <td className="px-3 py-2">
                {inlineEditingRow === index && inlineEditingField === 'notes' ? (
                  <input
                    type="text"
                    value={row.notes}
                    onChange={(e) => updateInlineEdit(index, 'notes', e.target.value)}
                    onBlur={() => cancelInlineEdit()}
                    onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                    className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs"
                    autoFocus
                  />
                ) : (
                  <span
                    className="cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block text-center"
                    onClick={() => startInlineEdit(index, 'notes')}
                  >
                    {row.notes || 'اضغط للتعديل'}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 15 - transactionRows.filter(r => r.type === activeTab).length) }).map((_, index) => (
            <tr key={`empty-${index}`} className="hover:bg-gray-50">
              <td className="px-3 py-2 border-r border-gray-300 h-10">&nbsp;</td>
              <td className="px-3 py-2 border-r border-gray-300">&nbsp;</td>
              <td className="px-3 py-2 border-r border-gray-300">&nbsp;</td>
              <td className="px-3 py-2">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCashTable = () => (
    <div className="flex-1 min-h-0 overflow-auto relative shadow-lg border border-gray-200 rounded-lg">
      <table className="w-full text-xs border-collapse excel-table">
        <thead className="bg-gradient-to-b from-blue-100 to-blue-200 sticky top-0 z-10">
          <tr>
            <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">خزنة</th>
            <th className="px-2 py-3 text-right border border-gray-300 font-semibold text-gray-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-150">ملاحظة</th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-gray-50 bg-yellow-50">
            <td className="px-1 py-1 border border-gray-300 hover:bg-blue-50 transition-colors duration-150">
              <input
                ref={setInputRef(currentRowIndex, 0)}
                type="number"
                value={currentTransaction.amount || ''}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 0)}
                disabled={!selectedClient}
                className="w-full h-8 px-2 border-none outline-none bg-transparent text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded"
                placeholder={selectedClient ? "" : "اختر عميل أولاً"}
              />
            </td>
            <td className="px-1 py-1 border border-gray-300 hover:bg-blue-50 transition-colors duration-150">
              <input
                ref={setInputRef(currentRowIndex, 1)}
                type="text"
                value={currentTransaction.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 1)}
                disabled={!selectedClient}
                className="w-full h-8 px-2 border-none outline-none bg-transparent text-center focus:bg-white focus:ring-2 focus:ring-blue-400 focus:shadow-md transition-all duration-150 rounded"
              />
            </td>
          </tr>
          {transactionRows.filter(r => r.type === activeTab).map((row, index) => (
            <tr key={row.tempId} className="bg-blue-50">
              <td className="px-1 py-1 border border-gray-300 hover:bg-blue-50 transition-colors duration-150">
                {inlineEditingRow === index && inlineEditingField === 'amount' ? (
                  <input
                    type="number"
                    value={row.amount}
                    onChange={(e) => updateInlineEdit(index, 'amount', e.target.value)}
                    onBlur={() => cancelInlineEdit()}
                    onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                    className="w-full h-8 px-2 border border-blue-500 rounded text-xs focus:bg-white focus:ring-2 focus:ring-blue-400"
                    autoFocus
                  />
                ) : (
                  <span
                    className="cursor-pointer hover:bg-blue-100 px-2 py-1 rounded block text-center transition-all duration-150"
                    onClick={() => startInlineEdit(index, 'amount')}
                  >
                    {row.amount || 'اضغط للتعديل'}
                  </span>
                )}
              </td>
              <td className="px-1 py-1 border border-gray-300 hover:bg-blue-50 transition-colors duration-150">
                {inlineEditingRow === index && inlineEditingField === 'notes' ? (
                  <input
                    type="text"
                    value={row.notes}
                    onChange={(e) => updateInlineEdit(index, 'notes', e.target.value)}
                    onBlur={() => cancelInlineEdit()}
                    onKeyDown={(e) => e.key === 'Enter' && cancelInlineEdit()}
                    className="w-full h-8 px-2 border border-blue-500 rounded text-xs focus:bg-white focus:ring-2 focus:ring-blue-400"
                    autoFocus
                  />
                ) : (
                  <span
                    className="cursor-pointer hover:bg-blue-100 px-2 py-1 rounded block text-center transition-all duration-150"
                    onClick={() => startInlineEdit(index, 'notes')}
                  >
                    {row.notes || 'اضغط للتعديل'}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 15 - transactionRows.filter(r => r.type === activeTab).length) }).map((_, index) => (
            <tr key={`empty-${index}`} className="hover:bg-blue-50 transition-colors duration-150">
              <td className="px-1 py-1 border border-gray-300 h-10">&nbsp;</td>
              <td className="px-1 py-1 border border-gray-300">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="relative flex flex-col h-full">
      {isViewingInvoice && invoiceData ? (
        // Invoice viewing mode
        <>
          {/* Invoice Header */}
          <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
            <h2 className="text-lg font-bold">تفاصيل الفاتورة {invoiceData.id.split('-')[1]}</h2>
            <div className="flex gap-2">
              {invoiceChanges.filter(change => change).length > 0 && (
                <>
                  <button
                    onClick={saveInvoiceChanges}
                    className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                  >
                    حفظ التعديلات
                  </button>
                  <button
                    onClick={cancelAllInvoiceChanges}
                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                  >
                    إلغاء التعديلات
                  </button>
                </>
              )}
              {onDeleteInvoice && (
                <button
                  onClick={() => {
                    if (window.confirm('هل أنت متأكد من حذف الفاتورة بالكامل؟ سيتم عكس جميع معاملاتها.')) {
                      onDeleteInvoice(invoiceData.id, 'حذف فاتورة بالكامل');
                    }
                  }}
                  className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm"
                  title="حذف الفاتورة بالكامل"
                >
                  حذف الفاتورة
                </button>
              )}
              <button
                onClick={onExitInvoiceView}
                className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm"
              >
                ← العودة
              </button>
            </div>
          </div>

          {/* Invoice Info */}
          <div className="bg-blue-50 p-3 border-b">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="font-bold">النوع:</span> {invoiceData.type}</div>
              <div><span className="font-bold">إجمالي الذهب:</span> {invoiceData.amountGrams.toFixed(3)}g</div>
              <div><span className="font-bold">إجمالي النقدية:</span> {(invoiceData.amountCash || 0).toFixed(2)}</div>
            </div>
            <div className="mt-2 text-sm">
              <span className="font-bold">التاريخ:</span> {new Date(invoiceData.createdAt).toLocaleDateString('ar')}
            </div>
          </div>

          {/* Transactions Table Header */}
          <div className="bg-gray-100 p-2 text-center font-bold border-b">
            معاملة جديدة
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-blue-200 sticky top-0">
                <tr>
                  <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">باركود</th>
                  <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">البيان</th>
                  <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">الوزن</th>
                  <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">العيار</th>
                  <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">الأجر</th>
                  <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">نوع الأجر</th>
                  <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">صافي21</th>
                  <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">قيمة</th>
                  <th className="px-3 py-3 text-right border-r border-gray-400 font-semibold">ملاحظة</th>
                  <th className="px-3 py-3 text-center border-r border-gray-400 font-semibold">تعديل</th>
                  <th className="px-3 py-3 text-center border-r border-gray-400 font-semibold">حذف</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.invoiceItems && invoiceData.invoiceItems.map((item: any, index: number) => {
                  // Use changed data if available, otherwise use original
                  const currentData = invoiceChanges[index] || item;
                  const hasChanges = invoiceChanges[index]?.hasChanges || false;

                  // Extract details from payment description or use changed values
                  const desc = currentData.payment?.description || item.payment.description;
                  let weight = '';
                  let value = '';
                  let caliber = '21';
                  let fee = '0';
                  let feeType = 'نقدي';

                  // If we have changes, use those values
                  if (hasChanges) {
                    weight = currentData.weight || (currentData.amountGrams || item.amountGrams).toFixed(3);
                    caliber = currentData.caliber || '21';
                    fee = currentData.fee || '0';
                    feeType = currentData.feeType || 'نقدي';
                    value = currentData.value || '0';
                  } else {
                    // Parse description for details
                    const weightMatch = desc.match(/وزن:\s*([\d.]+)/);
                    const valueMatch = desc.match(/قيمة:\s*([\d.]+)/);
                    const amountMatch = desc.match(/مبلغ:\s*([\d.]+)/);

                    weight = weightMatch ? weightMatch[1] : (currentData.amountGrams || item.amountGrams).toFixed(3);
                    value = valueMatch ? valueMatch[1] : (amountMatch ? amountMatch[1] : '0');
                  }

                  return (
                    <tr key={index} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${hasChanges ? 'bg-yellow-50 border-yellow-300' : ''} border-b`}>
                      <td className="px-3 py-2 border-r border-gray-300 text-center">{item.payment.id.slice(-8)}</td>
                      <td className="px-3 py-2 border-r border-gray-300 text-center">
                        {invoiceEditingRow === index && invoiceEditingField === 'transactionType' ? (
                          <input
                            type="text"
                            value={invoiceEditingValue}
                            onChange={(e) => setInvoiceEditingValue(e.target.value)}
                            onBlur={() => saveInvoiceEdit(index, 'transactionType', invoiceEditingValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveInvoiceEdit(index, 'transactionType', invoiceEditingValue);
                              } else if (e.key === 'Escape') {
                                cancelInvoiceEdit();
                              }
                            }}
                            className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs text-center"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block ${hasChanges ? 'font-bold text-blue-600' : ''}`}
                            onClick={() => startInvoiceEdit(index, 'transactionType', currentData.transactionType || item.transactionType)}
                          >
                            {(hasChanges && currentData.transactionType) ? currentData.transactionType : (currentData.transactionType || item.transactionType)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 text-center">
                        {invoiceEditingRow === index && invoiceEditingField === 'weight' ? (
                          <input
                            type="text"
                            value={invoiceEditingValue}
                            onChange={(e) => setInvoiceEditingValue(e.target.value)}
                            onBlur={() => saveInvoiceEdit(index, 'weight', invoiceEditingValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveInvoiceEdit(index, 'weight', invoiceEditingValue);
                              } else if (e.key === 'Escape') {
                                cancelInvoiceEdit();
                              }
                            }}
                            className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs text-center"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block ${hasChanges ? 'font-bold text-blue-600' : ''}`}
                            onClick={() => startInvoiceEdit(index, 'weight', weight)}
                          >
                            {weight}g
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 text-center">
                        {invoiceEditingRow === index && invoiceEditingField === 'caliber' ? (
                          <input
                            type="text"
                            value={invoiceEditingValue}
                            onChange={(e) => setInvoiceEditingValue(e.target.value)}
                            onBlur={() => saveInvoiceEdit(index, 'caliber', invoiceEditingValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveInvoiceEdit(index, 'caliber', invoiceEditingValue);
                              } else if (e.key === 'Escape') {
                                cancelInvoiceEdit();
                              }
                            }}
                            className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs text-center"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block ${hasChanges ? 'font-bold text-blue-600' : ''}`}
                            onClick={() => startInvoiceEdit(index, 'caliber', caliber)}
                          >
                            {caliber}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 text-center">
                        {invoiceEditingRow === index && invoiceEditingField === 'fee' ? (
                          <input
                            type="text"
                            value={invoiceEditingValue}
                            onChange={(e) => setInvoiceEditingValue(e.target.value)}
                            onBlur={() => saveInvoiceEdit(index, 'fee', invoiceEditingValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveInvoiceEdit(index, 'fee', invoiceEditingValue);
                              } else if (e.key === 'Escape') {
                                cancelInvoiceEdit();
                              }
                            }}
                            className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs text-center"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block ${hasChanges ? 'font-bold text-blue-600' : ''}`}
                            onClick={() => startInvoiceEdit(index, 'fee', fee)}
                          >
                            {fee}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 text-center">
                        {invoiceEditingRow === index && invoiceEditingField === 'feeType' ? (
                          <select
                            value={invoiceEditingValue}
                            onChange={(e) => {
                              setInvoiceEditingValue(e.target.value);
                              saveInvoiceEdit(index, 'feeType', e.target.value);
                            }}
                            onBlur={() => cancelInvoiceEdit()}
                            className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs text-center"
                            autoFocus
                          >
                            <option value="نقدي">نقدي</option>
                            <option value="ذهب">ذهب</option>
                          </select>
                        ) : (
                          <span
                            className={`cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block ${hasChanges ? 'font-bold text-blue-600' : ''}`}
                            onClick={() => startInvoiceEdit(index, 'feeType', feeType)}
                          >
                            {feeType}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 text-center">
                        <span className={hasChanges ? 'font-bold text-blue-600' : ''}>
                          {(currentData.net21 ? parseFloat(currentData.net21).toFixed(3) : (currentData.amountGrams || item.amountGrams).toFixed(3))}g
                        </span>
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 text-center">
                        {invoiceEditingRow === index && invoiceEditingField === 'value' ? (
                          <input
                            type="text"
                            value={invoiceEditingValue}
                            onChange={(e) => setInvoiceEditingValue(e.target.value)}
                            onBlur={() => saveInvoiceEdit(index, 'value', invoiceEditingValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveInvoiceEdit(index, 'value', invoiceEditingValue);
                              } else if (e.key === 'Escape') {
                                cancelInvoiceEdit();
                              }
                            }}
                            className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs text-center"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block ${hasChanges ? 'font-bold text-blue-600' : ''}`}
                            onClick={() => startInvoiceEdit(index, 'value', value)}
                          >
                            {value}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-300 text-center">
                        {invoiceEditingRow === index && invoiceEditingField === 'notes' ? (
                          <input
                            type="text"
                            value={invoiceEditingValue}
                            onChange={(e) => setInvoiceEditingValue(e.target.value)}
                            onBlur={() => saveInvoiceEdit(index, 'notes', invoiceEditingValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveInvoiceEdit(index, 'notes', invoiceEditingValue);
                              } else if (e.key === 'Escape') {
                                cancelInvoiceEdit();
                              }
                            }}
                            className="w-full border border-blue-500 rounded px-1 py-0.5 text-xs text-center"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded block ${hasChanges ? 'font-bold text-blue-600' : ''}`}
                            onClick={() => startInvoiceEdit(index, 'notes', currentData.notes || desc)}
                          >
                            {(hasChanges && currentData.notes) ? currentData.notes : desc}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-gray-300">
                        <button
                          onClick={() => startInvoiceEdit(index, 'transactionType', currentData.transactionType || item.transactionType)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-2"
                        >
                          تعديل
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {onDeleteInvoiceTransaction && (
                          <button
                            onClick={() => {
                              if (window.confirm('هل أنت متأكد من حذف هذه المعاملة؟ سيتم عكس ما تم بها.')) {
                                onDeleteInvoiceTransaction(item.payment.id, `حذف معاملة من فاتورة ${invoiceData.id}`);
                              }
                            }}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                            title="حذف هذه المعاملة"
                          >
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Fill empty rows to match original design */}
                {Array.from({ length: Math.max(0, 15 - (invoiceData.invoiceItems?.length || 0)) }).map((_, index) => (
                  <tr key={`empty-${index}`} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} border-b`}>
                    <td className="px-3 py-2 border-r border-gray-300 text-center h-8">&nbsp;</td>
                    <td className="px-3 py-2 border-r border-gray-300 text-center">&nbsp;</td>
                    <td className="px-3 py-2 border-r border-gray-300 text-center">&nbsp;</td>
                    <td className="px-3 py-2 border-r border-gray-300 text-center">&nbsp;</td>
                    <td className="px-3 py-2 border-r border-gray-300 text-center">&nbsp;</td>
                    <td className="px-3 py-2 border-r border-gray-300 text-center">&nbsp;</td>
                    <td className="px-3 py-2 border-r border-gray-300 text-center">&nbsp;</td>
                    <td className="px-3 py-2 border-r border-gray-300 text-center">&nbsp;</td>
                    <td className="px-3 py-2 border-r border-gray-300 text-center">&nbsp;</td>
                    <td className="px-3 py-2 border-r border-gray-300 text-center">&nbsp;</td>
                    <td className="px-3 py-2 text-center">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          <div className="bg-blue-100 p-3 border-t">
            <div className="grid grid-cols-3 gap-4 text-sm font-semibold">
              <div>إجمالي الذهب: {invoiceData.amountGrams.toFixed(3)}g</div>
              <div>الوزن القائم: {invoiceData.amountGrams.toFixed(3)}g</div>
              <div>مجموع الأجر: 0</div>
            </div>
          </div>
        </>
      ) : (
        // Normal mode
        <>
          {/* Tabs Container */}
          <div className="bg-white">
            <div className="flex flex-shrink-0" style={{ fontFamily: 'Alexandria, sans-serif', direction: 'rtl' }}>
              {tabs.map((tab, index) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-2 py-2 text-xs font-medium relative ${activeTab === tab
                    ? 'bg-white text-blue-600 z-10 border-t-2 border-l-2 border-r-2 border-blue-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-b border-blue-500'
                    }`}
                  style={{
                    borderRight: index < tabs.length - 1 && activeTab !== tab ? '1px solid #d1d5db' : 'none',
                    fontFamily: 'Alexandria, sans-serif',
                    direction: 'rtl'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white p-2 border-b border-gray-200">
            <div className="flex gap-2">
              <button
                onClick={() => editingRowIndex !== -1 ? saveEditedRow() : addNewRow()}
                disabled={!selectedClient}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
              >
                {editingRowIndex !== -1 ? 'حفظ التعديل' : 'إضافة سطر'}
              </button>

              <button
                onClick={saveAllTransactions}
                disabled={!selectedClient || transactionRows.length === 0}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
              >
                حفظ جميع المعاملات ({transactionRows.length})
              </button>

              {editingRowIndex !== -1 && (
                <button
                  onClick={() => {
                    setEditingRowIndex(-1);
                    setCurrentTransaction(getInitialRow());
                  }}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>
          </div>

          {/* Current Transaction Form */}
          <div className="bg-white p-2 border-b border-gray-200">
            <h4 className="text-xs font-medium mb-2 text-gray-700">
              {editingRowIndex !== -1 ? `تعديل السطر ${editingRowIndex + 1}` : 'معاملة جديدة'}
            </h4>
          </div>

          {/* Table Content with Blue Border - Scrollable */}
          <div className="bg-white border-2 border-blue-500 border-t-0 relative flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-auto">
              {/* Gold In/Out Tables */}
              {(activeTab === 'وارد ذهب' || activeTab === 'منصرف ذهب') && renderGoldTable()}

              {/* Buy/Sell Tables */}
              {(activeTab === 'بيع' || activeTab === 'شراء') && renderSellBuyTable()}

              {/* Cash In/Out Tables */}
              {(activeTab === 'منصرف نقدية' || activeTab === 'وارد نقدية') && renderCashTable()}
            </div>

            {/* Footer with Summary Cards */}
            <div className="border-t border-gray-300 p-3 bg-gray-50 flex-shrink-0">
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white rounded-lg p-2 text-center border shadow-sm">
                  <div className="text-xs text-gray-600">اجمالي الذهب</div>
                  <div className="text-sm font-bold text-blue-600">
                    {transactionRows
                      .filter(t => t.type === activeTab && (t.type === 'وارد ذهب' || t.type === 'منصرف ذهب'))
                      .reduce((sum, t) => sum + parseFloat(t.net21 || 0), 0)
                      .toFixed(3)}g
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border shadow-sm">
                  <div className="text-xs text-gray-600">الوزن القائم</div>
                  <div className="text-sm font-bold text-blue-600">
                    {transactionRows
                      .filter(t => t.type === activeTab)
                      .reduce((sum, t) => sum + parseFloat(t.weight || 0), 0)
                      .toFixed(3)}g
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border shadow-sm">
                  <div className="text-xs text-gray-600">مجموع الاجر</div>
                  <div className="text-sm font-bold text-blue-600">
                    {(activeTab === 'وارد ذهب' || activeTab === 'منصرف ذهب')
                      ? transactionRows
                          .filter(t => t.type === activeTab)
                          .reduce((sum, t) => sum + (parseFloat(t.net21 || t.weight || '0') || 0) * (parseFloat(t.fee || '0') || 0), 0)
                          .toFixed(3)
                      : transactionRows
                          .filter(t => t.type === activeTab)
                          .reduce((sum, t) => sum + parseFloat(t.fee || '0') || 0, 0)
                          .toFixed(0)}g
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border shadow-sm">
                  <div className="text-xs text-gray-600">ملاحظات</div>
                  <div className="text-sm font-bold text-blue-600">
                    {transactionRows.filter(t => t.type === activeTab && t.notes).length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}