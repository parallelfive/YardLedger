import { useState } from 'react';
import { useAppDispatch } from '../store';
import { signIn, signUp } from '../store/authStore';
import { useTheme } from '../theme';
import DesktopStyle from './DesktopStyle';
import Icon from './Icon';
import { TareMark } from './ui';

type Mode = 'signin' | 'signup';

// Desktop-styled auth (react-native-web → react-dom). Renders on wide web
// before auth, in place of the mobile auth navigator. Wired to the same
// signIn / signUp thunks the mobile LoginScreen + RegisterScreen use — sign-up
// takes an invite code (owner/admin/worker role is baked into the code).
export default function DesktopLogin() {
  const dispatch = useAppDispatch();
  const { mode: themeMode } = useTheme();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErr(null);
    setNotice(null);
    setPassword('');
    setConfirm('');
    setInviteCode('');
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedEmail = email.trim();

    if (mode === 'signin') {
      if (!trimmedEmail || !password) {
        setErr('Enter your email and password.');
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        await dispatch(signIn({ email: trimmedEmail, password })).unwrap();
      } catch (e2) {
        setErr((e2 as Error).message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // sign-up
    const trimmedCode = inviteCode.trim().toUpperCase();
    if (!trimmedEmail || !password || !confirm || !trimmedCode) {
      setErr('Fill in every field, including your invite code.');
      return;
    }
    if (password !== confirm) {
      setErr('Passwords don’t match.');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      await dispatch(
        signUp({ email: trimmedEmail, password, inviteCode: trimmedCode })
      ).unwrap();
      // Mirror mobile: land back on sign-in with a confirmation, don't auto-auth.
      switchMode('signin');
      setNotice('Account created — sign in below to continue.');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 46,
    padding: '0 14px',
    background: 'var(--surface-2)',
    border: '1px solid var(--line)',
    borderRadius: 11,
    color: 'var(--ink)',
    fontSize: 14.5,
    fontWeight: 500,
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'var(--ink-3)',
    marginBottom: 7,
  };

  const isSignup = mode === 'signup';

  return (
    <div
      className="yl-app"
      data-theme={themeMode}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--rail)',
      }}
    >
      <DesktopStyle />
      {/* ambient brand glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--accent) 12%, transparent) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: 400,
          maxWidth: '92vw',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-lg)',
          padding: 34,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            marginBottom: 26,
          }}
        >
          <TareMark size={54} radius={15} />
          <div style={{ textAlign: 'center' }}>
            <div
              className="exp"
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: -1,
                color: 'var(--ink)',
                lineHeight: 1,
              }}
            >
              tare
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: 0.4,
                color: 'var(--ink-3)',
                marginTop: 5,
                textTransform: 'uppercase',
              }}
            >
              {isSignup ? 'Create account' : 'Yard terminal'}
            </div>
          </div>
        </div>

        <form
          onSubmit={submit}
          style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
        >
          <label style={{ display: 'block' }}>
            <div className="mono" style={labelStyle}>
              Email
            </div>
            <input
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="you@yard.com"
              autoCapitalize="none"
              autoCorrect="off"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'block' }}>
            <div className="mono" style={labelStyle}>
              Password
            </div>
            <input
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </label>

          {isSignup && (
            <>
              <label style={{ display: 'block' }}>
                <div className="mono" style={labelStyle}>
                  Confirm password
                </div>
                <input
                  type="password"
                  value={confirm}
                  onChange={(ev) => setConfirm(ev.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'block' }}>
                <div className="mono" style={labelStyle}>
                  Invite code
                </div>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(ev) =>
                    setInviteCode(ev.target.value.toUpperCase())
                  }
                  placeholder="XXXXXXXX"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  maxLength={8}
                  style={{
                    ...inputStyle,
                    fontFamily: 'var(--mono, monospace)',
                    letterSpacing: 3,
                    fontWeight: 600,
                  }}
                />
              </label>
            </>
          )}

          {notice && (
            <div
              className="mono"
              style={{ fontSize: 12, color: 'var(--accent)', lineHeight: 1.4 }}
            >
              {notice}
            </div>
          )}
          {err && (
            <div
              className="mono"
              style={{ fontSize: 12, color: 'var(--rust)', lineHeight: 1.4 }}
            >
              {err}
            </div>
          )}

          <button
            type="submit"
            className="tap focusring"
            disabled={loading}
            style={{
              marginTop: 4,
              height: 48,
              borderRadius: 12,
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: loading ? 0.6 : 1,
              boxShadow:
                '0 6px 16px color-mix(in oklab, var(--accent) 34%, transparent)',
            }}
          >
            {loading
              ? isSignup
                ? 'Creating account…'
                : 'Signing in…'
              : isSignup
                ? 'Create account'
                : 'Sign in'}
            {!loading && (
              <Icon
                name="chev"
                size={18}
                color="var(--accent-ink)"
                stroke={2.4}
              />
            )}
          </button>
        </form>

        <button
          type="button"
          className="tap"
          onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
          style={{
            width: '100%',
            marginTop: 16,
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-2)',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isSignup
            ? 'Already have an account? Sign in'
            : 'Have an invite code? Create account'}
        </button>

        <div
          className="mono"
          style={{
            fontSize: 10.5,
            color: 'var(--ink-3)',
            textAlign: 'center',
            marginTop: 14,
            lineHeight: 1.5,
          }}
        >
          {isSignup
            ? 'Invite code sets your role · staff PIN after first sign-in'
            : 'Shared counter terminal · staff PIN in after sign-in'}
        </div>
      </div>
    </div>
  );
}
