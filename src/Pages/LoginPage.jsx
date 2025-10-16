import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../useAuth.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/new_logo.png';
import LaserFlow from '../components/LaserFlow';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const containerRef = useRef(null);
  const cardRef = useRef(null);
  const [beam, setBeam] = useState({ x: 0.12, y: 0.5 }); // sensible defaults until first measure

  useEffect(() => {
    const updateBeam = () => {
      const container = containerRef.current;
      const card = cardRef.current;
      if (!container || !card) return;
      const c = container.getBoundingClientRect();
      const k = card.getBoundingClientRect();
      const cw = Math.max(1, c.width);
      const ch = Math.max(1, c.height);
      // Aim at LEFT edge (x) and vertical CENTER (y) of the card
      const leftEdgeX = k.left - c.left;
      const centerYTopOrigin = (k.top - c.top) + (k.height / 2);
      // Shader uses bottom-left origin → invert Y
      const centerYBottomOrigin = ch - centerYTopOrigin;
      // Convert to [0..1] fractions with safe margins so the beam doesn't clip
      const clamp01 = (v) => Math.min(0.98, Math.max(0.02, v));
      const xFrac = clamp01(leftEdgeX / cw);
      const yFrac = clamp01(centerYBottomOrigin / ch);
      setBeam({ x: xFrac, y: yFrac });
    };
    updateBeam();
    const ro1 = new ResizeObserver(updateBeam);
    const ro2 = new ResizeObserver(updateBeam);
    if (containerRef.current) ro1.observe(containerRef.current);
    if (cardRef.current) ro2.observe(cardRef.current);
    window.addEventListener('resize', updateBeam, { passive: true });
    window.addEventListener('scroll', updateBeam, { passive: true });
    return () => {
      ro1.disconnect(); ro2.disconnect();
      window.removeEventListener('resize', updateBeam);
      window.removeEventListener('scroll', updateBeam);
    };
  }, []);

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
    <div ref={containerRef} className="relative min-h-screen w-full overflow-hidden bg-[#060010]">
      {/* LaserFlow background (non-interactive) */}
      <div className="pointer-events-none absolute inset-0">
        <LaserFlow
          className="absolute inset-0"
          color="#f97316"
          horizontalBeamOffset={beam.x}
          verticalBeamOffset={beam.y}
          flowSpeed={0.38}
          fogIntensity={0.32}
          fogScale={0.30}
          wispDensity={1.0}
          wispSpeed={15.0}
          wispIntensity={5.0}
          flowStrength={0.30}
          verticalSizing={1.85}
          horizontalSizing={0.48}
          decay={1.05}
          falloffStart={1.2}
          fogFallSpeed={0.6}
          mouseSmoothTime={0.0}
          mouseTiltStrength={0.01}
        />
      </div>

      {/* Reduced-motion fallback */}
      <div className="pointer-events-none absolute inset-0" style={{ mixBlendMode: 'screen' }}>
        <div className="hidden [@media_(prefers-reduced-motion:reduce)]:block absolute inset-0 bg-[radial-gradient(1200px_600px_at_10%_40%,rgba(249,115,22,0.22),transparent_60%)]" />
      </div>

      {/* Login card (interactive) */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <Card
          ref={cardRef}
          className="w-full max-w-md bg-v3-bg-dark/80 backdrop-blur rounded-2xl border border-[rgba(255,122,26,0.45)] shadow-[0_0_0_1px_rgba(255,122,26,0.35),0_0_48px_rgba(255,122,26,0.24)]"
        >
          <img src={logo} alt="Company Name Logo" className="mx-auto mt-8 mb-4 h-16 w-auto" />
          <CardHeader className="text-center pt-0">
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

            {/* Link to Sign Up page */}
            <div className="mt-6 text-sm text-center">
              <Link to="/signup" className="font-medium text-v3-orange hover:text-v3-orange-dark">
                  Don't have an account? Create one now
              </Link>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}