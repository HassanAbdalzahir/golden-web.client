import { useState, useEffect } from 'react';
import { apiClient, StatementType } from '../lib/api';

export function useStatementTypes() {
  const [statementTypes, setStatementTypes] = useState<StatementType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatementTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getStatementTypes();
      setStatementTypes(response.data);
    } catch (error) {
      console.error('Failed to load statement types:', error);
      setError('فشل في تحميل أنواع البيان');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatementTypes();
  }, []);

  return {
    statementTypes,
    loading,
    error,
    refresh: loadStatementTypes
  };
}