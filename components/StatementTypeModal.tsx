import { useState, useEffect } from 'react';
import { apiClient, StatementType } from '../lib/api';

interface StatementTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StatementTypeModal({ isOpen, onClose, onSuccess }: StatementTypeModalProps) {
  const [statementTypes, setStatementTypes] = useState<StatementType[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    category: 'GOLD',
    isBtc: false,
    isLocal: false,
    purity: undefined as number | undefined,
    weight: undefined as number | undefined,
    wage: undefined as number | undefined,
    sortOrder: 0
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStatementTypes();
    }
  }, [isOpen]);

  const loadStatementTypes = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getStatementTypes(true);
      setStatementTypes(response.data);
    } catch (error) {
      console.error('Failed to load statement types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setLoading(true);
      if (editingId) {
        await apiClient.updateStatementType(editingId, formData);
      } else {
        await apiClient.createStatementType(formData);
      }
      await loadStatementTypes();
      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Failed to save statement type:', error);
      alert('فشل في حفظ البيان');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (statementType: StatementType) => {
    setFormData({
      name: statementType.name,
      nameEn: statementType.nameEn || '',
      category: statementType.category,
      isBtc: statementType.isBtc,
      isLocal: statementType.isLocal || false,
      purity: statementType.purity || undefined,
      weight: statementType.weight || undefined,
      wage: statementType.wage || undefined,
      sortOrder: statementType.sortOrder
    });
    setEditingId(statementType.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا البيان؟')) return;

    try {
      setLoading(true);
      await apiClient.deleteStatementType(id);
      await loadStatementTypes();
      onSuccess();
    } catch (error) {
      console.error('Failed to delete statement type:', error);
      alert('فشل في حذف البيان');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      nameEn: '',
      category: 'GOLD',
      isBtc: false,
      isLocal: false,
      purity: undefined,
      weight: undefined,
      wage: undefined,
      sortOrder: 0
    });
    setEditingId(null);
  };

  const handleSeedDefaults = async () => {
    try {
      setLoading(true);
      await apiClient.seedStatementTypes();
      await loadStatementTypes();
      onSuccess();
    } catch (error) {
      console.error('Failed to seed defaults:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">إدارة أنواع البيان</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSeedDefaults}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            >
              إضافة الافتراضيات
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Add/Edit Form */}
        <div className="mb-6 p-4 border border-gray-200 rounded">
          <h3 className="text-lg font-semibold mb-3">
            {editingId ? 'تعديل البيان' : 'إضافة بيان جديد'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">الاسم (العربي)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-right"
                placeholder="مثال: ذهب 21"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الاسم (الانجليزي)</label>
              <input
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Example: Gold 21K"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الفئة</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
              >
                <option value="GOLD">ذهب</option>
                <option value="CRYPTO">عملة رقمية</option>
                <option value="CASH">نقد</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ترتيب الظهور</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full p-2 border border-gray-300 rounded"
                min="0"
              />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium">
                <input
                  type="checkbox"
                  checked={formData.isBtc}
                  onChange={(e) => setFormData({ ...formData, isBtc: e.target.checked })}
                  className="mr-2"
                />
                هل هو BTC؟
              </label>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium">
                <input
                  type="checkbox"
                  checked={formData.isLocal}
                  onChange={(e) => setFormData({ ...formData, isLocal: e.target.checked })}
                  className="mr-2"
                />
                سبيكة بلدي؟
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">العيار (0-999.9)</label>
              <input
                type="number"
                value={formData.purity || ''}
                onChange={(e) => setFormData({ ...formData, purity: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full p-2 border border-gray-300 rounded text-right"
                placeholder="مثال: 875"
                min="0"
                max="999.9"
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">الوزن الافتراضي</label>
              <input
                type="number"
                value={formData.weight || ''}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full p-2 border border-gray-300 rounded text-right"
                placeholder={formData.isBtc ? "مثال: 0.001" : "مثال: 10.5"}
                min="0"
                step={formData.isBtc ? "0.000001" : "0.001"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">الاجر (لكل جرام)</label>
              <input
                type="number"
                value={formData.wage || ''}
                onChange={(e) => setFormData({ ...formData, wage: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full p-2 border border-gray-300 rounded text-right"
                placeholder="مثال: 0.5"
                min="0"
                step="0.001"
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {loading ? 'جاري الحفظ...' : (editingId ? 'تحديث' : 'إضافة')}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Statement Types List */}
        <div>
          <h3 className="text-lg font-semibold mb-3">قائمة البيانات</h3>
          {loading && <p>جاري التحميل...</p>}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-right">الاسم</th>
                  <th className="border border-gray-300 p-2 text-right">الاسم الانجليزي</th>
                  <th className="border border-gray-300 p-2 text-right">الفئة</th>
                  <th className="border border-gray-300 p-2 text-center">BTC؟</th>
                  <th className="border border-gray-300 p-2 text-center">بلدي؟</th>
                  <th className="border border-gray-300 p-2 text-right">العيار</th>
                  <th className="border border-gray-300 p-2 text-right">الوزن</th>
                  <th className="border border-gray-300 p-2 text-right">الاجر</th>
                  <th className="border border-gray-300 p-2 text-right">الترتيب</th>
                  <th className="border border-gray-300 p-2 text-right">الحالة</th>
                  <th className="border border-gray-300 p-2 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {statementTypes.map((type) => (
                  <tr key={type.id} className={!type.isActive ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="border border-gray-300 p-2 text-right">{type.name}</td>
                    <td className="border border-gray-300 p-2">{type.nameEn || '-'}</td>
                    <td className="border border-gray-300 p-2 text-right">{type.category}</td>
                    <td className="border border-gray-300 p-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${type.isBtc
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-600'
                        }`}>
                        {type.isBtc ? 'نعم' : 'لا'}
                      </span>
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${type.isLocal
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                        }`}>
                        {type.isLocal ? 'نعم' : 'لا'}
                      </span>
                    </td>
                    <td className="border border-gray-300 p-2 text-right">{type.purity || '-'}</td>
                    <td className="border border-gray-300 p-2 text-right">{type.weight || '-'}</td>
                    <td className="border border-gray-300 p-2 text-right">{type.wage || '-'}</td>
                    <td className="border border-gray-300 p-2 text-center">{type.sortOrder}</td>
                    <td className="border border-gray-300 p-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${type.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {type.isActive ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleEdit(type)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(type.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {statementTypes.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="border border-gray-300 p-4 text-center text-gray-500">
                      لا توجد بيانات مسجلة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}