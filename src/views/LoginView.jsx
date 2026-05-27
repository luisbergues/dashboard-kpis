import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  ref, 
  set, 
  initError,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword 
} from '../utils/firebase';
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import './LoginView.css';

export default function LoginView({ data }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [designerName, setDesignerName] = useState('');
  
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [designers, setDesigners] = useState([]);

  useEffect(() => {
    if (!auth && initError) {
      setError(`Firebase Initialization Error: ${initError}`);
    }
  }, []);

  useEffect(() => {
    if (data && data.priorityAnalysis) {
      // Extract unique designers from priorityAnalysis
      // Looks at the 'eng' field
      const uniqueEngs = new Set();
      data.priorityAnalysis.forEach(p => {
        if (p.eng && p.eng.trim() !== '') {
          uniqueEngs.add(p.eng.trim());
        }
      });
      setDesigners(Array.from(uniqueEngs).sort());
    }
  }, [data]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignUp && !designerName) {
      setError('Please select your designer name to link your profile.');
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
            createdAt: new Date().toISOString()
          });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-view animate-fade-in">
      <div className="login-container glass-card">
        <div className="login-header">
          <div className="login-brand">
            <span className="brand-logo">JL</span>
          </div>
          <h2 className="login-title">
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </h2>
          <p className="login-subtitle">
            {isSignUp ? 'Sign up to access your personalized projects' : 'Sign in to your engineering dashboard'}
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
            <div className="form-group">
              <label className="form-label">Link Designer Profile</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <select
                  value={designerName}
                  onChange={(e) => setDesignerName(e.target.value)}
                  className="form-input form-select has-icon"
                  required={isSignUp}
                >
                  <option value="">-- Select Your Name --</option>
                  {designers.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
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
            <label className="form-label">Password</label>
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
                <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="text-muted">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button 
              className="btn-link"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
