import { useState, useEffect } from 'react';
import { db, auth, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, addDoc, serverTimestamp, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, LayoutDashboard, User as UserIcon, LogOut, Plus, Scissors, Users, CreditCard, TrendingUp, CalendarDays, Menu, X, Settings as SettingsIcon, ChevronRight, Image as ImageIcon, Sparkles, MessageCircle, Star } from 'lucide-react';
import { BookingPlatform } from './components/BookingPlatform';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { ClientPortal } from './components/ClientPortal';
import { INITIAL_SERVICES } from './constants';
import { Service, Client } from './types';
import { handleFirestoreError, OperationType } from './lib/firebase-utils';
import { motion, AnimatePresence } from 'motion/react';

type AdminTab = 'dashboard' | 'bookings' | 'calendar' | 'clients' | 'expenses' | 'services' | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isAuthPageOpen, setIsAuthPageOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const isUserAdmin = user.email === 'neshbabe123naledi@gmail.com';
        setIsAdmin(isUserAdmin);
        setIsAuthPageOpen(false);
        
        // Sync user to Firestore to ensure rules work
        try {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            name: user.displayName,
            role: isUserAdmin ? 'admin' : 'client',
            lastLogin: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error('Error syncing user:', e);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'services'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const servicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
      setServices(servicesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setClients([]);
      return;
    }
    const q = query(collection(db, 'clients'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
    });

    return () => unsubscribe();
  }, [isAdmin]);

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
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      INITIAL_SERVICES.forEach((service) => {
        const newDocRef = doc(collection(db, 'services'));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-purple-600 rounded-full mb-4"></div>
          <p className="text-xl font-medium">Nailed By Nesh...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 flex flex-col">
      {/* Top Winter Promo Banner */}
      {!isAdmin && (
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
              Nailed By Nesh
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {!isAdmin && (
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
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-foreground">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{isAdmin ? 'Administrator' : 'Client'}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsAuthPageOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-95 text-xs font-bold uppercase tracking-wider rounded-full h-10 px-5">
                Login / Register
              </Button>
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

        <main className={`flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12 ${!isAdmin ? 'container mx-auto' : ''}`}>
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
                    ✨ THE NAIL MAGICIAN · EDENVALE
                  </span>
                </div>

                {/* Main Heading */}
                <h2 className="text-4xl sm:text-6xl font-normal leading-tight text-foreground tracking-tight max-w-3xl mx-auto font-serif">
                  Where every set feels like <span className="italic text-primary font-medium block sm:inline">a little spell.</span>
                </h2>

                {/* Subheading text */}
                <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                  Hand-crafted gel, acrylic and custom nail art by Nesh — designed to make your hands the most enchanting thing in the room.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <a 
                    href="https://wa.me/27692981893?text=Hi%20Nesh!%20I%20saw%20your%20design%20portal%20and%20I'd%20like%20to%20book%20a%20magical%20nail%20session." 
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
                  <a href="tel:0692981893" className="hover:text-primary transition-colors font-mono tracking-wider">069 298 1893</a>
                </div>
              </div>

              {/* Meet the Artist Section matching Screenshot 2 */}
              <div className="bg-gradient-to-tr from-card/30 via-card/50 to-violet-950/20 border border-border/40 p-6 sm:p-10 rounded-[2.5rem] space-y-6 sm:space-y-8 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full filter blur-3xl pointer-events-none" />
                <div className="space-y-2">
                  <span className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-[0.2em] block font-mono">MEET THE ARTIST</span>
                  <h3 className="text-3xl sm:text-4xl font-normal font-serif text-foreground">
                    Hi, I'm <span className="italic text-primary">Nesh.</span>
                  </h3>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-2xl font-medium">
                  I treat every set like a tiny piece of magic — clean prep, healthy nails and designs you’ll actually want to show off. From a soft natural look to full-on glitter, foils and 3D drama, I build it with you in the chair, right here in Edenvale.
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
                    Nailed By Nesh
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

      {!isAdmin && (
        <footer className="border-t border-border py-8 sm:py-12 mt-12 sm:mt-20">
          <div className="container mx-auto px-4 text-center space-y-4">
            <p className="text-muted-foreground text-sm font-medium">© 2026 Nailed By Nesh. All rights reserved.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-6 text-muted-foreground text-xs font-semibold uppercase tracking-widest">
              <span>069 298 1893</span>
              <span className="hidden sm:inline">•</span>
              <span>number two, Central Avenue, Eastleigh, 1609</span>
            </div>
          </div>
        </footer>
      )}
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}
