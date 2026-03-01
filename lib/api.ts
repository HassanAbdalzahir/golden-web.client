import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API response interfaces
export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  description?: string;
  accountType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  owner?: Partial<User>;
  wallets?: Wallet[];
}

export interface Wallet {
  id: string;
  name: string;
  description?: string;
  currency: string;
  walletType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accountId: string;
  balanceMg?: string;
  balanceGrams?: number;
  account?: Account;
}

export interface StatementType {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  isBtc: boolean;
  isLocal?: boolean;
  purity?: number; // العيار (0-999.9)
  weight?: number; // الوزن (weight)
  wage?: number; // الاجر (wage/commission per gram)
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transfer {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  amountMg: string;
  units?: number; // عدد الوحدات - Number of units for BTC transactions
  description?: string;
  status: string;
  idempotencyKey: string;
  createdAt: string;
  completedAt?: string;
  canceledAt?: string;
  initiatedById: string;
  fromWallet?: {
    name: string;
    account?: {
      name: string;
      owner?: { firstName: string; lastName: string };
    };
  };
  toWallet?: {
    name: string;
    account?: {
      name: string;
      owner?: { firstName: string; lastName: string };
    };
  };
  initiatedBy?: {
    firstName: string;
    lastName: string;
    username: string;
  };
}

export interface Payment {
  id: string;
  walletId: string;
  paymentType: 'DEPOSIT' | 'WITHDRAWAL';
  amountMg: string;
  units?: number; // عدد الوحدات - Number of units for BTC transactions
  description: string;
  statementTypeId?: string;
  externalRef?: string;
  status: string;
  idempotencyKey?: string;
  createdAt: string;
  completedAt?: string;
  canceledAt?: string;
  initiatedById: string;
  wallet?: {
    name: string;
    account?: {
      name: string;
      owner?: { firstName: string; lastName: string };
    };
  };
  initiatedBy?: {
    firstName: string;
    lastName: string;
    username: string;
  };
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  createdAt: string;
  user?: {
    username: string;
    firstName: string;
    lastName: string;
  };
}

export interface JournalEntry {
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

export interface LedgerEntry {
  id: string;
  entryType: 'DEBIT' | 'CREDIT';
  amountMg: string; // BigInt as string
  description: string;
  referenceType: string;
  referenceId: string;
  transactionDate: string;
  createdAt: string;
  walletId: string;
  statementTypeId?: string;
  wallet?: Wallet;
  // Audit or other relations might be nested if necessary, but keep minimal for now
}

// API functions
export const apiClient = {
  // Users
  getUsers: () => api.get<User[]>('/users'),
  getUser: (id: string) => api.get<User>(`/users/${id}`),
  getSystemUser: () => api.get<User>('/users/system'),

  // Accounts
  getAccounts: (ownerId?: string) => api.get<Account[]>('/accounts', { params: { ownerId } }),
  getAccount: (id: string) => api.get<Account>(`/accounts/${id}`),
  createAccount: (data: {
    name: string;
    description?: string;
    accountType: string;
    ownerId: string;
  }) => api.post<Account>('/accounts', data),

  // Wallets
  getWallets: (accountId?: string) => api.get<Wallet[]>('/wallets', { params: { accountId } }),
  getWallet: (id: string) => api.get<Wallet>(`/wallets/${id}`),
  getWalletBalance: (walletId: string) => api.get(`/ledger/wallet/${walletId}/balance`),
  createWallet: (data: {
    name: string;
    description?: string;
    currency: string;
    walletType: string;
    accountId: string;
  }) => api.post<Wallet>('/wallets', data),

  // Transfers
  getTransfers: (userId?: string) => api.get<Transfer[]>('/transfers', { params: { userId } }),
  getAllTransfers: () => api.get<Transfer[]>('/transfers'),
  getTransfer: (id: string) => api.get<Transfer>(`/transfers/${id}`),
  createTransfer: (data: {
    fromWalletId: string;
    toWalletId: string;
    amountGrams: number;
    description?: string;
    statementTypeId?: string;
    idempotencyKey: string;
  }, userId: string) => api.post<Transfer>('/transfers', data, { params: { userId } }),
  generateIdempotencyKey: () => api.get<{ idempotencyKey: string }>('/transfers/idempotency-key'),

  // Payments
  getPayments: (userId?: string) => api.get<Payment[]>('/payments', { params: { userId } }),
  getAllPayments: () => api.get<Payment[]>('/payments'),
  getPayment: (id: string) => api.get<Payment>(`/payments/${id}`),
  createPayment: (data: {
    walletId: string;
    paymentType: 'DEPOSIT' | 'WITHDRAWAL';
    amountGrams: number;
    description: string;
    statementTypeId?: string;
    externalRef?: string;
    idempotencyKey?: string;
    units?: number;
  }, userId: string) => api.post<Payment>('/payments', data, { params: { userId } }),

  updatePayment: (id: string, data: {
    walletId?: string;
    paymentType?: 'DEPOSIT' | 'WITHDRAWAL';
    amountGrams?: number;
    description?: string;
    statementTypeId?: string;
    externalRef?: string;
    units?: number;
  }, userId: string) => api.patch<Payment>(`/payments/${id}`, data, { params: { userId } }),

  deletePayment: (id: string, userId: string) => api.delete<void>(`/payments/${id}`, { params: { userId } }),
  cancelPayment: (id: string, userId: string, reason?: string) =>
    api.post<void>(`/payments/${id}/cancel`, { reason, cancelledBy: userId }, { params: { userId } }),

  // Statement Types
  getStatementTypes: (includeInactive?: boolean) =>
    api.get<StatementType[]>('/statement-types', { params: { includeInactive } }),
  getStatementType: (id: string) => api.get<StatementType>(`/statement-types/${id}`),
  createStatementType: (data: {
    name: string;
    nameEn?: string;
    category?: string;
    isBtc?: boolean;
    isLocal?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  }) => api.post<StatementType>('/statement-types', data),
  updateStatementType: (id: string, data: {
    name?: string;
    nameEn?: string;
    category?: string;
    isBtc?: boolean;
    isLocal?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  }) => api.patch<StatementType>(`/statement-types/${id}`, data),
  deleteStatementType: (id: string) => api.delete<StatementType>(`/statement-types/${id}`),
  seedStatementTypes: () => api.post('/statement-types/seed'),

  // Audit
  getAuditHistory: (entityType: string, entityId: string) => api.get<AuditLog[]>(`/audit/entity/${entityType}/${entityId}`),

  // System
  getSystemTotals: () => api.get('/ledger/system/totals'),
  getHealth: () => api.get('/health'),

  // Deleted Transactions
  getDeletedTransactions: (params?: {
    fromDate?: string;
    toDate?: string;
    clientId?: string;
    type?: string;
  }) => api.get<any[]>('/payments/deleted', { params }),

  createDeletedTransaction: (data: {
    originalId: string;
    transactionType: string;
    clientId: string;
    clientName: string;
    barcode: string;
    description: string;
    weight: string;
    purity: string;
    fee: string;
    feeType: string;
    net21: string;
    value: string;
    notes: string;
    deletionReason: string;
    deletedBy: string;
  }) => api.post<any>('/payments/deleted', data),

  restoreTransaction: (id: string, userId: string) =>
    api.post<Payment>(`/payments/${id}/restore`, {}, { params: { userId } }),

  permanentDeleteTransaction: (id: string, userId: string) =>
    api.delete<void>(`/payments/${id}/permanent`, { params: { userId } }),

  // Journal Entries
  createJournalEntry: (data: {
    walletId: string;
    entryType: 'MANUAL_ADJUSTMENT' | 'BALANCE_CORRECTION' | 'ADMIN_OVERRIDE';
    adjustmentType: 'INCREASE' | 'DECREASE';
    currencyType: 'GOLD' | 'MONEY';
    amount: number;
    description: string;
    isLocal?: boolean;
    username: string;
    password: string;
    referenceId?: string;
  }) => api.post<JournalEntry>('/journal-entries', data),

  updateJournalEntry: (id: string, data: any) =>
    api.put<JournalEntry>(`/journal-entries/${id}`, data),

  deleteJournalEntry: (id: string) =>
    api.delete(`/journal-entries/${id}`),

  getJournalEntries: (walletId?: string, limit?: number, offset?: number) =>
    api.get<JournalEntry[]>('/journal-entries', {
      params: { walletId, limit, offset }
    }),

  getJournalEntriesByWallet: (walletId: string, limit?: number, offset?: number) =>
    api.get<JournalEntry[]>(`/journal-entries/wallet/${walletId}`, {
      params: { limit, offset }
    }),

  validateJournalPassword: (username: string, password: string) =>
    api.post<{ valid: boolean }>('/journal-entries/validate-password', { username, password }),

  // Ledger (New)
  getWalletHistory: (walletId: string, limit?: number, offset?: number) =>
    api.get<LedgerEntry[]>(`/ledger/wallet/${walletId}/history`, {
      params: { limit, offset }
    }),

  getAllLedgerHistory: (params?: { limit?: number; offset?: number; startDate?: string; endDate?: string; referenceType?: string }) =>
    api.get<LedgerEntry[]>('/ledger/history/all', { params }),
};

export default api;