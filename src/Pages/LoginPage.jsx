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

  // --- Laser strike controls ---
  const STRIKE_ANCHOR = 'topLeft'; // <- change to: 'topLeft' | 'leftMid' | 'topRight' | 'rightMid' | 'center'
  const SHOW_LASER_DEBUG = false;  // set true to show the tiny orange dot at the strike
  const INSET = 8;                 // px inset from edges to avoid clipping rounded corners

  const [beam, setBeam] = useState({ x: 0.15, y: 0.15 }); // fractions [0..1]
  const [impact, setImpact] = useState({ xPx: 0, yPx: 0 });// px for marker

  useEffect(() => {
    const clamp01 = (v) => Math.min(0.98, Math.max(0.02, v));

    const getStrikeFractions = (containerRect, cardRect, anchor) => {
      const cw = Math.max(1, containerRect.width);
      const ch = Math.max(1, containerRect.height);
      const left   = cardRect.left - containerRect.left;
      const right  = cardRect.right - containerRect.left;
      const top    = cardRect.top - containerRect.top;
      const bottom = cardRect.bottom - containerRect.top;
      const midX   = left + cardRect.width  / 2;
      const midY   = top  + cardRect.height / 2;

      let xPx = midX, yPx = midY; // default center
      switch (anchor) {
        case 'topLeft':  xPx = left  + INSET; yPx = top    + INSET; break;
        case 'leftMid':  xPx = left  + INSET; yPx = midY;          break;
        case 'topRight': xPx = right - INSET; yPx = top    + INSET; break;
        case 'rightMid': xPx = right - INSET; yPx = midY;          break;
        case 'center':   default:               xPx = midX; yPx = midY; break;
      }

      // LaserFlow expects top-origin fractions (0 top → 1 bottom) in this build.
      const xFrac = clamp01(xPx / cw);
      const yFrac = clamp01(yPx / ch);
      return { xFrac, yFrac, xPx, yPx };
    };

    const updateBeam = () => {
      const container = containerRef.current;
      const card = cardRef.current;
      if (!container || !card) return;
      const c = container.getBoundingClientRect();
      const k = card.getBoundingClientRect();
      const { xFrac, yFrac, xPx, yPx } = getStrikeFractions(c, k, STRIKE_ANCHOR);
      setBeam({ x: xFrac, y: yFrac });
      setImpact({ xPx, yPx: yPx });
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
          verticalSizing={2}
          wispDensity={1}
          wispSpeed={15}
          wispIntensity={5}
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

      {/* Debug: marker shows the exact strike point (turn off after verifying) */}
      {SHOW_LASER_DEBUG && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${impact.xPx - 3}px`,
            top: `${impact.yPx - 3}px`,
            width: '6px',
            height: '6px',
            borderRadius: '999px',
            background: '#ff7a1a',
            boxShadow: '0 0 16px rgba(255,122,26,0.8)'
          }}
          aria-hidden="true"
        />
      )}

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