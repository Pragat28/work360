import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { registerUser } from '../utils/api';

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerUser(form);
      toast.success('Registration successful! Check your email to verify your account.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
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

        <div style={styles.stepsBox}>
          <p style={styles.stepsTitle}>Getting started is easy</p>
          {[
            { step: '01', title: 'Create your account', desc: 'Fill in your details and sign up' },
            { step: '02', title: 'Verify your email', desc: 'Click the link sent to your inbox' },
            { step: '03', title: 'Get role assigned', desc: 'HR Admin activates your account' },
            { step: '04', title: 'Start working', desc: 'Access your dashboard and tasks' },
          ].map((s) => (
            <div key={s.step} style={styles.stepItem}>
              <div style={styles.stepNumber}>{s.step}</div>
              <div>
                <p style={styles.stepTitle}>{s.title}</p>
                <p style={styles.stepDesc}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div style={styles.rightPanel}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Create account</h2>
            <p style={styles.cardSubtitle}>Join BFSI Edge with your company email</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Full name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Priya Sharma"
                required
                style={styles.input}
              />
            </div>

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
              <label style={styles.label}>Password</label>
              <div style={styles.inputWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min 8 characters with a number"
                  required
                  style={{ ...styles.input, paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div style={styles.passwordStrength}>
                <div style={styles.strengthBar}>
                  <div style={{
                    ...styles.strengthFill,
                    width: form.password.length === 0 ? '0%' :
                           form.password.length < 6 ? '33%' :
                           form.password.length < 8 ? '66%' : '100%',
                    background: form.password.length === 0 ? '#e2e8f0' :
                                form.password.length < 6 ? '#ef4444' :
                                form.password.length < 8 ? '#f59e0b' : '#10b981'
                  }} />
                </div>
                <span style={{
                  ...styles.strengthText,
                  color: form.password.length === 0 ? '#94a3b8' :
                         form.password.length < 6 ? '#ef4444' :
                         form.password.length < 8 ? '#f59e0b' : '#10b981'
                }}>
                  {form.password.length === 0 ? 'Enter password' :
                   form.password.length < 6 ? 'Too short' :
                   form.password.length < 8 ? 'Almost there' : 'Strong'}
                </span>
              </div>
              <span style={styles.hint}>Must be at least 8 characters and include a number</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={loading ? { ...styles.button, opacity: 0.75 } : styles.button}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>Already have an account?</span>
            <span style={styles.dividerLine} />
          </div>

          <Link to="/login" style={styles.loginBtn}>
            Sign in instead
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
    marginBottom: '48px'
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
    margin: 0
  },
  stepsBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  stepsTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: '0 0 4px 0'
  },
  stepItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px'
  },
  stepNumber: {
    width: '32px',
    height: '32px',
    minWidth: '32px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    color: '#7dd3fc'
  },
  stepTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    margin: '0 0 2px 0'
  },
  stepDesc: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    margin: 0
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
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
    letterSpacing: '0.01em'
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
  passwordStrength: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '4px'
  },
  strengthBar: {
    flex: 1,
    height: '4px',
    background: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  strengthFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s, background 0.3s'
  },
  strengthText: {
    fontSize: '12px',
    fontWeight: '500',
    minWidth: '70px'
  },
  hint: {
    fontSize: '12px',
    color: '#94a3b8'
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
    marginTop: '4px'
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
  loginBtn: {
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
