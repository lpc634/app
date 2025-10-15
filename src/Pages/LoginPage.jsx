import { useState } from 'react';
import { useAuth } from '../useAuth.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/new_logo.png';

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="dashboard-card w-full max-w-md">
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