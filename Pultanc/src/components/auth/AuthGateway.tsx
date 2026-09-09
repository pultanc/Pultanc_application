import React, { useState } from 'react';
import { Mail, Lock, Play, ArrowLeft, ArrowRight, Globe, Phone, AtSign } from 'lucide-react';
import { auth, signInWithGoogle } from '../../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { LegalDrawer } from '../legal/LegalDrawer';
import { LEGAL_DOCS } from '../../data/legal';
import { ALL_COUNTRIES } from '../../countries';

export function AuthGateway() {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCountryName, setSelectedCountryName] = useState('Ghana');
  const [countryCode, setCountryCode] = useState('+233');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<'terms' | 'privacy' | null>(null);

  const handleCountryChange = (countryName: string) => {
    setSelectedCountryName(countryName);
    const found = ALL_COUNTRIES.find(c => c.name === countryName);
    if (found) {
      setCountryCode(found.dialCode);
    }
  };

  const handleStepOneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      handleFinalSubmit();
      return;
    }

    if (!isLogin) {
      if (!termsAccepted) {
        setError('You must agree to the Terms of Service and Privacy Policy to create an account.');
        return;
      }
      if (!identifier.trim() || !identifier.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setError('Password should be at least 6 characters.');
        return;
      }
    }

    // Auto-generate suggested username from email handle if empty
    if (!username.trim() && identifier.includes('@')) {
      const handle = identifier.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      setUsername(handle);
    }

    // Move to step 2 for username, country selection and phone number
    setStep(2);
  };

  const handleFinalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    let submitEmail = identifier.trim();
    if (!submitEmail.includes('@')) {
      submitEmail = `${submitEmail}@pultanc.local`;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!isLogin && !cleanUsername) {
      setError('Please enter a valid username.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, submitEmail, password);
        if (cred.user) {
          await setDoc(doc(db, 'users', cred.user.uid), {
            lastLoginAt: Date.now(),
            email: cred.user.email || submitEmail
          }, { merge: true });
        }
      } else if (googleUser) {
        // Completing Google registration (First timer)
        const cleanPhone = phoneNumber.trim();
        const fullPhone = cleanPhone ? `${countryCode}${cleanPhone}` : '';
        if (cleanUsername) {
          await updateProfile(googleUser, { displayName: cleanUsername }).catch(() => {});
        }
        // Write completely fresh profile for new user
        await setDoc(doc(db, 'users', googleUser.uid), {
          uid: googleUser.uid,
          email: googleUser.email || '',
          displayName: cleanUsername || googleUser.displayName || googleUser.email?.split('@')[0] || 'User',
          username: cleanUsername || googleUser.email?.split('@')[0] || 'user',
          country: selectedCountryName,
          countryCode: countryCode,
          phone: fullPhone,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
          isFirstTimer: true,
          balance: 0,
          totalEarnings: 0,
          unlocksCount: 0,
          supportsCount: 0,
          subscribersCount: 0,
          role: 'user',
          bio: '',
          photoURL: googleUser.photoURL || ''
        }, { merge: true });
      } else {
        // Completing Email & Password registration (First timer)
        const cleanPhone = phoneNumber.trim();
        const fullPhone = cleanPhone ? `${countryCode}${cleanPhone}` : '';
        const userCred = await createUserWithEmailAndPassword(auth, submitEmail, password);
        if (cleanUsername) {
          await updateProfile(userCred.user, { displayName: cleanUsername }).catch(() => {});
        }
        // Write completely fresh profile for new user
        await setDoc(doc(db, 'users', userCred.user.uid), {
          uid: userCred.user.uid,
          email: submitEmail,
          displayName: cleanUsername || submitEmail.split('@')[0],
          username: cleanUsername || submitEmail.split('@')[0],
          country: selectedCountryName,
          countryCode: countryCode,
          phone: fullPhone,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
          isFirstTimer: true,
          balance: 0,
          totalEarnings: 0,
          unlocksCount: 0,
          supportsCount: 0,
          subscribersCount: 0,
          role: 'user',
          bio: '',
          photoURL: userCred.user.photoURL || ''
        }, { merge: true });
      }
    } catch (err: any) {
      let msg = err.message || 'An error occurred during authentication.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid username or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-up is not enabled in Firebase Console. Please enable Email/Password provider under Authentication > Sign-in method in Firebase Console, or use Google Sign-In.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      const userDocSnap = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDocSnap.exists() || !userDocSnap.data()?.username) {
        // New Google user setup (First timer)
        setGoogleUser(result.user);
        setIsLogin(false);
        const suggested = (result.user.displayName || result.user.email?.split('@')[0] || '')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '');
        setUsername(suggested);
        setStep(2);
      } else {
        // Returning logged in user: record last login
        await setDoc(doc(db, 'users', result.user.uid), {
          lastLoginAt: Date.now()
        }, { merge: true });
      }
    } catch (err: any) {
      setError(err.message || 'Error signing in with Google.');
    } finally {
      setLoading(false);
    }
  };

  const resetMode = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setStep(1);
    setGoogleUser(null);
    setError('');
  };

  const selectedCountryObj = ALL_COUNTRIES.find(c => c.name === selectedCountryName) || ALL_COUNTRIES[0];

  return (
    <div className="min-h-screen w-full bg-white dark:bg-black text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-red-500 selection:text-white transition-colors">
      {/* Background Cinematic Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.05),transparent_50%)] pointer-events-none"/>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(156,163,175,0.08),transparent_40%)] pointer-events-none"/>
      <div className="absolute -top-[30%] -left-[20%] w-[70%] h-[70%] rounded-full bg-red-500/5 blur-[120px] pointer-events-none"/>
      <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-red-500/5 blur-[120px] pointer-events-none"/>

      <div className="relative z-10 w-full max-w-lg mb-4 text-center flex flex-col items-center">
        {/* Animated Icon Badge */}
        <div className="w-12 h-12 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl flex items-center justify-center mb-3 relative group overflow-hidden shadow-2xs">
          <div className="absolute inset-0 bg-gradient-to-tr from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
          <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-white ml-0.5"/>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
          Watch. Support. <span className="text-red-500">Unlock.</span>
        </h1>
        <p className="text-gray-600 dark:text-neutral-400 text-xs sm:text-sm max-w-sm leading-relaxed">
          Watch and unlock clips.
        </p>
      </div>

      <div id="auth-card" className="relative z-10 w-full max-w-sm bg-transparent p-2 transition-all duration-300">
        <div className="mb-3 text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
            {isLogin 
              ? 'Login' 
              : step === 1 
                ? 'Create Account' 
                : 'Setup Profile'}
          </h2>
          {(isLogin || step === 1) && (
            <p className="text-[11px] text-gray-500 dark:text-neutral-400">
              Instant monetization, all type of media purposes
            </p>
          )}
        </div>

        {error && (
          <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium leading-relaxed">
            {error}
          </div>
        )}

        {/* STEP 1 FORM */}
        {(isLogin || step === 1) && (
          <form onSubmit={handleStepOneSubmit} className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider mb-1 font-mono">
                {isLogin ? 'Email or Username' : 'Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500"/>
                <input 
                  type={isLogin ? 'text' : 'email'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 focus:border-red-500/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-600 rounded-xl pl-10 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all font-sans"
                  placeholder={isLogin ? 'Email or username' : 'you@example.com'}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider mb-1 font-mono">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500"/>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 focus:border-red-500/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-600 rounded-xl pl-10 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all font-sans"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Terms checkbox only for registration step 1 */}
            {!isLogin && (
              <div className="flex items-start gap-2 pt-0.5">
                <input 
                  type="checkbox"
                  id="gateway-terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 text-red-500 rounded border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 focus:ring-red-500 shrink-0 cursor-pointer"
                />
                <label htmlFor="gateway-terms" className="text-[10px] text-gray-600 dark:text-neutral-400 leading-snug text-left cursor-pointer select-none">
                  I agree to the{' '}
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); setActiveLegalDoc('terms'); }}
                    className="font-bold text-red-500 hover:text-red-600 underline"
                  >
                    Terms of Service
                  </button>
                  {' '}and{' '}
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); setActiveLegalDoc('privacy'); }}
                    className="font-bold text-red-500 hover:text-red-600 underline"
                  >
                    Privacy Policy
                  </button>
                  , and certify that any content I upload is my original creation.
                </label>
              </div>
            )}

            {(isLogin || termsAccepted) && (
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed mt-1 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider cursor-pointer shadow-md shadow-red-500/20"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                ) : isLogin ? (
                  <span>Login</span>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </form>
        )}

        {/* STEP 2 FORM: USERNAME (COMES FIRST) & SELECT COUNTRY & PHONE NUMBER */}
        {!isLogin && step === 2 && (
          <form onSubmit={handleFinalSubmit} className="space-y-3">
            {/* Username Field - Comes BEFORE select country */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider mb-1 font-mono flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-red-500" />
                <span>Username</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-red-500">@</span>
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  required
                  className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 focus:border-red-500/50 text-gray-900 dark:text-white rounded-xl pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all font-mono placeholder:text-gray-400 dark:placeholder:text-neutral-600"
                  placeholder="your_username"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-1">Unique handle for your profile & creator URL.</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider mb-1 font-mono flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-red-500" />
                <span>Select Country</span>
              </label>
              <div className="relative">
                <select
                  value={selectedCountryName}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 focus:border-red-500/50 text-gray-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all font-sans cursor-pointer appearance-none pr-8"
                >
                  {ALL_COUNTRIES.map((c) => (
                    <option key={c.name} value={c.name} className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white py-1">
                      {c.flag} {c.name} ({c.dialCode})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-neutral-500 text-xs">
                  ▼
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider mb-1 font-mono flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-red-500" />
                <span>Phone Number</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="bg-gray-100 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-gray-900 dark:text-white rounded-xl px-2.5 py-1.5 text-xs font-mono font-medium flex items-center gap-1.5 shrink-0 select-none">
                  <span>{selectedCountryObj.flag}</span>
                  <span className="text-red-500 font-bold">{countryCode}</span>
                </div>
                <input 
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  className="flex-1 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 focus:border-red-500/50 text-gray-900 dark:text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all font-mono placeholder:text-gray-400 dark:placeholder:text-neutral-600"
                  placeholder="e.g. 0241234567"
                />
              </div>
            </div>

            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (googleUser) {
                    setGoogleUser(null);
                  }
                  setStep(1);
                }}
                className="px-3 py-2 bg-gray-100 dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider cursor-pointer shadow-md shadow-red-500/20"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 1 Social Google Auth & Switch view links */}
        {(isLogin || step === 1) && (
          <>
            <div className="mt-3.5 flex items-center justify-between">
              <div className="h-px bg-gray-300 dark:bg-neutral-800 flex-1"></div>
              <span className="text-[10px] text-black dark:text-white font-bold uppercase tracking-widest px-2.5 font-mono">OR</span>
              <div className="h-px bg-gray-300 dark:bg-neutral-800 flex-1"></div>
            </div>

            <div className="mt-2.5">
              <button 
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white hover:bg-gray-50 dark:bg-neutral-950 dark:hover:bg-neutral-900 border border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700 text-black dark:text-white font-bold py-2 rounded-xl transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2.5 text-xs font-sans cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
            </div>

            <div className="mt-4 text-center pt-3 border-t border-gray-200 dark:border-neutral-800/60">
              <p className="text-gray-500 dark:text-neutral-400 text-xs">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button 
                  onClick={() => resetMode(!isLogin)}
                  className="ml-1.5 font-bold text-red-500 hover:text-red-600 focus:outline-none underline decoration-red-500/30 underline-offset-4 font-mono uppercase cursor-pointer"
                >
                  {isLogin ? 'Create Account' : 'Login'}
                </button>
              </p>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 text-center text-[9px] text-gray-400 dark:text-neutral-600 flex items-center justify-center gap-2 select-none">
        © 2026 Pultanc by Tuita Nouvelle Ltd
      </div>

      <LegalDrawer 
        isOpen={activeLegalDoc !== null} 
        onClose={() => setActiveLegalDoc(null)} 
        title={activeLegalDoc ? LEGAL_DOCS[activeLegalDoc].title : ''} 
        content={activeLegalDoc ? LEGAL_DOCS[activeLegalDoc].content : ''} 
      />
    </div>
  );
}

