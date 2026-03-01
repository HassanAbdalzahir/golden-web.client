import { apiClient, LedgerEntry } from '../../lib/api';

interface PrintSectionProps {
  selectedClient?: string;
  clientName?: string;
  transactions?: any[];
  clientBalance?: {
    goldCredit: number;
    goldDebt: number;
    netGold: number;
    cashCredit: number;
    cashDebt: number;
    netCash: number;
  };
  fromDate?: string;
  toDate?: string;
}

export default function PrintSection({
  selectedClient,
  clientName,
  transactions = [],
  clientBalance,
  fromDate,
  toDate
}: PrintSectionProps) {

  const generateClientAccountPDF = () => {
    (async () => {
      if (!selectedClient) {
        alert('يرجى اختيار عميل أولاً');
        return;
      }

      // Fetch all wallets for the account and their histories to ensure full coverage
      try {
        const walletsRes = await apiClient.getWallets(selectedClient);
        const wallets = walletsRes.data || [];

        const promises = wallets.map((w: any) => apiClient.getWalletHistory(w.id).then(res => res.data.map((e: any) => ({ ...e, wallet: w }))));
        const results = await Promise.all(promises);
        const clientTransactions = results.flat().sort((a: any, b: any) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

        // Build HTML content with Arabic support (browser print will preserve fonts)
        const title = 'كشف حساب العميل';
        const displayClientName = clientName && clientName !== 'Unknown Client' ? clientName : `Client ID: ${selectedClient.substring(0, 8)}`;
        const periodText = fromDate && toDate ? `${fromDate} - ${toDate}` : '';

        const rows = clientTransactions.map((t: any, i: number) => {
          const date = t.transactionDate ? new Date(t.transactionDate).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG');
          const desc = t.description || t.notes || t.type || '';
          const isGold = t.wallet?.currency === 'GOLD' || t.wallet?.currency === 'XAU';
          const amount = t.amountMg ? (isGold ? (parseInt(t.amountMg) / 1000).toFixed(3) + ' جرام' : (parseInt(t.amountMg) / 100).toFixed(2)) : '';
          const reference = t.referenceId || t.externalRef || t.id || '';
          const clientInfo = t.wallet?.account?.name ? `${t.wallet.account.name} (${t.wallet.name})` : (t.wallet?.name || 'غير معروف');
          return `<tr><td>${i + 1}</td><td>${date}</td><td>${clientInfo}</td><td>${desc}</td><td>${amount}</td><td>${reference}</td></tr>`;
        }).join('');

        const html = `
          <html lang="ar" dir="rtl">
            <head>
              <meta charset="utf-8" />
              <title>${title}</title>
              <style>
                body { font-family: Alexandria, 'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background: #f3f4f6; }
              </style>
            </head>
            <body>
              <h1>${title}</h1>
              <div><strong>العميل:</strong> ${displayClientName}</div>
              <div><strong>الفترة:</strong> ${periodText}</div>
              <div><strong>تاريخ الإنشاء:</strong> ${new Date().toLocaleString('ar-EG')}</div>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>التاريخ</th>
                    <th>العميل/المحفظة</th>
                    <th>الوصف</th>
                    <th>الكمية</th>
                    <th>المرجع</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </body>
          </html>`;

        const w = window.open('', '_blank');
        if (!w) { alert('منع النافذة المنبثقة ـ الرجاء السماح بالـ popups لموقعك'); return; }
        w.document.write(html);
        w.document.close();
        w.focus();
        // Give the new window a moment to render fonts
        setTimeout(() => w.print(), 500);

      } catch (error) {
        console.error('Failed to generate client print:', error);
        alert('حدث خطأ أثناء تحميل بيانات الطباعة');
      }
    })();
  };

  const generateGlobalReportPDF = async (title: string, reportType: 'ALL' | 'TODAY' | 'JOURNAL') => {
    try {
      let params: any = { limit: 10000 };

      if (reportType === 'TODAY') {
        const today = new Date().toISOString().split('T')[0];
        params.startDate = today;
        params.endDate = today;
      } else if (reportType === 'JOURNAL') {
        params.referenceType = 'JOURNAL_ENTRY';
      }

      const response = await apiClient.getAllLedgerHistory(params);
      const entries = response.data || [];

      if (entries.length === 0) {
        alert('لا توجد بيانات لهذه الطباعة');
        return;
      }

      const rows = entries.map((e: any, i: number) => {
        const date = e.transactionDate ? new Date(e.transactionDate).toLocaleString('ar-EG') : '';
        const clientInfo = e.wallet?.account?.name ? `${e.wallet.account.name} (${e.wallet.name})` : (e.wallet?.name || 'غير معروف');
        const isGold = e.wallet?.currency === 'GOLD' || e.wallet?.currency === 'XAU';
        const amountStr = e.amountMg ? (isGold ? (parseFloat(e.amountMg.toString()) / 1000).toFixed(3) + ' جرام' : (parseFloat(e.amountMg.toString()) / 100).toFixed(2)) : '';
        const reference = `${e.referenceType} - ${e.referenceId?.substring(0, 8)}`;
        return `<tr><td>${i + 1}</td><td>${date}</td><td>${clientInfo}</td><td>${e.description || ''}</td><td>${amountStr}</td><td>${reference}</td></tr>`;
      }).join('');

      const html = `
        <html lang="ar" dir="rtl">
          <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <style>body { font-family: Alexandria, 'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; } table { width:100%; border-collapse: collapse; } th, td { border:1px solid #ddd; padding:8px; text-align: right; } th { background:#f3f4f6; }</style>
          </head>
          <body>
            <h1 style="text-align:center">${title}</h1>
            <div><strong>Generated:</strong> ${new Date().toLocaleString('ar-EG')}</div>
            <table>
              <thead>
                <tr><th>#</th><th>التاريخ</th><th>العميل/المحفظة</th><th>الوصف</th><th>الكمية</th><th>المرجع</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>`;

      const w = window.open('', '_blank');
      if (!w) { alert('منع النافذة المنبثقة ـ الرجاء السماح بالـ popups لموقعك'); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 500);

    } catch (error) {
      console.error('Error generating report:', error);
      alert('حدث خطأ أثناء تحميل البيانات وتوليد التقرير');
    }
  };

  return (
    <div className="col-span-1 flex">
      <div className=" p-2 flex-1 flex flex-col justify-between">
        <button
          className="w-full bg-blue-800 hover:bg-blue-700 text-white py-4 px-4 rounded text-sm mb-2"
          onClick={generateClientAccountPDF}
        >
          طباعة عميل
        </button>
        <button
          className="w-full bg-blue-800 hover:bg-blue-700 text-white py-4 px-4 rounded text-sm mb-2"
          onClick={() => generateGlobalReportPDF('Global Inventory Report', 'ALL')}
        >
          طباعة جرد
        </button>
        <button
          className="w-full bg-blue-800 hover:bg-blue-700 text-white py-4 px-4 rounded text-sm mb-2"
          onClick={() => generateGlobalReportPDF('Daily Report', 'TODAY')}
        >
          طباعة يومية
        </button>
        <button
          className="w-full bg-blue-800 hover:bg-blue-700 text-white py-4 px-4 rounded text-sm mb-2"
          onClick={() => generateGlobalReportPDF('Journal Entries Report', 'JOURNAL')}
        >
          طباعة سند
        </button>
      </div>
    </div>
  );
}