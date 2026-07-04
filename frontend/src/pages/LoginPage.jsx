import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginUser } from '../utils/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginUser(form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success('Welcome back!');
      const role = res.data.user.role;
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');

      if (redirect) navigate(redirect);
      else if (role === 'hr_admin') navigate('/hr/dashboard');
      else if (role === 'manager') navigate('/manager/dashboard');
      else if (role === 'employee') navigate('/employee/dashboard');
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      if (errorMessage.includes('pending')) {
        toast('⏳ Your account is pending approval — HR Admin will assign your role and notify you by email!', {
          duration: 5000, icon: '⏳'
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

  const EyeOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  return (
    <div style={styles.page}>
      {/* Left Panel */}
      <div style={styles.leftPanel}>
        <div style={styles.brandSection}>
          <div style={styles.logoBox}>
            <span style={styles.logoText}>B</span>
          </div>
          <h1 style={styles.brandName}>BFSI Edge</h1>
          <p style={styles.brandTagline}>Enterprise Project Tracking Portal</p>
        </div>
        <div style={styles.featureList}>
          {['Role-based access control', 'Real-time project tracking', 'Automated email notifications', 'Performance analytics'].map((f) => (
            <div key={f} style={styles.featureItem}>
              <div style={styles.featureCheck}>✓</div>
              <span style={styles.featureText}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div style={styles.rightPanel}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Sign in</h2>
            <p style={styles.cardSubtitle}>Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email address</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@bfsiedge.com"
                required
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Password</label>
                <Link to="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
              </div>
              <div style={styles.inputWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  style={{...styles.input, paddingRight: '44px'}}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={loading ? { ...styles.button, opacity: 0.75 } : styles.button}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>New to BFSI Edge?</span>
            <span style={styles.dividerLine} />
          </div>

          <Link to="/signup" style={styles.signupBtn}>
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  leftPanel: {
    flex: 1,
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1a56db 100%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '60px'
  },
  brandSection: {
    marginBottom: '60px'
  },
  logoBox: {
    width: '56px',
    height: '56px',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    border: '1px solid rgba(255,255,255,0.2)'
  },
  logoText: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#ffffff'
  },
  brandName: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#ffffff',
    margin: '0 0 12px 0',
    letterSpacing: '-0.5px'
  },
  brandTagline: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.65)',
    margin: 0,
    lineHeight: '1.5'
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '4px 0'
  },
  featureCheck: {
    width: '24px',
    height: '24px',
    minWidth: '24px',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: '#7dd3fc',
    flexShrink: 0
  },
  featureText: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.8)'
  },
  rightPanel: {
    width: '480px',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 32px'
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
  },
  cardHeader: {
    marginBottom: '32px'
  },
  cardTitle: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 8px 0',
    letterSpacing: '-0.3px'
  },
  cardSubtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px'
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
    letterSpacing: '0.01em'
  },
  forgotLink: {
    fontSize: '13px',
    color: '#1a56db',
    textDecoration: 'none',
    fontWeight: '500'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#0f172a',
    background: '#f8fafc',
    outline: 'none',
    boxSizing: 'border-box'
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  button: {
    background: 'linear-gradient(135deg, #1a56db, #1e40af)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '13px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
    letterSpacing: '0.01em'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '24px 0'
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: '#e2e8f0'
  },
  dividerText: {
    fontSize: '13px',
    color: '#94a3b8',
    whiteSpace: 'nowrap'
  },
  signupBtn: {
    display: 'block',
    textAlign: 'center',
    padding: '12px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    textDecoration: 'none',
    background: '#ffffff'
  }
};
