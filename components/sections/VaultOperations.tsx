interface VaultOperationsProps {
  onLocalBullionClick?: () => void;
  onGoldVaultClick?: () => void;
  onTransferClick?: () => void;
  onCashVaultClick?: () => void;
  onClientAccountClick?: () => void;
}

export default function VaultOperations({ onLocalBullionClick, onGoldVaultClick, onTransferClick, onCashVaultClick, onClientAccountClick }: VaultOperationsProps) {
    return (
        <div className="h-full flex flex-row gap-4">
         

            {/* Operations Section */}
            <div className="flex-1 rounded-lg shadow p-4 flex flex-col justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="grid grid-cols-2 gap-3 w-full">
                         <button 
                             onClick={onLocalBullionClick}
                             className="bg-white shadow hover:bg-gray-50 text-black py-4 px-4 rounded text-sm"
                         >
                            منصرف السبائك
                        </button>
                        <button 
                            onClick={onTransferClick}
                            className="bg-white shadow hover:bg-gray-50 text-black py-4 px-4 rounded text-sm"
                        >
                            تحويل
                        </button>
                       
                    </div>
                    <div className="w-1/2">
                        <button 
                            onClick={onClientAccountClick}
                            className="w-full bg-white shadow hover:bg-gray-50 text-black py-4 px-4 rounded text-sm"
                        >
                            حساب عميل
                        </button>
                    </div>
                </div>
            </div>
               {/* Vault Operations Row */}
            <div className="flex-1 bg-white rounded-lg shadow p-4 flex flex-col justify-center">
                <div className="grid grid-cols-3 gap-3">
                    <button className="bg-green-800 hover:bg-green-700 text-white py-5 px-3 rounded text-sm">
                        خزنة السبائك
                    </button>
                    <button 
                        onClick={onGoldVaultClick}
                        className="bg-green-800 hover:bg-green-700 text-white py-5 px-3 rounded text-sm"
                    >
                        خزنة الذهب
                    </button>
                    <button 
                        onClick={onCashVaultClick}
                        className="bg-green-800 hover:bg-green-700 text-white py-5 px-3 rounded text-sm"
                    >
                        حركة الخزنة نقدية
                    </button>
                </div>
            </div>
        </div>
    );
}