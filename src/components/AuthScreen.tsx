import { useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Mail, Lock, User, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { tenant } from '../tenant';
import { useTenant } from '../context/TenantContext';

interface AuthScreenProps {
  onBack?: () => void;
}

export function AuthScreen({ onBack }: AuthScreenProps) {
  const { tenantId, tenantData } = useTenant();
  const resolvedTenant = tenantData || {
    ...tenant,
    ownerEmail: "sithetshidiso@gmail.com",
    slug: tenantId,
    templateId: "default",
    plan: "pro" as const,
    createdAt: "",
    isActive: true
  };

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const isUserAdmin = user.email === 'sithetshidiso@gmail.com';
      
      // Update or create user record
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        name: user.displayName || 'Client',
        role: isUserAdmin ? 'superadmin' : 'client',
        lastLogin: new Date().toISOString()
      }, { merge: true });

      // Create client document if it doesn't exist
      if (!isUserAdmin) {
        await setDoc(doc(db, 'clients', user.uid), {
          name: user.displayName || 'Client',
          email: user.email,
          phone: '',
          notes: 'Signed up via Google'
        }, { merge: true });
      }

      toast.success('Signed in successfully with Google!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }
    if (isSignUp && !fullName) {
      toast.error('Please enter your full name for sign up.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Create user
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        await updateProfile(user, { displayName: fullName });
        const isUserAdmin = user.email === 'sithetshidiso@gmail.com';

        // Add user profile to Firestore database
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          name: fullName,
          role: isUserAdmin ? 'superadmin' : 'client',
          lastLogin: new Date().toISOString()
        }, { merge: true });

        // Add to clients collection
        if (!isUserAdmin) {
          await setDoc(doc(db, 'clients', user.uid), {
            name: fullName,
            email: email,
            phone: phone || '',
            notes: 'Registered via Email/Password'
          }, { merge: true });
        }

        toast.success('Account created successfully!');
      } else {
        // Sign in
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Welcome back!');
      }
    } catch (error: any) {
      console.error(error);
      let errorMsg = error.message || 'Authentication failed';
      if (error.code === 'auth/wrong-password') {
        errorMsg = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/user-not-found') {
        errorMsg = 'No account found with this email.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'This email is already registered. Try logging in!';
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 max-w-md mx-auto py-12 px-4 flex flex-col justify-center min-h-[70vh]">
      <Card className="border-border shadow-2xl rounded-[2.5rem] bg-card overflow-hidden">
        <CardHeader className="space-y-4 pt-10 pb-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-tr from-primary/20 to-violet-950/40 border border-primary/30 flex items-center justify-center shadow-lg animate-pulse">
            <Sparkles className="text-primary w-5 h-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-normal font-serif text-foreground">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {isSignUp ? `Join ${resolvedTenant.businessName}` : 'Access Your Personal Salon Space'}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-5 px-6 sm:px-8">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="e.g. Sarah Connor"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-muted/25 border-border text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Phone number (Optional)</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="e.g. 071 234 5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-muted/25 border-border text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="e.g. sarah@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-muted/25 border-border text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-muted/25 border-border text-sm"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground font-black text-sm rounded-xl transition-all shadow-md active:scale-95 duration-200 mt-2 hover:bg-primary/95"
            >
              {loading ? 'Processing...' : isSignUp ? 'Create Salon Profile' : 'Sign In'}
            </Button>
          </form>

          <div className="relative my-4 flex items-center justify-center">
            <span className="absolute w-full border-t border-border" />
            <span className="relative bg-card px-3 text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-widest">Or login with</span>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full h-11 border-border bg-background text-foreground hover:bg-muted/30 font-bold rounded-xl flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>
        </CardContent>

        <CardFooter className="pb-8 pt-4 justify-center border-t border-border bg-muted/10">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-muted-foreground hover:text-primary transition-colors text-xs font-bold uppercase tracking-wider"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'New to salon? Create Account'}
          </button>
        </CardFooter>
      </Card>

      {onBack && (
        <button
          onClick={onBack}
          type="button"
          className="mt-4 text-center text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
        >
          ← Go back to landing page
        </button>
      )}
    </div>
  );
}
