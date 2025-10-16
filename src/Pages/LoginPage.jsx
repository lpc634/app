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
  const [beam, setBeam] = useState({ x: 0.15, y: 0.85 }); // defaults until measure (bottom-origin for y)
  const [impact, setImpact] = useState({ xPx: 0, yPx: 0 }); // for impact glow element

  useEffect(() => {
    const updateBeam = () => {
      const container = containerRef.current;
      const card = cardRef.current;
      if (!container || !card) return;
      const c = container.getBoundingClientRect();
      const k = card.getBoundingClientRect();
      const cw = Math.max(1, c.width);
      const ch = Math.max(1, c.height);
      // === Aim at TOP EDGE near LEFT CORNER (inside radius) ===
      const insetX = 8;  // px inside left radius
      const insetY = 4;  // px inside top border
      const targetX = (k.left - c.left) + insetX;
      const targetY = (k.top  - c.top)  + insetY;
      const clamp01 = (v) => Math.min(0.98, Math.max(0.02, v));
      const xFrac = clamp01(targetX / cw);
      // Shader uses bottom-left origin → invert Y
      const yFrac = clamp01(1 - (targetY / ch));
      setBeam({ x: xFrac, y: yFrac });
      // For impact glow element position (absolute px from container)
      setImpact({ xPx: targetX, yPx: (k.top - c.top) });
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
          horizontalSizing={0.5}
          verticalSizing={2.0}
          wispDensity={1}
          wispSpeed={15.0}
          wispIntensity={5.0}
          flowSpeed={0.35}
          flowStrength={0.25}
          fogIntensity={0.45}
          fogScale={0.3}
          fogFallSpeed={0.6}
          mouseTiltStrength={0.01}
          mouseSmoothTime={0.0}
          decay={1.1}
          falloffStart={1.2}
        />
      </div>

      {/* Reduced-motion fallback */}
      <div className="pointer-events-none absolute inset-0" style={{ mixBlendMode: 'screen' }}>
        <div className="hidden [@media_(prefers-reduced-motion:reduce)]:block absolute inset-0 bg-[radial-gradient(1200px_600px_at_10%_40%,rgba(249,115,22,0.22),transparent_60%)]" />
      </div>

      {/* Impact glow aligned to strike (non-interactive) */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${impact.xPx - 24}px`,
          top: `${impact.yPx - 10}px`,
          width: '160px',
          height: '60px',
          filter: 'blur(14px)',
          background:
            'radial-gradient(80px 30px at 24px 10px, rgba(255,122,26,0.45), rgba(255,122,26,0.18) 60%, transparent 70%)'
        }}
      />

      {/* Login card (interactive) */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <Card
          ref={cardRef}
          className="w-full max-w-md bg-v3-bg-dark/80 backdrop-blur rounded-2xl border border-[rgba(255,122,26,0.55)] shadow-[0_0_0_1px_rgba(255,122,26,0.45),0_0_56px_rgba(255,122,26,0.28)]"
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