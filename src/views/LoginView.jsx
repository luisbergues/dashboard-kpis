import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  ref, 
  set, 
  get,
  onValue,
  initError,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword 
} from '../utils/firebase';
import { useLanguage } from '../utils/LanguageContext';
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import './LoginView.css';

const DEFAULT_DESIGNERS = ['Joaquin', 'Jose', 'Luis', 'Santiago', 'Julieta', 'Andres', 'Delfina', 'Josema'];

export default function LoginView({ data }) {
  const { t, language } = useLanguage();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [designerName, setDesignerName] = useState('');
  const [signupRole, setSignupRole] = useState('engineer');
  
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allowedDesigners, setAllowedDesigners] = useState(DEFAULT_DESIGNERS);
  const [designers, setDesigners] = useState([]);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000, xPct: 0.5, yPct: 0.5 });

  useEffect(() => {
    setMousePos({ x: window.innerWidth * 0.25, y: window.innerHeight * 0.5, xPct: 0.25, yPct: 0.5 });
  }, []);

  const handleMouseMove = (e) => {
    const xPct = e.clientX / window.innerWidth;
    const yPct = e.clientY / window.innerHeight;
    setMousePos({ x: e.clientX, y: e.clientY, xPct, yPct });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: window.innerWidth * 0.25, y: window.innerHeight * 0.5, xPct: 0.25, yPct: 0.5 });
  };

  useEffect(() => {
    if (!auth && initError) {
      setError(`Firebase Initialization Error: ${initError}`);
    }
  }, []);

  // Real-time listener for allowed designers list in Firebase
  useEffect(() => {
    if (!db) return;

    const designersRef = ref(db, 'allowed_designers');
    const unsubscribe = onValue(designersRef, (snapshot) => {
      const dbVal = snapshot.val();
      if (dbVal) {
        let namesArray = [];
        if (Array.isArray(dbVal)) {
          namesArray = dbVal.filter(Boolean);
        } else if (typeof dbVal === 'object') {
          namesArray = Object.values(dbVal).filter(Boolean);
        }
        setAllowedDesigners(namesArray);
      } else {
        // Initialize Firebase with the default names if the path is empty
        try {
          set(ref(db, 'allowed_designers'), DEFAULT_DESIGNERS);
        } catch (err) {
          console.error('Failed to initialize allowed_designers in Firebase:', err);
        }
        setAllowedDesigners(DEFAULT_DESIGNERS);
      }
    }, (error) => {
      console.error('Firebase allowed_designers listener error:', error);
    });

    return () => unsubscribe();
  }, [db]);

  // Merge predefined/Firebase allowed designers with active spreadsheet designers
  useEffect(() => {
    const uniqueEngs = new Set();
    
    // Add names from Firebase (or fallback defaults)
    allowedDesigners.forEach(name => {
      if (name && name.trim() !== '') {
        uniqueEngs.add(name.trim());
      }
    });

    // Add names dynamically active in sheets
    if (data && data.priorityAnalysis) {
      data.priorityAnalysis.forEach(p => {
        if (p.eng && p.eng.trim() !== '') {
          uniqueEngs.add(p.eng.trim());
        }
      });
    }

    setDesigners(Array.from(uniqueEngs).sort());
  }, [data, allowedDesigners]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignUp && !designerName) {
      setError(t('login.validationName'));
      setLoading(false);
      return;
    }

    try {
      if (!auth) {
        throw new Error('Firebase Authentication is not configured or failed to initialize.');
      }

      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Save the user profile to Realtime Database
        if (db) {
          await set(ref(db, `users/${user.uid}`), {
            email: user.email,
            designerName: designerName,
            role: signupRole,
            createdAt: new Date().toISOString()
          });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      
      // Translate common Firebase Auth errors
      let friendlyMessage = language === 'es'
        ? 'Error en la autenticación. Por favor, verifica tus datos.'
        : 'Authentication error. Please check your credentials.';
      
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            friendlyMessage = language === 'es'
              ? 'Este correo electrónico ya está registrado. Haz clic en "Ingresar" abajo para iniciar sesión.'
              : 'This email address is already registered. Click "Sign In" below to log in.';
            break;
          case 'auth/invalid-email':
            friendlyMessage = language === 'es'
              ? 'El formato del correo electrónico no es válido.'
              : 'The email address format is invalid.';
            break;
          case 'auth/weak-password':
            friendlyMessage = language === 'es'
              ? 'La contraseña es muy débil. Debe tener al menos 6 caracteres.'
              : 'The password is too weak. It must be at least 6 characters long.';
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            friendlyMessage = language === 'es'
              ? 'Correo o contraseña incorrectos. Por favor, inténtalo de nuevo.'
              : 'Incorrect email or password. Please try again.';
            break;
          case 'auth/too-many-requests':
            friendlyMessage = language === 'es'
              ? 'Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente.'
              : 'Too many failed attempts. Your account has been temporarily locked.';
            break;
          default:
            friendlyMessage = err.message || friendlyMessage;
        }
      } else {
        friendlyMessage = err.message || friendlyMessage;
      }
      
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="login-view animate-fade-in"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        '--mouse-x': `${mousePos.x}px`,
        '--mouse-y': `${mousePos.y}px`,
        '--mouse-xp': mousePos.xPct,
        '--mouse-yp': mousePos.yPct
      }}
    >
      {/* Interactive Background Organic Glow */}
      <div className="organic-glow-container">
        <div className="organic-glow-wrapper">
          <div className="organic-glow" />
        </div>
      </div>

      {/* Floating Login Card */}
      <div className="login-container glass-card">
        <div className="login-header">
          <div className="login-brand">
            <span className="brand-logo">JL</span>
          </div>
          <h2 className="login-title">
            {isSignUp ? t('login.titleSignUp') : t('login.titleSignIn')}
          </h2>
          <p className="login-subtitle">
            {isSignUp ? t('login.subtitleSignUp') : t('login.subtitleSignIn')}
          </p>
        </div>

        {error && (
          <div className="login-error animate-fade-in">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {isSignUp && (
            <>
              <div 
                className="form-group"
                style={{ 
                  opacity: (signupRole === 'engineer' || signupRole === 'engineer_nester') ? 1 : 0.5,
                  pointerEvents: (signupRole === 'engineer' || signupRole === 'engineer_nester') ? 'auto' : 'none'
                }}
              >
                <label className="form-label">{t('login.linkDesigner')}</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <select
                    value={designerName}
                    onChange={(e) => setDesignerName(e.target.value)}
                    className="form-input form-select has-icon"
                    required={isSignUp && (signupRole === 'engineer' || signupRole === 'engineer_nester')}
                    disabled={signupRole !== 'engineer' && signupRole !== 'engineer_nester'}
                  >
                    <option value="">{t('login.selectName')}</option>
                    {designers.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('login.role')}</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <select
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value)}
                    className="form-input form-select has-icon"
                    required={isSignUp}
                  >
                    <option value="engineer">{language === 'es' ? 'Ingeniero (Engineer)' : 'Engineer'}</option>
                    <option value="administrative">{language === 'es' ? 'Administrador (Administrator)' : 'Administrative'}</option>
                    <option value="engineer_nester">{language === 'es' ? 'Ingeniero - Nester (Engineer - Nester)' : 'Engineer - Nester'}</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">{t('login.email')}</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input has-icon"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('login.password')}</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input has-icon"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {loading ? (
              <Loader2 className="spinner" size={20} />
            ) : (
              <>
                <span>{isSignUp ? t('login.btnSignUp') : t('login.btnSignIn')}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="text-muted">
            {isSignUp ? t('login.hasAccount') : t('login.noAccount')}
            <button 
              className="btn-link"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
            >
              {isSignUp ? t('login.btnSignIn') : t('login.btnSignUp')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

