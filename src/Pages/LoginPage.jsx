import { useState } from 'react';
import { useAuth } from '../useAuth.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, Shield } from 'lucide-react';
import { Link } from 'react-router-dom'; // 1. Import Link
import logo from '../assets/new_logo.png';
import LaserFlow from '../components/LaserFlow';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ backgroundColor: '#060010', overflow: 'hidden' }}>
      {/* Laser Flow Frame Effect - Full screen behind card */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 1
        }}
      >
        <LaserFlow
          horizontalBeamOffset={0.0}
          verticalBeamOffset={-0.5}
          color="#FF6A2B"
          verticalSizing={6.0}
          horizontalSizing={0.5}
          fogIntensity={1.0}
          wispDensity={2.5}
          flowSpeed={0.6}
          wispSpeed={20.0}
          wispIntensity={10.0}
          fogScale={0.15}
          decay={2.0}
          falloffStart={2.0}
        />
      </div>

      <div
        className="dashboard-card w-full max-w-md relative"
        style={{
          zIndex: 10,
          border: '2px solid #FF6A2B',
          boxShadow: '0 0 30px rgba(255, 106, 43, 0.6), 0 0 60px rgba(255, 106, 43, 0.3), inset 0 0 20px rgba(255, 106, 43, 0.1)',
          animation: 'glowPulse 2s ease-in-out infinite'
        }}
      >
        <style>{`
          @keyframes glowPulse {
            0%, 100% {
              box-shadow: 0 0 30px rgba(255, 106, 43, 0.6), 0 0 60px rgba(255, 106, 43, 0.3), inset 0 0 20px rgba(255, 106, 43, 0.1);
            }
            50% {
              box-shadow: 0 0 40px rgba(255, 106, 43, 0.8), 0 0 80px rgba(255, 106, 43, 0.5), inset 0 0 30px rgba(255, 106, 43, 0.2);
            }
          }
        `}</style>
        <img src={logo} alt="Company Name Logo" className="mx-auto mb-8 h-16 w-auto" />
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-v3-text-lightest">V3 Services Portal</CardTitle>
          <CardDescription className="text-v3-text-muted">
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-v3-text-light">Email</Label>
              <Input
                id="email" type="email" placeholder="agent@test.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                required disabled={loading}
                className="bg-v3-bg-dark border-v3-border text-v3-text-lightest focus:ring-v3-orange"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-v3-text-light">Password</Label>
              <Input
                id="password" type="password" placeholder="Enter your password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                required disabled={loading}
                className="bg-v3-bg-dark border-v3-border text-v3-text-lightest focus:ring-v3-orange"
              />
            </div>

            <Button type="submit" className="w-full button-refresh" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : 'Sign In'}
            </Button>
          </form>

          {/* 2. Add the link to the Sign Up page */}
          <div className="mt-6 text-sm text-center">
            <Link to="/signup" className="font-medium text-v3-orange hover:text-v3-orange-dark">
                Don't have an account? Create one now
            </Link>
          </div>

        </CardContent>
      </div>
    </div>
  );
}