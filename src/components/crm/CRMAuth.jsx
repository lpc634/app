import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function CRMAuth({
  crmUser,
  setCrmUser,
  showLoginModal,
  setShowLoginModal,
  isCheckingAuth,
  setIsCheckingAuth
}) {
  const [showRegister, setShowRegister] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    imap_server: 'mail.nebula.galaxywebsolutions.com',
    imap_port: '993',
    imap_email: '',
    imap_password: '',
    imap_use_ssl: true
  });
  const [registerError, setRegisterError] = useState('');
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [emailSetupForm, setEmailSetupForm] = useState({
    imap_server: 'mail.nebula.galaxywebsolutions.com',
    imap_port: '993',
    imap_email: '',
    imap_password: '',
    imap_use_ssl: true
  });
  const [emailSetupError, setEmailSetupError] = useState('');

  // Telegram state
  const [telegramLinkCode, setTelegramLinkCode] = useState(null);
  const [telegramBotUsername, setTelegramBotUsername] = useState('V3JobsBot');
  const [telegramLinked, setTelegramLinked] = useState(false);

  // Check CRM authentication on mount
  useEffect(() => {
    const checkCrmAuth = async () => {
      const token = localStorage.getItem('crm_token');

      if (!token) {
        setShowLoginModal(true);
        setIsCheckingAuth(false);
        return;
      }

      try {
        const response = await fetch('/api/crm/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const user = await response.json();
          setCrmUser(user);

          // Check if user needs to set up email
          if (!user.has_email_configured) {
            setShowEmailSetup(true);
          }

          // Check Telegram status
          checkTelegramStatus();

          setIsCheckingAuth(false);
        } else {
          // Token invalid, remove it and show login
          localStorage.removeItem('crm_token');
          setShowLoginModal(true);
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('crm_token');
        setShowLoginModal(true);
        setIsCheckingAuth(false);
      }
    };

    checkCrmAuth();
  }, [setShowLoginModal, setIsCheckingAuth, setCrmUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await fetch('/api/crm/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('crm_token', data.access_token);
        setCrmUser(data.user);
        setShowLoginModal(false);
        setLoginForm({ username: '', password: '' });

        // Check Telegram status after login
        checkTelegramStatus();

        toast.success('Logged in successfully');
      } else {
        const error = await response.json();
        setLoginError(error.error || 'Login failed');
      }
    } catch (error) {
      setLoginError('Network error - please try again');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');

    // Validate passwords match
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (registerForm.password.length < 8) {
      setRegisterError('Password must be at least 8 characters');
      return;
    }

    try {
      const response = await fetch('/api/crm/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: registerForm.username,
          email: registerForm.email,
          password: registerForm.password,
          imap_server: registerForm.imap_server,
          imap_port: parseInt(registerForm.imap_port),
          imap_email: registerForm.imap_email,
          imap_password: registerForm.imap_password,
          imap_use_ssl: registerForm.imap_use_ssl
        })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('crm_token', data.access_token);
        setCrmUser(data.user);
        setShowLoginModal(false);
        setShowRegister(false);
        toast.success('Account created successfully! Welcome to CRM.');
      } else {
        const error = await response.json();
        setRegisterError(error.error || 'Registration failed');
      }
    } catch (error) {
      setRegisterError('Network error - please try again');
    }
  };

  const handleEmailSetup = async (e) => {
    e.preventDefault();
    setEmailSetupError('');

    const token = localStorage.getItem('crm_token');

    try {
      const response = await fetch('/api/crm/auth/email-settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imap_server: emailSetupForm.imap_server,
          imap_port: parseInt(emailSetupForm.imap_port),
          imap_email: emailSetupForm.imap_email,
          imap_password: emailSetupForm.imap_password,
          imap_use_ssl: emailSetupForm.imap_use_ssl
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCrmUser(data.user);
        setShowEmailSetup(false);
        toast.success('Email settings saved successfully! You can now sync emails.');
      } else {
        const error = await response.json();
        setEmailSetupError(error.error || 'Failed to save settings');
      }
    } catch (error) {
      setEmailSetupError('Network error - please try again');
    }
  };

  const handleSkipEmailSetup = () => {
    if (confirm('You can set up email tracking later in Settings. Continue without email sync?')) {
      setShowEmailSetup(false);
    }
  };

  const handleLinkTelegram = async () => {
    const token = localStorage.getItem('crm_token');
    if (!token) {
      toast.error('Please create your account first, then link Telegram');
      return;
    }

    try {
      const response = await fetch('/api/crm/telegram/link/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setTelegramLinkCode(data.code);
        setTelegramBotUsername(data.bot_username || 'V3JobsBot');

        // Try to open Telegram automatically
        const deepLink = `tg://resolve?domain=${data.bot_username}&start=${data.code}`;

        setTimeout(() => {
          window.location.href = deepLink;
        }, 100);

        toast.success(`Code generated: ${data.code}`);
      } else {
        toast.error(data.error || 'Failed to generate link code');
      }
    } catch (error) {
      console.error('Telegram link error:', error);
      toast.error('Failed to link Telegram: ' + error.message);
    }
  };

  const checkTelegramStatus = async (showSuccessToast = false) => {
    const token = localStorage.getItem('crm_token');
    try {
      const response = await fetch('/api/crm/telegram/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTelegramLinked(data.linked);
        if (data.linked) {
          setTelegramLinkCode(null);
          if (showSuccessToast) {
            toast.success('Telegram successfully linked!');
          }
        }
      }
    } catch (error) {
      console.error('Failed to check Telegram status');
    }
  };

  // Show loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className="page-container">
        <p className="text-center text-v3-text-muted py-8">Checking authentication...</p>
      </div>
    );
  }

  // Show email setup modal for existing users without IMAP
  if (showEmailSetup && crmUser) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="dashboard-card max-w-2xl w-full">
          <h2 className="text-2xl font-bold text-v3-text-lightest mb-2">Email Configuration Required</h2>
          <p className="text-v3-text-muted mb-6">
            Set up your email to track conversations with contacts
          </p>

          <form onSubmit={handleEmailSetup} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">IMAP Server *</label>
                <input
                  type="text"
                  value={emailSetupForm.imap_server}
                  onChange={(e) => setEmailSetupForm({...emailSetupForm, imap_server: e.target.value})}
                  className="v3-input w-full"
                  placeholder="mail.yourserver.com"
                  required
                />
                <p className="text-xs text-v3-text-muted mt-1">Usually mail.yourcompany.com</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">IMAP Port *</label>
                <input
                  type="number"
                  value={emailSetupForm.imap_port}
                  onChange={(e) => setEmailSetupForm({...emailSetupForm, imap_port: e.target.value})}
                  className="v3-input w-full"
                  placeholder="993"
                  required
                />
                <p className="text-xs text-v3-text-muted mt-1">Usually 993 (SSL) or 143</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">Your Email Address *</label>
                <input
                  type="email"
                  value={emailSetupForm.imap_email}
                  onChange={(e) => setEmailSetupForm({...emailSetupForm, imap_email: e.target.value})}
                  className="v3-input w-full"
                  placeholder={`${crmUser?.username}@v3-services.com`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">Email Password *</label>
                <input
                  type="password"
                  value={emailSetupForm.imap_password}
                  onChange={(e) => setEmailSetupForm({...emailSetupForm, imap_password: e.target.value})}
                  className="v3-input w-full"
                  placeholder="Your email password"
                  required
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={emailSetupForm.imap_use_ssl}
                  onChange={(e) => setEmailSetupForm({...emailSetupForm, imap_use_ssl: e.target.checked})}
                  className="w-4 h-4"
                />
                <span className="text-sm text-v3-text-light">Use SSL/TLS (recommended)</span>
              </label>
            </div>

            {emailSetupError && (
              <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                {emailSetupError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 button-refresh"
              >
                Save Email Settings
              </button>

              <button
                type="button"
                onClick={handleSkipEmailSetup}
                className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker transition-colors"
              >
                Skip for Now
              </button>
            </div>

            <p className="text-xs text-v3-text-muted text-center">
              Your credentials are securely stored. You can update these later in Settings.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Show login/register modal if not authenticated
  if (showLoginModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="dashboard-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-v3-text-lightest mb-2">CRM Access</h2>
          <p className="text-v3-text-muted mb-6">
            {showRegister ? 'Create your personal CRM account' : 'Log in with your CRM account'}
          </p>

          {/* Tab Buttons */}
          <div className="flex gap-2 mb-6 border-b border-v3-bg-card">
            <button
              onClick={() => { setShowRegister(false); setLoginError(''); setRegisterError(''); }}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                !showRegister
                  ? 'border-v3-brand text-v3-brand'
                  : 'border-transparent text-v3-text-muted hover:text-v3-text-light'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setShowRegister(true); setLoginError(''); setRegisterError(''); }}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                showRegister
                  ? 'border-v3-brand text-v3-brand'
                  : 'border-transparent text-v3-text-muted hover:text-v3-text-light'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Login Form */}
          {!showRegister && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">Username</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  className="v3-input w-full"
                  placeholder="lance or tom"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="v3-input w-full"
                  placeholder="Your CRM password"
                  required
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                  {loginError}
                </div>
              )}

              <button type="submit" className="button-refresh w-full">
                Login to CRM
              </button>
            </form>
          )}

          {/* Registration Form */}
          {showRegister && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-v3-text-light mb-2">Username *</label>
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                    className="v3-input w-full"
                    placeholder="john_smith"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-v3-text-muted mt-1">3-50 characters, letters and numbers only</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-v3-text-light mb-2">Email Address *</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => {
                      const email = e.target.value;
                      setRegisterForm({...registerForm, email: email, imap_email: email});
                    }}
                    className="v3-input w-full"
                    placeholder="john@v3-services.com"
                    required
                  />
                  <p className="text-xs text-v3-text-muted mt-1">Used for login and email sync</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-v3-text-light mb-2">CRM Password *</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    className="v3-input w-full"
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-v3-text-light mb-2">Confirm Password *</label>
                  <input
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                    className="v3-input w-full"
                    placeholder="Re-enter password"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="border-t border-v3-bg-card pt-4 mt-4">
                <h3 className="font-medium text-v3-text-lightest mb-3">Email Configuration (for email tracking)</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-v3-text-light mb-2">IMAP Server *</label>
                    <input
                      type="text"
                      value={registerForm.imap_server}
                      onChange={(e) => setRegisterForm({...registerForm, imap_server: e.target.value})}
                      className="v3-input w-full"
                      placeholder="mail.yourserver.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-v3-text-light mb-2">IMAP Port *</label>
                    <input
                      type="number"
                      value={registerForm.imap_port}
                      onChange={(e) => setRegisterForm({...registerForm, imap_port: e.target.value})}
                      className="v3-input w-full"
                      placeholder="993"
                      required
                    />
                    <p className="text-xs text-v3-text-muted mt-1">Usually 993 (SSL) or 143</p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-v3-text-light mb-2">Email Password *</label>
                  <input
                    type="password"
                    value={registerForm.imap_password}
                    onChange={(e) => setRegisterForm({...registerForm, imap_password: e.target.value})}
                    className="v3-input w-full"
                    placeholder="Your email password"
                    required
                  />
                  <p className="text-xs text-v3-text-muted mt-1">Password for {registerForm.email || 'your email'}</p>
                </div>

                <div className="mt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={registerForm.imap_use_ssl}
                      onChange={(e) => setRegisterForm({...registerForm, imap_use_ssl: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-v3-text-light">Use SSL/TLS (recommended)</span>
                  </label>
                </div>
              </div>

              {/* Telegram Notifications Section */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <h3 className="font-medium text-v3-text-lightest mb-2">Telegram Notifications (Optional)</h3>
                <p className="text-xs text-v3-text-muted mb-3">
                  Receive task reminders via Telegram
                </p>

                {!telegramLinked && !telegramLinkCode && (
                  <button
                    type="button"
                    onClick={handleLinkTelegram}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Link Telegram Account
                  </button>
                )}

                {telegramLinkCode && !telegramLinked && (
                  <div className="p-3 bg-v3-bg-darker rounded border border-blue-600/30">
                    <p className="text-xs text-v3-text-light mb-2">
                      Code: <span className="font-mono font-bold text-blue-400 text-base">{telegramLinkCode}</span>
                    </p>
                    <p className="text-xs text-v3-text-muted mb-2">
                      Open Telegram and send: <span className="font-mono">/start {telegramLinkCode}</span> to @{telegramBotUsername}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={`tg://resolve?domain=${telegramBotUsername}&start=${telegramLinkCode}`}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Open App
                      </a>
                      <a
                        href={`https://t.me/${telegramBotUsername}?start=${telegramLinkCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
                      >
                        Web
                      </a>
                      <button
                        type="button"
                        onClick={checkTelegramStatus}
                        className="px-3 py-1.5 text-xs bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker border border-gray-600"
                      >
                        Check Status
                      </button>
                    </div>
                  </div>
                )}

                {telegramLinked && (
                  <div className="flex items-center gap-2 p-2 bg-green-600/20 border border-green-600/30 rounded">
                    <span className="text-green-400 text-sm">✓</span>
                    <span className="text-xs text-green-400">Linked successfully!</span>
                  </div>
                )}
              </div>

              {registerError && (
                <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                  {registerError}
                </div>
              )}

              <button type="submit" className="button-refresh w-full">
                Create CRM Account
              </button>

              <p className="text-xs text-v3-text-muted text-center">
                By creating an account, your email credentials are securely stored for email tracking purposes only.
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return null;
}
