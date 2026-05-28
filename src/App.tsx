import { useState, useEffect } from 'react';
import { db, auth, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, addDoc, serverTimestamp, getDocs, writeBatch, doc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, LayoutDashboard, User as UserIcon, LogOut, Plus, Scissors, Users, CreditCard, TrendingUp, CalendarDays, Menu, X, Settings as SettingsIcon, ChevronRight, Image as ImageIcon, Sparkles, MessageCircle, Star, Activity } from 'lucide-react';
import { BookingPlatform } from './components/BookingPlatform';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { ClientPortal } from './components/ClientPortal';
import { INITIAL_SERVICES } from './constants';
import { Service, Client } from './types';
import { handleFirestoreError, OperationType } from './lib/firebase-utils';
import { motion, AnimatePresence } from 'motion/react';
import { useTenant } from './context/TenantContext';
import { tenant } from './tenant';
import { TenantSignup } from './components/TenantSignup';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { B2BLandingPage } from './components/B2BLandingPage';

type AdminTab = 'dashboard' | 'bookings' | 'calendar' | 'clients' | 'expenses' | 'services' | 'settings';

export default function App() {
  const { tenantId, tenantData, loading: tenantLoading, isNotFound } = useTenant();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isAuthPageOpen, setIsAuthPageOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(() => {
    return window.location.pathname === '/signup' || window.location.hash === '#signup';
  });
  const [isSuperadminPageOpen, setIsSuperadminPageOpen] = useState(() => {
    return window.location.pathname === '/superadmin' || window.location.hash === '#superadmin';
  });

  const resolvedTenant = tenantData || {
    ...tenant,
    ownerEmail: "sithetshidiso@gmail.com",
    slug: tenantId,
    templateId: "default",
    plan: "pro" as const,
    createdAt: "",
    isActive: true
  };

  useEffect(() => {
    if (tenantLoading) return;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsAuthPageOpen(false);
        let finalRole = 'client';

        // Check if user is sithetshidiso@gmail.com and register as superadmin
        if (currentUser.email === 'sithetshidiso@gmail.com') {
          finalRole = 'superadmin';
          try {
            await setDoc(doc(db, 'superadmin', 'sithetshidiso@gmail.com'), {
              role: 'superadmin',
              createdAt: new Date().toISOString()
            }, { merge: true });
          } catch (e) {
            console.error('Error bootstrapping superadmin collection:', e);
          }
        } else if (tenantData && tenantData.ownerEmail === currentUser.email) {
          finalRole = 'admin';
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
              const uData = userDoc.data();
              if (uData.role === 'admin' || uData.role === 'superadmin') {
                finalRole = uData.role;
              }
            }

            if (finalRole !== 'admin') {
              const tenantUserDoc = await getDoc(doc(db, 'tenants', tenantId, 'users', currentUser.uid));
              if (tenantUserDoc.exists()) {
                const tuData = tenantUserDoc.data();
                if (tuData.role === 'admin') {
                  finalRole = 'admin';
                }
              }
            }
          } catch (e) {
            console.error('Error checking user role:', e);
          }
        }

        const isUserAdmin = finalRole === 'admin' || finalRole === 'superadmin';
        setIsAdmin(isUserAdmin);
        setIsSuperadmin(finalRole === 'superadmin');
        
        // Sync user to Firestore to ensure rules work
        try {
          const syncData: any = {
            email: currentUser.email,
            name: currentUser.displayName,
            role: finalRole,
            lastLogin: new Date().toISOString()
          };
          if (tenantId) {
            syncData.tenantId = tenantId;
          }
          await setDoc(doc(db, 'users', currentUser.uid), syncData, { merge: true });
        } catch (e) {
          console.error('Error syncing user:', e);
        }
      } else {
        setIsAdmin(false);
        setIsSuperadmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantLoading, tenantId, tenantData]);

  useEffect(() => {
    const handleUrlChange = () => {
      setIsSuperadminPageOpen(window.location.pathname === '/superadmin' || window.location.hash === '#superadmin');
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  useEffect(() => {
    if (!loading && !tenantLoading && isSuperadminPageOpen) {
      if (!user || !isSuperadmin) {
        toast.error("Access denied. Redirecting to workspace...");
        setIsSuperadminPageOpen(false);
        // Redirect to /dashboard as requested
        window.history.replaceState(null, '', '/dashboard');
        window.dispatchEvent(new Event('popstate'));
      }
    }
  }, [loading, tenantLoading, isSuperadminPageOpen, isSuperadmin, user]);

  useEffect(() => {
    if (tenantLoading || !tenantId) return;

    const q = query(collection(db, 'tenants', tenantId, 'services'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const servicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
      setServices(servicesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `tenants/${tenantId}/services`);
    });

    return () => unsubscribe();
  }, [tenantLoading, tenantId]);

  useEffect(() => {
    if (tenantLoading || !tenantId) return;

    if (!isAdmin) {
      setClients([]);
      return;
    }
    const q = query(collection(db, 'tenants', tenantId, 'clients'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `tenants/${tenantId}/clients`);
    });

    return () => unsubscribe();
  }, [tenantLoading, tenantId, isAdmin]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Logged in successfully');
    } catch (error) {
      console.error(error);
      toast.error('Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error(error);
      toast.error('Logout failed');
    }
  };

  const seedServices = async () => {
    if (!isAdmin || !tenantId) return;
    try {
      const batch = writeBatch(db);
      INITIAL_SERVICES.forEach((service) => {
        const newDocRef = doc(collection(db, 'tenants', tenantId, 'services'));
        batch.set(newDocRef, service);
      });
      await batch.commit();
      toast.success('Services seeded successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to seed services');
    }
  };

  const renderAdminContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard services={services} onNavigate={setActiveTab} />;
      case 'bookings':
        return (
          <Card className="border-border shadow-sm">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-xl sm:text-2xl">Create New Appointment</CardTitle>
              <CardDescription>Manually add a booking for a client.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <BookingPlatform services={services} clients={clients} isAdmin={true} />
            </CardContent>
          </Card>
        );
      case 'calendar':
        return <AdminDashboard services={services} initialTab="calendar" onNavigate={setActiveTab} />;
      case 'clients':
        return <AdminDashboard services={services} initialTab="clients" onNavigate={setActiveTab} />;
      case 'expenses':
        return <AdminDashboard services={services} initialTab="expenses" onNavigate={setActiveTab} />;
      case 'services':
        return <AdminDashboard services={services} initialTab="services" onNavigate={setActiveTab} />;
      case 'settings':
        return <AdminDashboard services={services} initialTab="settings" onNavigate={setActiveTab} />;
      default:
        return <AdminDashboard services={services} onNavigate={setActiveTab} />;
    }
  };

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'bookings', label: 'New Booking', icon: Plus },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'expenses', label: 'Expenses', icon: TrendingUp },
    { id: 'services', label: 'Services', icon: Scissors },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-[#0e071f] to-[#1e0e3f] border border-primary/40 rounded-full mb-4 flex items-center justify-center shadow-[0_0_15px_rgba(192,132,252,0.25)]">
            <Sparkles className="text-primary w-6 h-6 animate-pulse" />
          </div>
          <p className="text-xl font-medium font-serif">{resolvedTenant.businessName}...</p>
        </div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="flex-1 min-h-screen bg-zinc-950 text-white flex flex-col justify-center items-center p-6 text-center font-sans">
        <div className="max-w-md w-full space-y-6">
          <div className="relative w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-[#1b0c3f] to-[#0e071f] border border-red-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.15)]">
            <X className="text-red-400 w-10 h-10 animate-[pulse_2s_infinite]" />
            <div className="absolute -inset-1 rounded-full border border-dashed border-red-500/10 pointer-events-none animate-[spin_60s_linear_infinite]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-normal font-serif tracking-tight text-white sm:text-5xl">
              Studio Space <span className="italic text-primary">Not Found</span>
            </h1>
            <p className="text-xs font-semibold tracking-wider uppercase text-red-400">
              404 — INVALID BUSINESS LINK
            </p>
          </div>

          <p className="text-zinc-400 text-sm leading-relaxed">
            The studio booking workspace you are looking for does not exist or has been deactivated. Double check the address handle or build your own spectacular booking portal.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => {
                window.location.href = window.location.origin;
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider rounded-full h-12 px-6 shadow-md transition-all active:scale-95 duration-200"
            >
              Default Studio Home
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsSignupOpen(true);
              }}
              className="border-white/10 hover:bg-white/5 text-white font-bold text-xs uppercase tracking-wider rounded-full h-12 px-6 transition-all"
            >
              Register Your Business
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isSignupOpen) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-[#0e071f] to-[#1e0e3f] border border-primary/40 flex items-center justify-center shadow-[0_0_15px_rgba(192,132,252,0.25)]">
              <Sparkles className="text-primary w-4.5 h-4.5 animate-pulse" />
            </div>
            <h1 className="text-xl font-normal font-serif text-foreground">Qflow Salon Platform</h1>
          </div>
          <Button variant="ghost" onClick={() => {
            setIsSignupOpen(false);
            window.location.hash = '';
          }} className="rounded-full">Go back to Booking</Button>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <TenantSignup 
            onBack={() => {
              setIsSignupOpen(false);
              window.location.hash = '';
            }}
            onSignupSuccess={(registeredSlug) => {
              setIsSignupOpen(false);
              window.location.hash = '';
              window.location.href = `${window.location.origin}${window.location.pathname}?tenant=${registeredSlug}`;
            }}
          />
        </main>
      </div>
    );
  }

  if (isSuperadminPageOpen && user && isSuperadmin) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-zinc-900/80 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-[#0e071f] to-[#1e0e3f] border border-primary/40 flex items-center justify-center shadow-[0_0_15px_rgba(192,132,252,0.25)]">
                <Sparkles className="text-primary w-4.5 h-4.5 animate-pulse" />
              </div>
              <h1 className="text-xl font-normal font-serif text-white tracking-tight flex items-center gap-2">
                Qflow <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-mono font-black uppercase tracking-widest leading-none">Super Control</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-white">{user.displayName}</p>
                <p className="text-xs text-zinc-400 font-mono">Platform Coordinator</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-zinc-400 hover:text-white rounded-full">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>
        
        <main className="flex-1 p-4 sm:p-8 lg:p-12 bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            <SuperAdminDashboard onNavigate={() => {
              setIsSuperadminPageOpen(false);
              window.history.pushState(null, '', '/');
              window.dispatchEvent(new Event('popstate'));
            }} />
          </div>
        </main>
        <Toaster position="top-center" theme="dark" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 flex flex-col">
      {/* Top Winter Promo Banner */}
      {!isAdmin && tenantId !== 'qflow-default' && (
        <div className="w-full bg-[#3b1c6e] hover:bg-[#43207c] transition-colors text-center py-2.5 px-4 text-[10px] sm:text-xs font-semibold tracking-wider text-white flex items-center justify-center gap-1.5 border-b border-violet-900/30">
          <Sparkles className="w-3.5 h-3.5 text-primary-foreground animate-pulse" />
          <span>Winter Glam, unveiled — 10% off all acrylics this season.</span>
        </div>
      )}

      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden mr-2" 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            )}
            {/* Glowing Brand Badge Accent */}
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-[#0e071f] to-[#1e0e3f] border border-primary/40 flex items-center justify-center shadow-[0_0_15px_rgba(192,132,252,0.25)] overflow-hidden">
              <Sparkles className="text-primary w-4.5 h-4.5 animate-pulse" />
              <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
            </div>
            <h1 className="text-xl font-normal tracking-tight text-foreground sm:text-2xl font-serif">
              {resolvedTenant.businessName}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {!isAdmin && tenantId !== 'qflow-default' && (
              <Button 
                variant="ghost" 
                className="hidden sm:flex text-muted-foreground hover:text-primary font-bold"
                onClick={() => setIsGalleryOpen(true)}
              >
                Gallery
              </Button>
            )}
            {user ? (
              <div className="flex items-center gap-2 sm:gap-4">
                {isSuperadmin && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsSuperadminPageOpen(true);
                      window.history.pushState(null, '', '/superadmin');
                      window.dispatchEvent(new Event('popstate'));
                    }}
                    className="rounded-full border-primary/40 h-8 text-[10px] uppercase font-black tracking-wider text-primary hover:bg-primary/10 px-3 flex items-center gap-1 shadow-[0_0_15px_rgba(192,132,252,0.15)]"
                  >
                    <Activity className="w-3.5 h-3.5 animate-[pulse_1.5s_infinite]" />
                    Control Desk
                  </Button>
                )}
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-foreground">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {isSuperadmin ? 'Super Admin' : isAdmin ? 'Administrator' : 'Client'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsSignupOpen(true)} 
                  className="hidden sm:inline-flex rounded-full border-primary/30 text-primary hover:bg-primary/5 text-xs font-bold"
                >
                  Register Business
                </Button>
                <Button onClick={() => setIsAuthPageOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-95 text-xs font-bold uppercase tracking-wider rounded-full h-10 px-5">
                  Login / Register
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {isAdmin && (
          <>
            {/* Sidebar Desktop */}
            <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-muted/30 p-4 space-y-2 overflow-y-auto">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as AdminTab)}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-bold transition-all group ${
                    activeTab === item.id 
                      ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-muted-foreground group-hover:text-primary'}`} />
                    {item.label}
                  </div>
                  {activeTab === item.id && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
              
              {services.length === 0 && (
                <div className="pt-4 mt-4 border-t border-border">
                  <Button variant="outline" onClick={seedServices} className="w-full border-primary/50 text-primary hover:bg-primary/10">
                    <Plus className="w-4 h-4 mr-2" />
                    Seed Services
                  </Button>
                </div>
              )}
            </aside>

            {/* Sidebar Mobile Overlay */}
            <AnimatePresence>
              {isSidebarOpen && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSidebarOpen(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                  />
                  <motion.aside 
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed top-0 left-0 bottom-0 w-72 bg-background border-r border-border z-50 p-6 flex flex-col lg:hidden"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                        <Scissors className="text-primary-foreground w-6 h-6" />
                      </div>
                      <h2 className="text-xl font-black text-foreground uppercase tracking-tighter">Admin Panel</h2>
                    </div>
                    
                    <nav className="flex-1 space-y-2">
                      {sidebarItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as AdminTab);
                            setIsSidebarOpen(false);
                          }}
                          className={`flex items-center justify-between w-full px-4 py-4 rounded-2xl text-base font-black transition-all ${
                            activeTab === item.id 
                              ? 'bg-primary text-white shadow-xl shadow-primary/30' 
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <item.icon className={`w-6 h-6 ${activeTab === item.id ? 'text-white' : 'text-muted-foreground'}`} />
                            {item.label}
                          </div>
                          {activeTab === item.id && <ChevronRight className="w-5 h-5" />}
                        </button>
                      ))}
                    </nav>

                    <div className="pt-6 border-t border-border">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {user?.displayName?.charAt(0)}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-bold text-foreground truncate">{user?.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">Administrator</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-rose-500">
                          <LogOut className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </motion.aside>
                </>
              )}
            </AnimatePresence>
          </>
        )}

        <main className={`flex-1 overflow-y-auto ${(!isAdmin && tenantId !== 'qflow-default') ? 'container mx-auto p-4 sm:p-8 lg:p-12' : (isAdmin ? 'p-4 sm:p-8 lg:p-12' : '')}`}>
          {isAdmin ? (
            <div className="max-w-7xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderAdminContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : isAuthPageOpen ? (
            <AuthScreen onBack={() => setIsAuthPageOpen(false)} />
          ) : tenantId === 'qflow-default' ? (
            <B2BLandingPage 
              onStartSignUp={() => setIsSignupOpen(true)}
              onLoginClick={() => setIsAuthPageOpen(true)}
            />
          ) : user ? (
            <ClientPortal 
              user={user} 
              services={services} 
              onLogout={handleLogout} 
              isGalleryOpen={isGalleryOpen}
              setIsGalleryOpen={setIsGalleryOpen}
            />
          ) : (
            <div className="max-w-4xl mx-auto space-y-12 sm:space-y-16">
              {/* Premium Hero Section matching Screenshot 1 */}
              <div className="text-center space-y-6 px-4 pt-4 sm:pt-8">
                {/* Sparkle Badge */}
                <div className="inline-flex items-center gap-1.5 px-4 h-8 bg-violet-950/40 border border-violet-800/40 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
                  <span className="text-[10px] tracking-[0.18em] font-extrabold uppercase text-[#c084fc] flex items-center gap-1.5">
                    {resolvedTenant.starEndorsement}
                  </span>
                </div>

                {/* Main Heading */}
                <h2 className="text-4xl sm:text-6xl font-normal leading-tight text-foreground tracking-tight max-w-3xl mx-auto font-serif">
                  Where every set feels like <span className="italic text-primary font-medium block sm:inline">a little magic.</span>
                </h2>

                {/* Subheading text */}
                <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                  {resolvedTenant.description}
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <a 
                    href={`https://wa.me/${resolvedTenant.whatsappPhone || '27692981893'}?text=Hi!%20I%20saw%20your%20design%20portal%20and%20I'd%20like%20to%20book%20a%20magical%20session%20on%20${resolvedTenant.businessName}.`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1ade6e] hover:bg-[#16c461] text-[#05020c] font-black text-sm rounded-full px-8 py-4 shadow-xl shadow-green-500/10 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <MessageCircle className="w-5 h-5 fill-current" />
                    Book on WhatsApp
                  </a>
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto rounded-full border-primary/30 text-primary hover:bg-primary/5 font-extrabold text-xs px-8 py-4 h-auto"
                    onClick={() => setIsGalleryOpen(true)}
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> View Gallery →
                  </Button>
                </div>

                {/* Micro Details Star Endorsement */}
                <div className="flex items-center justify-center gap-3 pt-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  <div className="flex gap-0.5 text-primary">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <span className="opacity-30">|</span>
                  <a href={`tel:${resolvedTenant.phone}`} className="hover:text-primary transition-colors font-mono tracking-wider">{resolvedTenant.phone}</a>
                </div>
              </div>

              {/* Meet the Artist Section matching Screenshot 2 */}
              <div className="bg-gradient-to-tr from-card/30 via-card/50 to-violet-950/20 border border-border/40 p-6 sm:p-10 rounded-[2.5rem] space-y-6 sm:space-y-8 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full filter blur-3xl pointer-events-none" />
                <div className="space-y-2">
                  <span className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-[0.2em] block font-mono">MEET THE ARTIST</span>
                  <h3 className="text-3xl sm:text-4xl font-normal font-serif text-foreground">
                    Hi, I'm <span className="italic text-primary">{resolvedTenant.artistName}.</span>
                  </h3>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-2xl font-medium">
                  I treat every set like a tiny piece of magic — clean prep, healthy nails and designs you’ll actually want to show off. From a soft natural look to full-on glitter, foils and 3D drama, I build it with you in the chair, right here in the styling lounge.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {['Healthy prep', 'Long-lasting wear', 'Custom designs', 'Cozy studio vibe'].map((feature) => (
                    <span key={feature} className="px-4 py-1.5 rounded-full border border-border/60 bg-muted/20 text-xs font-bold text-muted-foreground select-none">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Decorative Portfolio Seal matching Screenshot 3 */}
              <div className="flex flex-col items-center justify-center space-y-4 pt-4">
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-tr from-[#05020c] via-[#0d0621] to-[#1c0d48] border border-primary/20 flex flex-col items-center justify-center p-6 text-center shadow-[0_0_35px_rgba(192,132,252,0.15)] group overflow-hidden select-none">
                  <div className="absolute inset-0 bg-radial-gradient from-primary/15 via-transparent to-transparent opacity-80 pointer-events-none group-hover:scale-110 transition-transform duration-700" />
                  <Sparkles className="w-6 h-6 text-primary mb-1.5 animate-[pulse_3s_infinite]" />
                  <span className="text-[9px] tracking-[0.2em] font-black text-primary/50 uppercase">THE PORTFOLIO</span>
                  <h4 className="text-base sm:text-lg font-normal font-serif text-foreground mt-0.5 leading-tight">
                    {resolvedTenant.businessName}
                  </h4>
                  <div className="absolute inset-2 rounded-full border border-dashed border-primary/10 pointer-events-none animate-[spin_100s_linear_infinite]" />
                </div>
              </div>

              {/* Content Grid & Scheduler Section */}
              <div id="gallery" className="px-0 sm:px-4 space-y-6">
                <div className="text-center space-y-2 pb-2">
                  <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Interactive Scheduler</h3>
                  <p className="text-muted-foreground font-medium text-xs sm:text-sm">Select services from our menu, choose a safe slot, and finalize your booking instantly.</p>
                </div>
                <BookingPlatform 
                  services={services} 
                  clients={clients} 
                  isAdmin={false} 
                  isGalleryOpen={isGalleryOpen} 
                  setIsGalleryOpen={setIsGalleryOpen} 
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {!isAdmin && tenantId !== 'qflow-default' && (
        <footer className="border-t border-border py-8 sm:py-12 mt-12 sm:mt-20">
          <div className="container mx-auto px-4 text-center space-y-4">
            <p className="text-muted-foreground text-sm font-medium">© 2026 {resolvedTenant.businessName}. All rights reserved.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-6 text-muted-foreground text-xs font-semibold uppercase tracking-widest">
              <span>{resolvedTenant.phone}</span>
              <span className="hidden sm:inline">•</span>
              <span>{resolvedTenant.address}</span>
            </div>
          </div>
        </footer>
      )}
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}
