import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LoginScreen.css';

const languageCopy = {
  English: {
    greeting: 'Namaste Gujarat',
    eyebrow: 'STATEWIDE INTELLIGENCE NETWORK',
    headline: 'See more.',
    headlineAccent: 'Respond faster.',
    description: 'One secure command layer for every camera, alert and insight across the state.',
    welcome: 'WELCOME BACK',
    signInTitle: 'Sign in to command',
    signInDescription: 'Access the unified surveillance network.',
    signIn: 'Sign in',
    department: 'Department login',
    userId: 'Email / User ID',
    departmentId: 'Department ID',
    userPlaceholder: 'name@gujarat.gov.in',
    departmentPlaceholder: 'Enter department ID',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    remember: 'Remember this device',
    forgot: 'Forgot password?',
    continue: 'Continue securely',
    sso: 'Government SSO',
    policy: 'By continuing, you agree to the platform security policy.',
    welcomeVoice: 'Hello sir. Welcome to the Gujarat Surveillance Command System.',
    officerRole: 'District Command Officer',
    officerName: 'Arjun Patel',
    officerLocation: 'Gandhinagar Control Centre',
    officerStatus: 'Access granted',
    close: 'Close officer profile',
  },
  'हिंदी': {
    greeting: 'नमस्ते गुजरात', eyebrow: 'राज्यव्यापी इंटेलिजेंस नेटवर्क', headline: 'देखें अधिक।', headlineAccent: 'तेज़ प्रतिक्रिया दें।', description: 'राज्य के हर कैमरे, अलर्ट और जानकारी के लिए सुरक्षित कमांड सेंटर।', welcome: 'वापसी पर स्वागत है', signInTitle: 'कमांड में साइन इन करें', signInDescription: 'एकीकृत निगरानी नेटवर्क एक्सेस करें।', signIn: 'साइन इन', department: 'विभाग लॉगिन', userId: 'ईमेल / यूज़र आईडी', departmentId: 'विभाग आईडी', userPlaceholder: 'name@gujarat.gov.in', departmentPlaceholder: 'विभाग आईडी दर्ज करें', password: 'पासवर्ड', passwordPlaceholder: 'अपना पासवर्ड दर्ज करें', remember: 'इस डिवाइस को याद रखें', forgot: 'पासवर्ड भूल गए?', continue: 'सुरक्षित रूप से जारी रखें', sso: 'सरकारी SSO', policy: 'जारी रखकर आप सुरक्षा नीति से सहमत हैं।', welcomeVoice: 'नमस्ते सर। गुजरात सर्विलांस कमांड सिस्टम में आपका स्वागत है।', officerRole: 'जिला कमांड अधिकारी', officerName: 'अर्जुन पटेल', officerLocation: 'गांधीनगर कंट्रोल सेंटर', officerStatus: 'एक्सेस स्वीकृत', close: 'अधिकारी प्रोफाइल बंद करें',
  },
  'ગુજરાતી': {
    greeting: 'નમસ્તે ગુજરાત', eyebrow: 'રાજ્યવ્યાપી ઇન્ટેલિજન્સ નેટવર્ક', headline: 'વધુ જુઓ.', headlineAccent: 'ઝડપથી પ્રતિસાદ આપો.', description: 'રાજ્યના દરેક કેમેરા, એલર્ટ અને ઇન્સાઇટ માટે એક સુરક્ષિત કમાન્ડ લેયર.', welcome: 'ફરી સ્વાગત છે', signInTitle: 'કમાન્ડમાં સાઇન ઇન કરો', signInDescription: 'યુનિફાઇડ સર્વેલન્સ નેટવર્ક ઍક્સેસ કરો.', signIn: 'સાઇન ઇન', department: 'વિભાગ લૉગિન', userId: 'ઇમેઇલ / યુઝર ID', departmentId: 'વિભાગ ID', userPlaceholder: 'name@gujarat.gov.in', departmentPlaceholder: 'વિભાગ ID દાખલ કરો', password: 'પાસવર્ડ', passwordPlaceholder: 'તમારો પાસવર્ડ દાખલ કરો', remember: 'આ ડિવાઇસ યાદ રાખો', forgot: 'પાસવર્ડ ભૂલી ગયા?', continue: 'સુરક્ષિત રીતે આગળ વધો', sso: 'સરકારી SSO', policy: 'આગળ વધીને તમે સુરક્ષા નીતિ સાથે સંમત થાઓ છો.', welcomeVoice: 'નમસ્તે સર. ગુજરાત સર્વેલન્સ કમાન્ડ સિસ્ટમમાં તમારું સ્વાગત છે.', officerRole: 'જિલ્લા કમાન્ડ અધિકારી', officerName: 'અર્જુન પટેલ', officerLocation: 'ગાંધીનગર કંટ્રોલ સેન્ટર', officerStatus: 'ઍક્સેસ મંજૂર', close: 'અધિકારી પ્રોફાઇલ બંધ કરો',
  },
};

function LoginScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('sign-in');
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState('English');
  const [showOfficerCard, setShowOfficerCard] = useState(false);
  const [authState, setAuthState] = useState('idle');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const copy = languageCopy[language];

  useEffect(() => {
    if (authState !== 'verifying') return undefined;
    const timer = window.setTimeout(() => {
      if (userId.trim() && password.trim()) {
        setAuthState('success');
      } else {
        setAuthState('failure');
      }
    }, 1900);
    return () => window.clearTimeout(timer);
  }, [authState, password, userId]);

  const handleLogin = (event) => {
    event.preventDefault();
    setShowOfficerCard(true);
    setAuthState('verifying');
  };

  const handleSuccessfulEntry = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const announcement = new SpeechSynthesisUtterance(copy.welcomeVoice);
      announcement.lang = language === 'ગુજરાતી' ? 'gu-IN' : language === 'हिंदी' ? 'hi-IN' : 'en-IN';
      announcement.rate = 0.9;
      announcement.pitch = 0.95;
      window.speechSynthesis.speak(announcement);
    }
    navigate('/');
  };

  return (
    <main className="login-screen">
      <div className="login-atmosphere" aria-hidden="true">
        <span className="login-orb login-orb-one" />
        <span className="login-orb login-orb-two" />
        <span className="login-grid" />
      </div>

      <header className="login-header">
        <div className="login-brand">
          <span className="brand-seal" aria-hidden="true">
            <span>भारत</span><i /><small>सत्यमेव जयते</small>
          </span>
          <span><strong>Surveillance Command</strong><small>Government of Gujarat</small></span>
        </div>
        <div className="secure-status"><span className="status-dot" />Secure access</div>
      </header>

      <section className="login-layout">
        <div className="login-story">
          <span className="eyebrow">{copy.eyebrow}</span>
          <span className="regional-greeting">{copy.greeting}</span>
          <h1>{copy.headline}<br /><em>{copy.headlineAccent}</em></h1>
          <p>{copy.description}</p>
          <div className="story-metric"><strong>12,842</strong><span>connected cameras<br />across 33 districts</span></div>
          <div className="story-line" /><span className="location-label">Gandhinagar · Gujarat</span>
        </div>

        <div className="login-panel-wrap">
          <div className="login-panel">
            <div className="panel-heading"><div><span className="panel-kicker">{copy.welcome}</span><h2>{copy.signInTitle}</h2><p>{copy.signInDescription}</p></div><span className="panel-pulse" aria-label="System online" /></div>
            <div className="login-tabs" role="tablist" aria-label="Login type">
              <button type="button" className={mode === 'sign-in' ? 'active' : ''} onClick={() => setMode('sign-in')} role="tab" aria-selected={mode === 'sign-in'}>{copy.signIn}</button>
              <button type="button" className={mode === 'department' ? 'active' : ''} onClick={() => setMode('department')} role="tab" aria-selected={mode === 'department'}>{copy.department}</button>
            </div>

            <form className="login-form" onSubmit={handleLogin}>
              <label><span>{mode === 'department' ? copy.departmentId : copy.userId}</span><input type="text" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder={mode === 'department' ? copy.departmentPlaceholder : copy.userPlaceholder} /></label>
              <label><span>{copy.password}</span><div className="password-input"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.passwordPlaceholder} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
              <div className="form-options"><label className="remember-option"><input type="checkbox" /><span>{copy.remember}</span></label><button type="button" className="forgot-link">{copy.forgot}</button></div>
              <button className="login-submit" type="submit" disabled={authState === 'verifying'}>{authState === 'verifying' ? 'Verifying credentials...' : copy.continue} <span aria-hidden="true">→</span></button>
            </form>

            <div className="login-divider"><span>or continue with</span></div>
            <button type="button" className="sso-button"><span className="sso-mark">✦</span> {copy.sso}</button>
            <p className="panel-footnote">{copy.policy}</p>
          </div>
          <div className="panel-shadow" aria-hidden="true" />
        </div>
      </section>

      <footer className="login-footer">
        <div className="language-switcher" aria-label="Language selection">{['English', 'हिंदी', 'ગુજરાતી'].map((item) => <button key={item} type="button" className={language === item ? 'selected' : ''} onClick={() => setLanguage(item)}>{item}</button>)}</div>
        <span>© 2026 Gujarat State CCTV Registry & GIS Integration</span>
        <Link to="/">View dashboard preview <span aria-hidden="true">↗</span></Link>
      </footer>

      {showOfficerCard && (
        <div className="officer-overlay" role="dialog" aria-modal="true" aria-label={copy.officerRole}>
          <div className={`officer-card auth-${authState}`}>
            <button type="button" className="officer-close" onClick={() => setShowOfficerCard(false)} aria-label={copy.close}>×</button>
            <div className="officer-card-glow" aria-hidden="true" />
            <div className="auth-visual" aria-hidden="true">
              <span className="auth-orbit auth-orbit-one" />
              <span className="auth-orbit auth-orbit-two" />
              <div className="auth-lock"><span className="lock-shackle" /><span className="lock-body">{authState === 'success' ? '✓' : authState === 'failure' ? '!' : '•'}</span></div>
            </div>
            <div className="auth-copy">
              <span className="officer-kicker">{authState === 'verifying' ? 'VERIFYING IDENTITY' : authState === 'failure' ? 'ACCESS DENIED' : 'IDENTITY VERIFIED'}</span>
              <h2>{authState === 'verifying' ? 'Checking credentials...' : authState === 'failure' ? 'Credentials required' : copy.officerName}</h2>
              <p>{authState === 'verifying' ? 'Synchronising with Gujarat Command Network' : authState === 'failure' ? 'Enter your user ID and password to continue.' : copy.officerRole}</p>
              {authState === 'success' && <><div className="officer-location"><span>⌖</span>{copy.officerLocation}</div><div className="officer-stats"><span><strong>06:42</strong> last sign-in</span><span><strong>Tier 04</strong> clearance</span></div><button type="button" className="officer-enter" onClick={handleSuccessfulEntry}>Enter command centre <span>→</span></button></>}
              {authState === 'failure' && <button type="button" className="officer-retry" onClick={() => setShowOfficerCard(false)}>Try again</button>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default LoginScreen;