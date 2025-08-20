import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';

const VersionBadge = () => {
  const { apiCall } = useAuth();
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await apiCall('/__version');
        setVersion(response.git);
      } catch (error) {
        console.error('Failed to fetch version:', error);
        setVersion('unknown');
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
  }, [apiCall]);

  if (loading) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-v3-bg-dark border border-v3-border rounded-lg px-3 py-2 text-xs text-v3-text-muted">
        <span className="font-mono">
          {version ? `v${version}` : 'dev'}
        </span>
      </div>
    </div>
  );
};

export default VersionBadge;