import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../useAuth.jsx';
import { Loader2 } from 'lucide-react';

export default function DebugPage() {
    const [debugData, setDebugData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { apiCall } = useAuth();

    const fetchDebugData = async () => {
        setLoading(true);
        setError('');
        setDebugData(null);
        try {
            const data = await apiCall('/debug/system-status');
            setDebugData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-2">System Debug Page</h1>
            <p className="text-gray-400 mb-6">This page gathers data to help diagnose the job assignment issue.</p>
            <Button onClick={fetchDebugData} disabled={loading} className="button-refresh">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Fetch Debug Status
            </Button>

            {error && (
                <div className="mt-6 p-4 rounded-md bg-red-900/50 border border-red-500/50">
                    <h3 className="text-lg font-bold text-red-400">An Error Occurred</h3>
                    <pre className="text-white text-sm whitespace-pre-wrap mt-2">{error}</pre>
                </div>
            )}

            {debugData && (
                <div className="mt-6 p-4 rounded-md bg-v3-bg-dark border border-v3-border">
                    <h3 className="text-lg font-bold text-v3-text-lightest">Database State Report</h3>
                    <pre className="text-green-400 text-sm whitespace-pre-wrap mt-2">
                        {JSON.stringify(debugData, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}