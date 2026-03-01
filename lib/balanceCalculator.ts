// Client Balance Calculation Utility
// Handles complex balance logic for different transaction types

export interface ClientBalance {
  goldCredit: number;    // له ذهب
  goldDebt: number;      // عليه ذهب  
  cashCredit: number;    // له نقدية
  cashDebt: number;      // عليه نقدية
  netGold: number;       // Net gold balance
  netCash: number;       // Net cash balance
}

export interface TransactionForBalance {
  id: string;
  type: string;
  amountGrams?: number;
  amountCash?: number;
  net21?: string;
  weight?: string;
  value?: string;
  price?: string;
  clientId: string;
  status?: string;
  createdAt?: string;
  description?: string;
  isInvoice?: boolean;
  invoiceItems?: any[];
}

export class ClientBalanceCalculator {
  
  static calculateBalance(transactions: TransactionForBalance[], todayPrice: number): ClientBalance {
    let goldCredit = 0;
    let goldDebt = 0;
    let cashCredit = 0;
    let cashDebt = 0;

    transactions.forEach(transaction => {
      const amount = this.getTransactionAmount(transaction);
      const cashValue = this.getCashValue(transaction, todayPrice);

      switch (transaction.type) {
        case 'بيع': // Sell: عليه نقدية + له ذهب
          cashDebt += cashValue;
          goldCredit += amount;
          break;

        case 'شراء': // Buy: عليه ذهب + له نقدية
          goldDebt += amount;
          cashCredit += cashValue;
          break;

        case 'وارد ذهب': // Gold incoming: له ذهب
          goldCredit += amount;
          break;

        case 'منصرف ذهب': // Gold outgoing: عليه ذهب
          goldDebt += amount;
          break;

        case 'وارد نقدية': // Cash incoming: له نقدية
          cashCredit += cashValue;
          break;

        case 'منصرف نقدية': // Cash outgoing: عليه نقدية
          cashDebt += cashValue;
          break;
      }
    });

    return {
      goldCredit,
      goldDebt,
      cashCredit,
      cashDebt,
      netGold: goldCredit - goldDebt,
      netCash: cashCredit - cashDebt
    };
  }

  private static getTransactionAmount(transaction: TransactionForBalance): number {
    // For gold transactions, use net21 first, then weight
    return parseFloat(transaction.net21 || transaction.weight || '0') || 
           transaction.amountGrams || 0;
  }

  private static getCashValue(transaction: TransactionForBalance, todayPrice: number): number {
    // If transaction has direct cash amount, use it
    if (transaction.amountCash) {
      return transaction.amountCash;
    }

    // If transaction has value field, use it
    if (transaction.value) {
      return parseFloat(transaction.value) || 0;
    }

    // Use transaction's saved price if available, otherwise use todayPrice
    const goldAmount = this.getTransactionAmount(transaction);
    const price = transaction.price ? parseFloat(transaction.price) : todayPrice;
    return goldAmount * price;
  }

  static formatBalance(balance: ClientBalance): {
    goldStatus: string;
    cashStatus: string;
    goldAmount: number;
    cashAmount: number;
  } {
    let goldStatus = '';
    let cashStatus = '';
    let goldAmount = 0;
    let cashAmount = 0;

    // Determine gold status
    if (balance.netGold > 0) {
      goldStatus = 'له ذهب';
      goldAmount = balance.netGold;
    } else if (balance.netGold < 0) {
      goldStatus = 'عليه ذهب';
      goldAmount = Math.abs(balance.netGold);
    } else {
      goldStatus = 'متوازن';
      goldAmount = 0;
    }

    // Determine cash status
    if (balance.netCash > 0) {
      cashStatus = 'له نقدية';
      cashAmount = balance.netCash;
    } else if (balance.netCash < 0) {
      cashStatus = 'عليه نقدية';
      cashAmount = Math.abs(balance.netCash);
    } else {
      cashStatus = 'متوازن';
      cashAmount = 0;
    }

    return {
      goldStatus,
      cashStatus,
      goldAmount,
      cashAmount
    };
  }
}