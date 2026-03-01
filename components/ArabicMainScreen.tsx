'use client';

import { useState, useEffect } from 'react';
import { apiClient, Wallet } from '../lib/api';
import Header from './sections/Header';
import ControlsSection from './sections/ControlsSection';
import StatsCards from './sections/StatsCards';
import VaultOperations from './sections/VaultOperations';
import GoldVaultScreen from './GoldVaultScreen';
import LocalBullionScreen from './LocalBullionScreen';
import TransferScreen from './TransferScreen';
import CashVaultScreen from './CashVaultScreen';
import ClientAccountPage from './ClientAccountPage';
import PrintSection from './sections/PrintSection';
import TransactionsTable from './sections/TransactionsTable';
import ClientAccountTable from './sections/ClientAccountTable';
import ActionButtons from './sections/ActionButtons';
import DeletedTransactionsPage from './DeletedTransactionsPage';
import BuySellPage from './BuySellPage';
import { useToast } from '../hooks/useToast';
import { useStatementTypes } from '../hooks/useStatementTypes';
import { ClientBalanceCalculator, ClientBalance } from '../lib/balanceCalculator';
import ToastContainer from './ToastContainer';

interface ArabicMainScreenProps {
  onLogout: () => void;
}

interface ClientWalletGroup {
  accountId: string;
  accountName: string;
  goldWallet: Wallet | null;
  moneyWallet: Wallet | null;
}

export default function ArabicMainScreen({ onLogout }: ArabicMainScreenProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [clientGroups, setClientGroups] = useState<ClientWalletGroup[]>([]);
  const [selectedClient, setSelectedClient] = useState(''); // Now stores account ID
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [todayPrice, setTodayPrice] = useState('2100');
  const [averagePrice, setAveragePrice] = useState('2050');
  const [activeTab, setActiveTab] = useState('وارد ذهب');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [clientTransactions, setClientTransactions] = useState<any[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<any[]>([]);
  const [isTransactionFormDirty, setIsTransactionFormDirty] = useState(false);
  const [clientBalance, setClientBalance] = useState<ClientBalance | null>(null);
  const { statementTypes } = useStatementTypes();
  const [systemUserId, setSystemUserId] = useState<string | null>(null);
  const [showGoldVault, setShowGoldVault] = useState(false);
  const [showTransferScreen, setShowTransferScreen] = useState(false);
  const [showCashVault, setShowCashVault] = useState(false);
  const [showClientAccount, setShowClientAccount] = useState(false);
  const [showDeletedTransactions, setShowDeletedTransactions] = useState(false);
  const [showBuySell, setShowBuySell] = useState(false);
  const [showLocalBullion, setShowLocalBullion] = useState(false);

  // Invoice viewing state
  const [isViewingInvoice, setIsViewingInvoice] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<any>(null);

  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  // Generate a proper UUID v4
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  useEffect(() => {
    loadData();
    loadSystemUser();
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    setFromDate(today);
    setToDate(today);
  }, []);

  // Group wallets by account when wallets change
  useEffect(() => {
    if (wallets.length > 0) {
      groupWalletsByAccount();
    }
  }, [wallets]);

  // Calculate client balance when selected client or transactions change
  useEffect(() => {
    if (selectedClient) {
      loadClientTransactions(selectedClient);
    } else {
      setClientTransactions([]);
      setClientBalance(null);
    }
  }, [selectedClient, todayPrice, fromDate, toDate]);

  const groupWalletsByAccount = () => {
    // Group wallets by account
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

    setClientGroups(Array.from(accountMap.values()));
  };

  // Helper function to get the correct wallet ID based on transaction type
  const getWalletIdForTransaction = (accountId: string, transactionType: string): string | null => {
    const clientGroup = clientGroups.find(g => g.accountId === accountId);
    if (!clientGroup) return null;

    // Cash transactions use money wallet
    if (transactionType === 'وارد نقدية' || transactionType === 'منصرف نقدية') {
      return clientGroup.moneyWallet?.id || null;
    }

    // Gold transactions use gold wallet
    return clientGroup.goldWallet?.id || null;
  };

  const loadClientTransactions = async (accountId: string) => {
    try {
      console.log('Loading transactions for account:', accountId);

      // Find the client group
      const clientGroup = clientGroups.find(g => g.accountId === accountId);
      if (!clientGroup) {
        console.log('No client group found for account:', accountId);
        return;
      }

      const promises = [];
      if (clientGroup.goldWallet) {
        promises.push(
          apiClient.getWalletHistory(clientGroup.goldWallet.id).then(res =>
            res.data.map((entry: any) => ({ ...entry, currency: 'GOLD', wallet: clientGroup.goldWallet }))
          )
        );
      }
      if (clientGroup.moneyWallet) {
        promises.push(
          apiClient.getWalletHistory(clientGroup.moneyWallet.id).then(res =>
            res.data.map((entry: any) => ({ ...entry, currency: 'MONEY', wallet: clientGroup.moneyWallet }))
          )
        );
      }

      if (promises.length === 0) {
        console.log('No wallets found for account:', accountId);
        return;
      }

      const results = await Promise.all(promises);
      let allEntries = results.flat();

      // Filter by date range if dates are selected
      if (fromDate && toDate) {
        const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
        const [toYear, toMonth, toDay] = toDate.split('-').map(Number);

        const fromDateObj = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
        const toDateObj = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

        allEntries = allEntries.filter((entry: any) => {
          const transactionDate = new Date(entry.transactionDate);
          return transactionDate >= fromDateObj && transactionDate <= toDateObj;
        });
      }

      // Map to TransactionForBalance format
      const balanceTransactions = allEntries.map((entry: any) => {
        const isGold = entry.currency === 'GOLD';
        const isCredit = entry.entryType === 'CREDIT';

        // Map Entry Type to Readable Type for Balance Calculator
        // Gold Credit -> Deposited Gold (Has Gold) -> 'وارد ذهب'
        // Gold Debit -> Withdrawn Gold (Owes Gold) -> 'منصرف ذهب'
        // Money Credit -> Deposited Money (Has Cash) -> 'وارد نقدية'
        // Money Debit -> Withdrawn Money (Owes Cash) -> 'منصرف نقدية'
        let transactionType = '';
        const desc = entry.description || '';

        // Detect Sale/Buy based on description
        if (desc.startsWith('بيع') || desc.includes('بيع:')) {
          transactionType = 'بيع';
        } else if (desc.startsWith('شراء') || desc.includes('شراء:')) {
          transactionType = 'شراء';
        } else {
          // Default to simple deposit/withdrawal based on currency
          if (isGold) {
            transactionType = isCredit ? 'وارد ذهب' : 'منصرف ذهب';
          } else {
            transactionType = isCredit ? 'وارد نقدية' : 'منصرف نقدية';
          }
        }

        // Extract Price if available
        let savedPrice = null;
        if (entry.description) {
          const priceMatch = entry.description.match(/سعر:\s*(\d+)/);
          if (priceMatch) {
            savedPrice = priceMatch[1];
          }
        }

        // Calculate Amounts
        const rawAmount = parseFloat(entry.amountMg);
        let amountGrams = 0;
        let amountCash = 0;

        if (isGold) {
          amountGrams = rawAmount / 1000;
        } else {
          // Money wallet: amountMg represents smallest unit (cents)
          amountCash = rawAmount / 100;
        }

        return {
          id: entry.id,
          type: transactionType,
          amountGrams: amountGrams,
          weight: amountGrams.toString(),
          net21: amountGrams.toString(),
          clientId: entry.walletId,
          createdAt: entry.transactionDate,
          price: savedPrice,
          amountCash: amountCash,
          description: entry.description,
          referenceType: entry.referenceType,
          isLedger: true
        };
      });

      // Sort by date descending
      balanceTransactions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setClientTransactions(balanceTransactions);

      const balance = ClientBalanceCalculator.calculateBalance(
        balanceTransactions,
        parseFloat(todayPrice)
      );
      setClientBalance(balance);

    } catch (error) {
      console.error('Error loading client transactions:', error);
      setClientTransactions([]);
      setClientBalance(null);
    }
  };

  const loadSystemUser = async () => {
    try {
      console.log('Loading system user...');
      const response = await apiClient.getSystemUser();
      console.log('System user response:', response);

      // Handle axios response structure
      const systemUser = response.data || response;
      console.log('System user data:', systemUser);

      if (systemUser && systemUser.id) {
        setSystemUserId(systemUser.id);
        console.log('System user ID set:', systemUser.id);
      } else {
        throw new Error('System user data is invalid');
      }
    } catch (error) {
      console.error('Could not load system user:', error);
      showError('لا يمكن تحميل بيانات المستخدم النظام');
    }
  };

  const loadData = async () => {
    try {
      console.log('Loading wallets...');
      const walletsResponse = await apiClient.getWallets();
      console.log('Wallets response:', walletsResponse);

      // Handle axios response structure
      const walletsData = walletsResponse.data || walletsResponse;
      console.log('Wallets data:', walletsData);

      if (Array.isArray(walletsData)) {
        setWallets(walletsData);
        console.log('Wallets loaded:', walletsData.length);
      } else {
        console.warn('Wallets data is not an array:', walletsData);
        setWallets([]);
      }

      // TODO: Load existing transactions from API if needed
      // For now, keeping locally saved transactions
    } catch (error) {
      console.error('Error loading data:', error);
      showError('فشل في تحميل بيانات المحافظ');

      // If API fails, add some default mock data for testing
      const mockWallets = [
        {
          id: 'mock-1',
          name: 'عميل تجريبي',
          walletType: 'STANDARD',
          isActive: true,
          balanceMg: '5000',
          balanceGrams: 5.0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          accountId: 'default',
          currency: 'EGP'
        }
      ];
      setWallets(mockWallets);
    }
  };

  // Calculate average price from transactions in selected date range
  const calculateAveragePrice = async () => {
    try {
      // Load all payments to find transactions with prices
      const paymentsResponse = await apiClient.getAllPayments();
      let allPayments = Array.isArray(paymentsResponse.data) ? paymentsResponse.data : [];

      // Filter by date range if dates are selected
      if (fromDate && toDate) {
        // Parse dates as local dates (YYYY-MM-DD format from input)
        const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
        const [toYear, toMonth, toDay] = toDate.split('-').map(Number);

        const fromDateObj = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
        const toDateObj = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

        allPayments = allPayments.filter((payment: any) => {
          const transactionDate = new Date(payment.createdAt);
          return transactionDate >= fromDateObj && transactionDate <= toDateObj;
        });

        console.log(`Calculating average price from ${allPayments.length} transactions in range ${fromDate} to ${toDate}`);
      }

      // Filter transactions that have price information
      const transactionsWithPrice = allPayments.filter((payment: any) => {
        // Check if payment description contains price info
        if (payment.description) {
          const priceMatch = payment.description.match(/سعر:\s*(\d+)/);
          if (priceMatch && parseFloat(priceMatch[1]) > 0) return true;
        }
        // Check if there's a direct price field
        if (payment.price && parseFloat(payment.price) > 0) return true;
        return false;
      });

      let totalPrice = 0;
      let priceCount = 0;

      transactionsWithPrice.forEach((payment: any) => {
        let transactionPrice: number | null = null;

        // Check if payment description contains price info
        if (payment.description) {
          const priceMatch = payment.description.match(/سعر:\s*(\d+)/);
          if (priceMatch) {
            transactionPrice = parseFloat(priceMatch[1]);
          }
        }

        // If no price found in description, check if there's a direct price field
        if (!transactionPrice && payment.price) {
          transactionPrice = parseFloat(payment.price);
        }

        if (transactionPrice && transactionPrice > 0) {
          totalPrice += transactionPrice;
          priceCount++;
        }
      });

      if (priceCount > 0) {
        const avgPrice = Math.round(totalPrice / priceCount);
        setAveragePrice(avgPrice.toString());
        console.log(`Average price calculated: ${avgPrice} from ${priceCount} transactions`);
      } else {
        // Keep the current average price if no transactions with price found
        console.log('No transactions with price found in date range, keeping current average price');
      }
    } catch (error) {
      console.error('Error calculating average price:', error);
    }
  };

  // Update average price when dates change
  useEffect(() => {
    calculateAveragePrice();
  }, [fromDate, toDate]);

  const handleAddClient = async () => {
    const clientName = prompt('أدخل اسم العميل:');
    if (!clientName) return;

    if (!systemUserId) {
      showError('لا يمكن إنشاء عميل: لم يتم تحميل معرف مستخدم النظام');
      return;
    }

    try {
      // 1. Create a dedicated Account for this client
      const accountResponse = await apiClient.createAccount({
        name: clientName,
        description: `Account for client ${clientName}`,
        accountType: 'PERSONAL',
        ownerId: systemUserId
      });
      const newAccount = accountResponse.data;
      console.log('Created account:', newAccount);

      // 2. Create Gold Wallet
      const goldWalletResponse = await apiClient.createWallet({
        name: `${clientName} - ذهب`,
        description: `Gold wallet for ${clientName}`,
        walletType: 'STANDARD',
        accountId: newAccount.id,
        currency: 'GOLD'
      });
      const goldWallet = goldWalletResponse.data;
      console.log('Created gold wallet:', goldWallet);

      // 3. Create Money Wallet (EGP)
      const moneyWalletResponse = await apiClient.createWallet({
        name: `${clientName} - نقدية`,
        description: `Money wallet for ${clientName}`,
        walletType: 'STANDARD',
        accountId: newAccount.id,
        currency: 'EGP' // Using EGP as default money currency
      });
      const moneyWallet = moneyWalletResponse.data;
      console.log('Created money wallet:', moneyWallet);

      // 4. Update local state
      const newWallets = [goldWallet, moneyWallet];
      setWallets(prev => [...prev, ...newWallets]);

      // Select the account (not the wallet)
      setSelectedClient(newAccount.id);

      showSuccess(`تم إضافة العميل ${clientName} بنجاح (حساب + محفظة ذهب + محفظة نقدية)`);

      // Reload all data to ensure consistency
      await loadData();

    } catch (error) {
      console.error('API creation failed:', error);

      // Show the actual error to user
      if (error instanceof Error) {
        showError(`فشل في إنشاء العميل: ${error.message}`);
      } else {
        showError('فشل في الاتصال بالخادم.');
      }
    }
  };

  const handleSaveAllTransactions = async (transactionsList: any[]) => {
    if (!systemUserId) {
      showError('لم يتم تحميل بيانات المستخدم النظام، يرجى إعادة تحميل الصفحة');
      return;
    }

    try {
      console.log('Saving batch transactions:', transactionsList);
      console.log('Selected client:', selectedClient);

      // Generate a single invoice/batch ID for all transactions in this batch
      const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let totalGoldAmount = 0;
      let totalCashAmount = 0;
      let invoiceType = transactionsList[0]?.type || 'مختلط';

      // If all transactions are the same type, use that type, otherwise use "مختلط"
      const allSameType = transactionsList.every(t => t.type === transactionsList[0].type);
      if (!allSameType) {
        invoiceType = 'فاتورة مختلطة';
      }

      for (const transactionData of transactionsList) {
        // Save to database using API
        if (transactionData.type === 'وارد ذهب' || transactionData.type === 'منصرف ذهب') {
          const paymentType = (transactionData.type === 'وارد ذهب' ? 'DEPOSIT' : 'WITHDRAWAL') as 'DEPOSIT' | 'WITHDRAWAL';

          // Calculate amount based on transaction type (BTC vs regular gold)
          let amountGrams = 0;
          const selectedStatementType = statementTypes.find(st => st.id === transactionData.statementTypeId);

          console.log('Statement type found:', selectedStatementType);
          console.log('Transaction data:', transactionData);

          if (selectedStatementType?.isBtc && transactionData.units && selectedStatementType.weight) {
            // For BTC: units * weight from statement type
            amountGrams = parseFloat(transactionData.units) * selectedStatementType.weight;
            console.log(`BTC calculation: ${transactionData.units} * ${selectedStatementType.weight} = ${amountGrams}`);
          } else {
            // For regular gold: use net21 or weight
            amountGrams = parseFloat(transactionData.net21) || parseFloat(transactionData.weight) || 0;
            console.log(`Regular gold calculation: ${amountGrams}`);
          }

          if (amountGrams < 0.001) {
            console.error('Amount too small:', amountGrams, 'Statement type:', selectedStatementType);
            throw new Error(`Amount too small: ${amountGrams}. Check that the statement type has a valid weight.`);
          }

          totalGoldAmount += amountGrams;

          // Get the correct wallet ID for this transaction type
          const walletId = getWalletIdForTransaction(selectedClient, transactionData.type);
          if (!walletId) {
            throw new Error(`لا توجد محفظة ${transactionData.type === 'وارد نقدية' || transactionData.type === 'منصرف نقدية' ? 'نقدية' : 'ذهب'} لهذا العميل`);
          }

          // Include units in the payload for BTC transactions and invoice ID
          const paymentPayload = {
            walletId: walletId,
            paymentType: paymentType,
            amountGrams: amountGrams,
            description: `${invoiceType}: ${transactionData.description || transactionData.notes} | سعر: ${todayPrice} | فاتورة: ${invoiceId}`,
            statementTypeId: transactionData.statementTypeId,
            externalRef: `${invoiceId}-${transactionData.barcode || Date.now()}`,
            idempotencyKey: generateUUID(),
            ...(selectedStatementType?.isBtc && transactionData.units ? { units: parseFloat(transactionData.units) } : {})
          };

          await apiClient.createPayment(paymentPayload, systemUserId);

          // الاجر (wage): use row fee when present, else statement type wage per gram
          const feePerGram = parseFloat(transactionData.fee as string) || selectedStatementType?.wage || 0;
          if (feePerGram > 0) {
            const wageAmount = parseFloat((amountGrams * feePerGram).toFixed(3));
            if (wageAmount >= 0.001) {
              // منصرف ذهب (WITHDRAWAL): Vault KEEPS wage as fee → DEPOSIT wage to vault
              // وارد ذهب (DEPOSIT): Vault PAYS wage as fee → WITHDRAWAL wage from vault
              const wagePaymentType = (paymentType === 'WITHDRAWAL' ? 'DEPOSIT' : 'WITHDRAWAL') as 'DEPOSIT' | 'WITHDRAWAL';
              const wagePayload = {
                walletId: walletId,
                paymentType: wagePaymentType,
                amountGrams: wageAmount,
                description: `الاجر: ${transactionData.description || transactionData.notes} | ${wageAmount.toFixed(3)}g × ${feePerGram}/g | فاتورة: ${invoiceId}`,
                statementTypeId: transactionData.statementTypeId,
                externalRef: `${invoiceId}-WAGE-${transactionData.barcode || Date.now()}`,
                idempotencyKey: generateUUID(),
              };
              await apiClient.createPayment(wagePayload, systemUserId);
            }
          }
        }
        // Handle cash operations
        else if (transactionData.type === 'وارد نقدية' || transactionData.type === 'منصرف نقدية') {
          // Create a virtual gold payment with zero amount to track cash transactions
          // وارد نقدية (cash incoming) → DEPOSIT (represents system receiving cash)
          // منصرف نقدية (cash outgoing) → WITHDRAWAL (represents system paying out cash)
          const paymentType = (transactionData.type === 'وارد نقدية' ? 'DEPOSIT' : 'WITHDRAWAL') as 'DEPOSIT' | 'WITHDRAWAL';
          const cashAmount = parseFloat(transactionData.amount) || 0;

          if (cashAmount < 0.01) {
            throw new Error(`Amount too small for ${transactionData.type}: ${cashAmount}`);
          }

          totalCashAmount += cashAmount;

          // Get the money wallet ID for cash transactions
          const walletId = getWalletIdForTransaction(selectedClient, transactionData.type);
          if (!walletId) {
            throw new Error(`لا توجد محفظة نقدية لهذا العميل`);
          }

          // For money wallets, we need to convert cash amount to the right unit for storage
          // Payment service multiplies amountGrams by 1000 to get amountMg
          // For money, amountMg should represent cents (amount * 100)
          // Therefore: amountGrams = cashAmount / 10
          // Example: 20000 EGP → amountGrams = 2000 → amountMg = 2000000 (20000 * 100 cents)
          const amountGramsForMoney = cashAmount / 10;

          const paymentPayload = {
            walletId: walletId,
            paymentType: paymentType,
            amountGrams: amountGramsForMoney,
            description: `${invoiceType}: ${transactionData.notes || ''} | مبلغ: ${cashAmount} | سعر: ${todayPrice} | فاتورة: ${invoiceId}`,
            externalRef: `${invoiceId}-${Date.now()}`,
            idempotencyKey: generateUUID(),
          };

          await apiClient.createPayment(paymentPayload, systemUserId);
        }
        // Handle buy/sell operations  
        else if (transactionData.type === 'بيع' || transactionData.type === 'شراء') {
          // بيع (sell): client gives gold to system → DEPOSIT gold, client gets cash credit
          // شراء (buy): client gets gold from system → WITHDRAWAL gold, client owes cash
          const paymentType = (transactionData.type === 'بيع' ? 'DEPOSIT' : 'WITHDRAWAL') as 'DEPOSIT' | 'WITHDRAWAL';
          const amountGrams = parseFloat(transactionData.weight) || 0;
          const cashAmount = parseFloat(transactionData.value) || (amountGrams * parseFloat(todayPrice));

          if (amountGrams < 0.001) {
            throw new Error(`Amount too small for ${transactionData.type}: ${amountGrams} grams`);
          }

          totalGoldAmount += amountGrams;
          totalCashAmount += cashAmount;

          // Get the gold wallet ID for buy/sell transactions
          const walletId = getWalletIdForTransaction(selectedClient, transactionData.type);
          if (!walletId) {
            throw new Error(`لا توجد محفظة ذهب لهذا العميل`);
          }

          const paymentPayload = {
            walletId: walletId,
            paymentType: paymentType,
            amountGrams: amountGrams,
            description: `${invoiceType}: ${transactionData.notes || ''} | سعر: ${transactionData.price || todayPrice} | قيمة: ${cashAmount} | فاتورة: ${invoiceId}`,
            externalRef: `${invoiceId}-${Date.now()}`,
            idempotencyKey: generateUUID(),
          };

          await apiClient.createPayment(paymentPayload, systemUserId);
        }

        // Store locally as well
        const transaction = {
          ...transactionData,
          id: Date.now().toString() + Math.random(),
          clientId: selectedClient, // Use selectedClient instead of transactionData.clientId
          invoiceId: invoiceId, // Add invoice ID to local storage
          createdAt: new Date().toISOString(),
          status: 'completed'
        };

        setTransactions(prev => [...prev, transaction]);
      }

      // Refresh data
      try {
        await loadData();
      } catch (loadError) {
        console.warn('Could not refresh wallet data:', loadError);
      }

      // Refresh client transactions and balance immediately
      if (selectedClient) {
        console.log('Refreshing client transactions after save...');
        await loadClientTransactions(selectedClient);
        console.log('Client transactions refreshed');
      }

      // Show success message with invoice details
      const itemCount = transactionsList.length;
      const summary = totalGoldAmount > 0 && totalCashAmount > 0
        ? `${totalGoldAmount.toFixed(3)}g + ${totalCashAmount.toFixed(0)} ج.م`
        : totalGoldAmount > 0
          ? `${totalGoldAmount.toFixed(3)}g`
          : `${totalCashAmount.toFixed(0)} ج.م`;

      showSuccess(`تم حفظ فاتورة برقم ${invoiceId.split('-')[1]} تحتوي على ${itemCount} عنصر (${summary})`);

    } catch (error) {
      console.error('Error saving transactions:', error);

      // Show detailed error to user
      showError(`فشل حفظ الفاتورة: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);

      // Still save locally so user doesn't lose data
      const invoiceId = `LOCAL-${Date.now()}`;
      for (const transactionData of transactionsList) {
        const transaction = {
          ...transactionData,
          id: Date.now().toString() + Math.random(),
          clientId: selectedClient,
          invoiceId: invoiceId,
          date: new Date().toISOString(),
          savedAt: new Date().toISOString(),
          savedLocally: true // Flag to indicate it's only saved locally
        };

        setTransactions(prev => [...prev, transaction]);
      }

      showWarning(`تم حفظ ${transactionsList.length} معاملة محلياً فقط - لم يتم الحفظ في قاعدة البيانات`);

      throw error; // Re-throw so the calling component knows about the error
    }
  };

  const handleNewTransaction = () => {
    setIsTransactionFormDirty(false);
    // The form will reset automatically in TransactionsTable
  };

  const handleDeleteTransaction = (transactionId: string, reason: string = 'غير محدد') => {
    const transactionToDelete = transactions.find(t => t.id === transactionId);

    if (transactionToDelete) {
      // Move transaction to deleted list with deletion metadata
      const deletedTransaction = {
        ...transactionToDelete,
        originalId: transactionToDelete.id,
        deletedAt: new Date().toISOString(),
        deletedBy: 'current-user', // In real app, get from auth
        deletionReason: reason
      };

      setDeletedTransactions(prev => [...prev, deletedTransaction]);
      setTransactions(prev => prev.filter(t => t.id !== transactionId));

      // Also remove from client transactions if it matches
      setClientTransactions(prev => prev.filter(t => t.id !== transactionId));
    }
  };

  const handleSaveInvoiceChanges = async (invoiceId: string, changes: any[]) => {
    if (!systemUserId) {
      showError('لم يتم تحميل بيانات المستخدم النظام، يرجى إعادة تحميل الصفحة');
      return;
    }

    try {
      console.log('Saving invoice changes:', invoiceId, changes);

      // Process each change
      for (const change of changes) {
        if (change.hasChanges) {
          const paymentId = change.payment?.id || change.id;

          // Calculate new amount if weight/caliber changed
          let newAmountGrams = 0;
          if (change.weight && change.caliber) {
            const weight = parseFloat(change.weight) || 0;
            const caliber = parseFloat(change.caliber) || 21;
            newAmountGrams = (weight * caliber / 21); // Calculate based on caliber
          } else if (change.amountGrams) {
            newAmountGrams = parseFloat(change.amountGrams);
          }

          // Build update payload 
          const updateFields: any = {};

          if (newAmountGrams > 0) {
            updateFields.amountMg = Math.round(newAmountGrams * 1000); // Convert to mg
          }

          if (change.description) {
            updateFields.description = change.description;
          }

          // Only update if there are actual changes
          if (Object.keys(updateFields).length > 0) {
            console.log('Updating payment', paymentId, 'with:', updateFields);

            // Call API to update payment - need to implement this endpoint
            const response = await fetch(`/api/payments/${paymentId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...updateFields,
                updatedBy: systemUserId
              })
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
          }
        }
      }

      // Refresh data after changes
      await loadData();

      if (selectedClient) {
        await loadClientTransactions(selectedClient);
      }

      showSuccess(`تم حفظ ${changes.length} تعديل بنجاح`);

    } catch (error) {
      console.error('Error saving invoice changes:', error);
      showError(`فشل حفظ التعديلات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  };

  const handleDeleteInvoiceTransaction = async (transactionId: string, reason?: string) => {
    if (!systemUserId) {
      showError('لم يتم تحميل بيانات المستخدم النظام، يرجى إعادة تحميل الصفحة');
      return;
    }

    try {
      console.log('Deleting transaction from invoice:', transactionId, 'Reason:', reason);

      // Call API to cancel/reverse the payment
      await apiClient.cancelPayment(
        transactionId,
        systemUserId,
        reason || 'تم الحذف من تفاصيل الفاتورة'
      );

      // Refresh data after deletion
      await loadData();

      if (selectedClient) {
        await loadClientTransactions(selectedClient);
      }

      showSuccess('تم حذف المعاملة بنجاح');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showError(`فشل حذف المعاملة: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string, reason?: string) => {
    if (!systemUserId) {
      showError('لم يتم تحميل بيانات المستخدم النظام، يرجى إعادة تحميل الصفحة');
      return;
    }

    try {
      console.log('Deleting entire invoice:', invoiceId);

      // Find all payments related to this invoice
      const paymentsResponse = await apiClient.getPayments();
      const invoicePayments = paymentsResponse.data.filter((p: any) =>
        p.externalRef && p.externalRef.includes(invoiceId)
      );

      if (invoicePayments.length === 0) {
        showWarning('لم يتم العثور على معاملات لهذه الفاتورة');
        return;
      }

      // Delete all payments in the invoice
      for (const payment of invoicePayments) {
        await apiClient.cancelPayment(
          payment.id,
          systemUserId,
          reason || `حذف فاتورة ${invoiceId}`
        );
      }

      // Refresh data after deletion
      await loadData();

      if (selectedClient) {
        await loadClientTransactions(selectedClient);
      }

      // Exit invoice view
      setIsViewingInvoice(false);
      setSelectedInvoiceData(null);

      showSuccess(`تم حذف الفاتورة ${invoiceId.split('-')[1]} وجميع معاملاتها (${invoicePayments.length} معاملة)`);

    } catch (error) {
      console.error('Error deleting invoice:', error);
      showError(`فشل حذف الفاتورة: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  };

  const handleDeleteAll = () => {
    if (window.confirm('هل أنت متأكد من حذف جميع المعاملات؟ سيتم إخفاؤها ويمكن استردادها لاحقاً.')) {
      const clientTransactionsToDelete = transactions.filter(t => t.clientId === selectedClient && !t.deleted);

      // Mark transactions as deleted with deletion metadata and save to DB
      const deletePromises = clientTransactionsToDelete.map(async (transaction) => {
        const selectedWallet = wallets.find(w => w.id === selectedClient);
        const clientName = selectedWallet ?
          (selectedWallet.account?.owner ?
            `${selectedWallet.account.owner.firstName || ''} ${selectedWallet.account.owner.lastName || ''}`.trim() :
            selectedWallet.name) :
          'عميل غير معروف';

        const deletedTransactionData = {
          originalId: transaction.id,
          transactionType: transaction.type,
          clientId: selectedClient,
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
          deletionReason: 'حذف جميع المعاملات',
          deletedBy: systemUserId || 'current-user'
        };

        // Try to save to database
        try {
          await apiClient.createDeletedTransaction(deletedTransactionData);
        } catch (error) {
          console.warn('Could not save deleted transaction to database:', error);
        }

        return {
          ...transaction,
          deleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: 'current-user',
          deletionReason: 'حذف جميع المعاملات'
        };
      });

      // Execute all soft delete operations
      Promise.all(deletePromises).then((updatedTransactions) => {
        setTransactions(prev => prev.map(t => {
          const updated = updatedTransactions.find(ut => ut.id === t.id);
          return updated || t;
        }));
        setIsTransactionFormDirty(false);
        showSuccess(`تم حذف ${clientTransactionsToDelete.length} معاملة وحفظها في قاعدة البيانات`);
      }).catch((error) => {
        console.error('Error in bulk soft delete:', error);
        // Still proceed with local soft deletion even if DB save fails
        setTransactions(prev => prev.map(t => {
          if (t.clientId === selectedClient && !t.deleted) {
            return {
              ...t,
              deleted: true,
              deletedAt: new Date().toISOString(),
              deletedBy: 'current-user',
              deletionReason: 'حذف جميع المعاملات'
            };
          }
          return t;
        }));
        setIsTransactionFormDirty(false);
        showSuccess(`تم حذف ${clientTransactionsToDelete.length} معاملة محلياً`);
      });
    }
  };

  // Calculate totals
  const totalGold = wallets.reduce((sum, wallet) =>
    sum + (wallet.balanceMg ? parseFloat(wallet.balanceMg) / 1000 : 0), 0
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col" dir="rtl">
      {showGoldVault ? (
        <GoldVaultScreen onBack={() => setShowGoldVault(false)} />
      ) : showLocalBullion ? (
        <LocalBullionScreen onBack={() => setShowLocalBullion(false)} />
      ) : showTransferScreen ? (
        <TransferScreen
          onBack={() => setShowTransferScreen(false)}
          wallets={wallets}
          selectedClient={selectedClient}
          todayPrice={todayPrice}
          onRefreshWallets={() => loadData()}
          systemUserId={systemUserId || ''}
        />
      ) : showCashVault ? (
        <CashVaultScreen onBack={() => setShowCashVault(false)} />
      ) : showClientAccount ? (
        <ClientAccountPage
          onBack={() => setShowClientAccount(false)}
          wallets={wallets}
          todayPrice={todayPrice}
          averagePrice={averagePrice}
          selectedAccountId={selectedClient}
        />
      ) : showDeletedTransactions ? (
        <DeletedTransactionsPage
          onBack={() => setShowDeletedTransactions(false)}
          showSuccess={showSuccess}
          showError={showError}
          showWarning={showWarning}
          transactions={transactions}
          setTransactions={setTransactions}
          payments={[]} // Would need to pass payments from ClientAccountTable
          setPayments={() => { }} // Would need to pass setter from ClientAccountTable  
          wallets={wallets}
        />
      ) : showBuySell ? (
        <BuySellPage
          onBack={() => setShowBuySell(false)}
          wallets={wallets}
          transactions={transactions}
          clientTransactions={clientTransactions}
          showSuccess={showSuccess}
          showError={showError}
          showWarning={showWarning}
        />
      ) : (
        <>
          {/* Row 1 */}
          <div className="grid grid-cols-12 gap-4 mb-4">
            <ControlsSection
              wallets={wallets}
              clientGroups={clientGroups}
              selectedClient={selectedClient}
              setSelectedClient={setSelectedClient}
              fromDate={fromDate}
              setFromDate={setFromDate}
              toDate={toDate}
              setToDate={setToDate}
              todayPrice={todayPrice}
              setTodayPrice={setTodayPrice}
              averagePrice={averagePrice}
              setAveragePrice={setAveragePrice}
              onAddClient={handleAddClient}
              onNewTransaction={handleNewTransaction}
              onDeleteAll={handleDeleteAll}
              isTransactionFormDirty={isTransactionFormDirty}
            />

            {/* Main Content Area */}
            <div className="col-span-6 flex flex-col h-full">
              {showGoldVault ? (
                <GoldVaultScreen onBack={() => setShowGoldVault(false)} />
              ) : (
                <>
                  <StatsCards
                    totalGold={totalGold}
                    fromDate={fromDate}
                    toDate={toDate}
                  />
                  <div className="flex-1 min-h-0">
                    <VaultOperations
                      onLocalBullionClick={() => setShowLocalBullion(true)}
                      onGoldVaultClick={() => setShowGoldVault(true)}
                      onTransferClick={() => setShowTransferScreen(true)}
                      onCashVaultClick={() => setShowCashVault(true)}
                      onClientAccountClick={() => setShowClientAccount(true)}
                    />
                  </div>
                </>
              )}
            </div>

            <PrintSection
              selectedClient={selectedClient}
              clientName={(() => {
                const selectedWallet = wallets.find(w => w.id === selectedClient);
                if (selectedWallet?.account?.owner) {
                  const owner = selectedWallet.account.owner;
                  return `${owner.firstName || ''} ${owner.lastName || ''}`.trim();
                }
                return selectedWallet?.name || 'Unknown Client';
              })()}
              transactions={clientTransactions}
              clientBalance={clientBalance || undefined}
              fromDate={fromDate}
              toDate={toDate}
            />
          </div>

          {/* Row 2 - Tables (Expandable) */}
          <div className="grid grid-cols-12 gap-4 mb-4 h-[550px] min-h-0">
            <div className="col-span-5 flex flex-col h-[550px]">
              <TransactionsTable
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                todayPrice={todayPrice}
                selectedClient={selectedClient}
                transactions={transactions}
                onSaveAll={handleSaveAllTransactions}
                onDeleteTransaction={handleDeleteTransaction}
                onSaveInvoiceChanges={handleSaveInvoiceChanges}
                onDeleteInvoiceTransaction={handleDeleteInvoiceTransaction}
                onDeleteInvoice={handleDeleteInvoice}
                showSuccess={showSuccess}
                showError={showError}
                showWarning={showWarning}
                isViewingInvoice={isViewingInvoice}
                invoiceData={selectedInvoiceData}
                onExitInvoiceView={() => {
                  setIsViewingInvoice(false);
                  setSelectedInvoiceData(null);
                }}
              />
            </div>

            <div className="col-span-7 flex flex-col h-[550px]">
              <ClientAccountTable
                wallets={wallets}
                selectedClient={selectedClient}
                todayPrice={todayPrice}
                transactions={clientTransactions}
                systemUserId={systemUserId}
                onDataChange={() => {
                  loadData();
                  if (selectedClient) loadClientTransactions(selectedClient);
                }}
                onInvoiceView={(invoiceData) => {
                  setSelectedInvoiceData(invoiceData);
                  setIsViewingInvoice(true);
                }}
                onDeleteTransaction={(deletedTransaction) => {
                  setDeletedTransactions(prev => [...prev, deletedTransaction]);
                }}
                onEditJournalEntry={async (id, newAmount, newDescription, isGold, adjustmentType) => {
                  try {
                    let finalAmount: number;
                    if (isGold) {
                      finalAmount = Math.round(newAmount * 1000); // Grams to Mg
                    } else {
                      finalAmount = Math.round(newAmount * 100); // Units to Cents
                    }

                    const username = localStorage.getItem('golden_username') || 'admin';
                    const password = window.prompt('يرجى إدخال كلمة المرور لتأكيد التعديل:');
                    if (!password) {
                      throw new Error('تم إلغاء العملية، كلمة المرور مطلوبة');
                    }

                    await apiClient.updateJournalEntry(id, {
                      amount: finalAmount,
                      description: newDescription,
                      currencyType: isGold ? 'GOLD' : 'MONEY',
                      adjustmentType: adjustmentType,
                      username: username,
                      password: password
                    });

                    showSuccess('تم تعديل سند القيد بنجاح');

                    // Refresh data
                    loadData();
                    if (selectedClient) {
                      loadClientTransactions(selectedClient);
                    }
                  } catch (error: any) {
                    const msg = error.response?.data?.message || error.message || 'خطأ في العملية';
                    showError(msg);
                    throw error;
                  }
                }}
                onDeleteJournalEntry={async (id) => {
                  try {
                    await apiClient.deleteJournalEntry(id);
                    showSuccess('تم حذف سند القيد بنجاح');

                    // Refresh data
                    loadData();
                    if (selectedClient) {
                      loadClientTransactions(selectedClient);
                    }
                  } catch (error: any) {
                    const msg = error.response?.data?.message || error.message || 'خطأ في العملية';
                    showError(msg);
                    throw error;
                  }
                }}
              />
            </div>
          </div>

          {/* Row 3 - Action Buttons (Footer) */}
          <ActionButtons
            onShowDeleted={() => setShowDeletedTransactions(true)}
            onShowBuySell={() => setShowBuySell(true)}
          />

          <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
        </>
      )}
    </div>
  );
}