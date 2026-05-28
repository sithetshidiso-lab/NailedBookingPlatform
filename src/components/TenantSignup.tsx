import { useState } from 'react';
import { auth, db, googleProvider } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Mail, Lock, User, Palette, Globe, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

interface TenantSignupProps {
  onBack?: () => void;
  onSignupSuccess?: (slug: string) => void;
}

export function TenantSignup({ onBack, onSignupSuccess }: TenantSignupProps) {
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [slug, setSlug] = useState('');

  // Handle auto-slugification from business name
  const handleBusinessNameChange = (name: string) => {
    setBusinessName(name);
    // Convert name to a URL-safe lowercase slug format
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove non-word chars
      .replace(/[\s_-]+/g, '-')   // Replace spaces/underscores with dashes
      .replace(/^-+|-+$/g, '');   // Trim dash from beginning/end
    setSlug(generatedSlug);
  };

  const checkSlugUniqueness = async (testSlug: string): Promise<boolean> => {
    // Check direct doc ID first (since doc IDs are assigned to cleanSlug)
    const docRef = doc(db, 'tenants', testSlug);
    const docSnap = await getDoc(docRef);
    return !docSnap.exists();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessName || !ownerName || !email || !password || !slug) {
      toast.error('All fields are required.');
      return;
    }

    const cleanSlug = slug.toLowerCase().trim();
    if (cleanSlug.length < 3) {
      toast.error('Preferred slug must be at least 3 characters long.');
      return;
    }

    setLoading(true);
    try {
      // Validate unique slug
      const isUnique = await checkSlugUniqueness(cleanSlug);
      if (!isUnique) {
        toast.error('This URL handle slug is already taken. Please choose another one.');
        setLoading(false);
        return;
      }

      // 1. Authenticate or create firebase user auth
      let user;
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        user = userCred.user;
        await updateProfile(user, { displayName: ownerName });
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          // If the email is already registered, attempt to sign them in using the provided password
          toast.info('This email is already in use with Qflow. Attempting to log you in and register your business room...');
          try {
            const userCred = await signInWithEmailAndPassword(auth, email, password);
            user = userCred.user;
            if (!user.displayName && ownerName) {
              await updateProfile(user, { displayName: ownerName });
            }
          } catch (loginError: any) {
            console.error('Failed to log in existing user:', loginError);
            let errMsg = 'Failed to authenticate existing email. ';
            if (loginError.code === 'auth/wrong-password') {
              errMsg += 'The password you entered is incorrect for this registered account. Please use the correct password or enter a different email.';
            } else {
              errMsg += loginError.message || 'Please verify your password or use a different email address.';
            }
            throw new Error(errMsg);
          }
        } else {
          throw authError;
        }
      }

      // 2. Write client profile doc to tenants/{tenantId}
      const newTenantData = {
        businessName,
        ownerEmail: email,
        ownerUid: user.uid,
        slug: cleanSlug,
        logoUrl: "/logo.png",
        templateId: "default",
        plan: "pro", // Default to pro for new registrations
        createdAt: new Date().toISOString(),
        isActive: true,
        description: `Premium beauty and salon treatments by ${ownerName}. Book your style session today.`,
        phone: "+27 69 298 1893",
        address: "Johannesburg, South Africa",
        email: email,
        tagline: "Where every session feels like a breath of fresh air.",
        artistName: ownerName,
        starEndorsement: "✨ REGISTERED PARTNER",
        whatsappPhone: "27692981893"
      };

      // Set tenant profile doc
      await setDoc(doc(db, 'tenants', cleanSlug), newTenantData);

      // 3. Set global user role
      await setDoc(doc(db, 'users', user.uid), {
        email,
        name: ownerName,
        role: 'admin',
        tenantId: cleanSlug,
        lastLogin: new Date().toISOString()
      }, { merge: true });

      // 4. Set role inside tenant-scoped users collection
      await setDoc(doc(db, 'tenants', cleanSlug, 'users', user.uid), {
        email,
        name: ownerName,
        role: 'admin',
        createdAt: new Date().toISOString()
      });

      toast.success('Your business salon profile registered successfully!');
      
      if (onSignupSuccess) {
        onSignupSuccess(cleanSlug);
      } else {
        // Fallback: Redirect scoped to tenant
        window.location.href = `${window.location.origin}${window.location.pathname}?tenant=${cleanSlug}`;
      }
    } catch (error: any) {
      console.error('Error in Tenant Signup:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('This email is already in use with Qflow. Try logging in first, or register using a different email address.');
      } else {
        toast.error(error.message || 'Onboarding failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!businessName || !slug) {
      toast.error('Please enter your Business Name and Preferred URL Handle first.');
      return;
    }

    const cleanSlug = slug.toLowerCase().trim();
    if (cleanSlug.length < 3) {
      toast.error('Preferred slug must be at least 3 characters long.');
      return;
    }

    setLoading(true);
    try {
      // Validate unique slug
      const isUnique = await checkSlugUniqueness(cleanSlug);
      if (!isUnique) {
        toast.error('This URL handle slug is already taken. Please choose another one.');
        setLoading(false);
        return;
      }

      // 1. Authenticate with Google
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const resolvedOwnerName = user.displayName || ownerName || 'Salon Owner';
      const resolvedEmail = user.email || '';

      // 2. Write client profile doc to tenants/{cleanSlug}
      const newTenantData = {
        businessName,
        ownerEmail: resolvedEmail,
        ownerUid: user.uid,
        slug: cleanSlug,
        logoUrl: "/logo.png",
        templateId: "default",
        plan: "pro", // Default to pro for new registrations
        createdAt: new Date().toISOString(),
        isActive: true,
        description: `Premium beauty and salon treatments by ${resolvedOwnerName}. Book your style session today.`,
        phone: "+27 69 298 1893",
        address: "Johannesburg, South Africa",
        email: resolvedEmail,
        tagline: "Where every session feels like a breath of fresh air.",
        artistName: resolvedOwnerName,
        starEndorsement: "✨ REGISTERED PARTNER",
        whatsappPhone: "27692981893"
      };

      // Set tenant profile doc
      await setDoc(doc(db, 'tenants', cleanSlug), newTenantData);

      // 3. Set global user role
      await setDoc(doc(db, 'users', user.uid), {
        email: resolvedEmail,
        name: resolvedOwnerName,
        role: 'admin',
        tenantId: cleanSlug,
        lastLogin: new Date().toISOString()
      }, { merge: true });

      // 4. Set role inside tenant-scoped users collection
      await setDoc(doc(db, 'tenants', cleanSlug, 'users', user.uid), {
        email: resolvedEmail,
        name: resolvedOwnerName,
        role: 'admin',
        createdAt: new Date().toISOString()
      });

      toast.success('Your business salon profile registered successfully with Google!');
      
      if (onSignupSuccess) {
        onSignupSuccess(cleanSlug);
      } else {
        // Fallback: Redirect scoped to tenant
        window.location.href = `${window.location.origin}${window.location.pathname}?tenant=${cleanSlug}`;
      }
    } catch (error: any) {
      console.error('Error in Google Tenant Signup:', error);
      toast.error(error.message || 'Google onboarding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 max-w-lg mx-auto py-12 px-4 flex flex-col justify-center min-h-[80vh]">
      <Card className="border-border shadow-2xl rounded-[2.5rem] bg-card overflow-hidden">
        <CardHeader className="space-y-4 pt-10 pb-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-tr from-primary/20 to-violet-950/40 border border-primary/30 flex items-center justify-center shadow-lg">
            <Briefcase className="text-primary w-5 h-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-normal font-serif text-foreground">
              Register Your Business
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Join Qflow and expand to multi-tenant salon SaaS
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-5 px-6 sm:px-8">
          <form onSubmit={handleSignup} className="space-y-4">
            
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Business Name</Label>
              <div className="relative">
                <Palette className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. Nails by Sarah"
                  value={businessName}
                  onChange={(e) => handleBusinessNameChange(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-muted/25 border-border text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Preferred URL Handle (Slug)</Label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. sarah-nails"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="pl-10 h-11 rounded-xl bg-muted/25 border-border text-sm font-mono text-primary"
                  required
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Your custom booking channel URL will be: <span className="font-semibold text-primary">{window.location.host}/?tenant={slug || 'your-handle'}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Owner / Artist Full Name</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. Sarah Connor"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-muted/25 border-border text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Business Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="e.g. contact@sarahnails.com"
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
              {loading ? 'Registering...' : 'Build Custom Studio Space'}
            </Button>
          </form>

          <div className="relative my-4 flex items-center justify-center">
            <span className="absolute w-full border-t border-border" />
            <span className="relative bg-card px-3 text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-widest">Or register with</span>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleGoogleSignup}
            className="w-full h-11 border-border bg-background text-foreground hover:bg-muted/30 font-bold rounded-xl flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Build Studio with Google
          </Button>
        </CardContent>

        <CardFooter className="pb-8 pt-4 justify-center border-t border-border bg-muted/10">
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-primary transition-colors text-xs font-bold uppercase tracking-wider"
          >
            Cancel and Return
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
