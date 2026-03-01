import Link from 'next/link';
import { ScaleIcon, CreditCardIcon, ArrowsRightLeftIcon, ChartBarSquareIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: ChartBarSquareIcon },
  { name: 'Wallets', href: '/wallets', icon: ScaleIcon },
  { name: 'Transfers', href: '/transfers', icon: ArrowsRightLeftIcon },
  { name: 'Payments', href: '/payments', icon: CreditCardIcon },
  { name: 'Statement Types', href: '/statement-types', icon: ClipboardDocumentListIcon },
];

export default function Navigation() {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-2xl font-bold text-gold-600">
                Golden
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <div className="text-sm text-gray-500">
              Demo User
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}