import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Sparkles, 
  Users, 
  Calendar, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle,
  Search, 
  Filter, 
  Eye, 
  ShieldAlert, 
  Trash2, 
  ChevronRight, 
  TrendingUp, 
  DollarSign, 
  Globe, 
  User as UserIcon, 
  Mail, 
  Clock, 
  ArrowLeft,
  Crown,
  Layers,
  ArrowUpRight,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar 
} from 'recharts';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

interface Tenant {
  id: string;
  businessName: string;
  ownerEmail: string;
  slug: string;
  plan: 'free' | 'pro';
  createdAt: string;
  isActive: boolean;
  logoUrl?: string;
  phone?: string;
  address?: string;
  artistName?: string;
}

interface TenantDetails {
  bookingsCount: number;
  servicesCount: number;
  lastActivity: string | null;
  loading: boolean;
}

export function SuperAdminDashboard({ onNavigate }: { onNavigate: () => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  
  // Selection / Detail Panel State
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantDetails, setTenantDetails] = useState<TenantDetails>({
    bookingsCount: 0,
    servicesCount: 0,
    lastActivity: null,
    loading: false
  });

  // Global booking count across all tenants
  const [globalBookingsCount, setGlobalBookingsCount] = useState<number>(0);

  // Fetch tenants and aggregate stats
  useEffect(() => {
    setLoading(true);
    const tenantsRef = collection(db, 'tenants');
    
    const unsubscribe = onSnapshot(tenantsRef, async (snapshot) => {
      try {
        const tenantsList: Tenant[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Tenant));
        
        setTenants(tenantsList);
        
        // Let's load booking aggregation across all tenants (each has subcollections tenants/{tenantId}/bookings)
        let totalBookings = 0;
        for (const t of tenantsList) {
          try {
            const bookingsSnap = await getDocs(collection(db, 'tenants', t.id, 'bookings'));
            totalBookings += bookingsSnap.size;
          } catch (err) {
            console.error(`Error loading bookings for tenant ${t.id}:`, err);
          }
        }
        setGlobalBookingsCount(totalBookings);
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'tenants');
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tenants');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch details (bookings, services, last activity) whenever selected tenant changes
  useEffect(() => {
    if (!selectedTenant) return;

    const fetchTenantSubdetails = async () => {
      setTenantDetails(prev => ({ ...prev, loading: true }));
      try {
        // Fetch services count
        const servicesSnap = await getDocs(collection(db, 'tenants', selectedTenant.id, 'services'));
        
        // Fetch bookings
        const bookingsQuery = query(
          collection(db, 'tenants', selectedTenant.id, 'bookings'),
          orderBy('createdAt', 'desc')
        );
        const bookingsSnap = await getDocs(bookingsQuery);
        
        let lastActivityDate: string | null = null;
        if (!bookingsSnap.empty) {
          const latestDoc = bookingsSnap.docs[0].data();
          lastActivityDate = latestDoc.createdAt || latestDoc.date || null;
        }

        setTenantDetails({
          bookingsCount: bookingsSnap.size,
          servicesCount: servicesSnap.size,
          lastActivity: lastActivityDate,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching tenant subcollection details:', error);
        // Fallback if querying subcollections fails or permissions issues
        setTenantDetails({
          bookingsCount: 0,
          servicesCount: 0,
          lastActivity: null,
          loading: false
        });
      }
    };

    fetchTenantSubdetails();
  }, [selectedTenant]);

  // Actions
  const handleToggleStatus = async (tenant: Tenant) => {
    try {
      const tenantRef = doc(db, 'tenants', tenant.id);
      await updateDoc(tenantRef, {
        isActive: !tenant.isActive
      });
      toast.success(`${tenant.businessName} has been ${tenant.isActive ? 'suspended' : 'activated'}`);
      if (selectedTenant?.id === tenant.id) {
        setSelectedTenant(prev => prev ? { ...prev, isActive: !prev.isActive } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tenants/${tenant.id}`);
    }
  };

  const handleUpdatePlan = async (tenant: Tenant, newPlan: 'free' | 'pro') => {
    try {
      const tenantRef = doc(db, 'tenants', tenant.id);
      await updateDoc(tenantRef, {
        plan: newPlan
      });
      toast.success(`${tenant.businessName} plan upgraded/downgraded to ${newPlan.toUpperCase()}`);
      if (selectedTenant?.id === tenant.id) {
        setSelectedTenant(prev => prev ? { ...prev, plan: newPlan } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tenants/${tenant.id}`);
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!window.confirm(`Are you absolutely sure you want to delete ${tenant.businessName}? This actions is permanent.`)) {
      return;
    }
    try {
      const tenantRef = doc(db, 'tenants', tenant.id);
      await deleteDoc(tenantRef);
      toast.success(`${tenant.businessName} has been fully deleted from the Qflow platform`);
      if (selectedTenant?.id === tenant.id) {
        setSelectedTenant(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tenants/${tenant.id}`);
    }
  };

  // Stats aggregations
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter(t => t.isActive).length;
  const suspendedTenants = totalTenants - activeTenants;
  const proTenants = tenants.filter(t => t.plan === 'pro').length;
  const freeTenants = tenants.filter(t => t.plan === 'free').length;

  // Monthly signup charts aggregator (last 6 months)
  const getMonthlySignupData = () => {
    const last6Months: { [key: string]: number } = {};
    const now = new Date();
    
    // Initialize last 6 months list
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = format(d, 'MMM yyyy');
      last6Months[monthLabel] = 0;
    }

    tenants.forEach(t => {
      if (!t.createdAt) return;
      try {
        const dateObj = parseISO(t.createdAt);
        const label = format(dateObj, 'MMM yyyy');
        if (label in last6Months) {
          last6Months[label] += 1;
        }
      } catch (e) {
        // Safe skip invalid dates
      }
    });

    return Object.keys(last6Months).map(key => ({
      name: key,
      Signups: last6Months[key]
    }));
  };

  const chartData = getMonthlySignupData();

  // Filters applying
  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = 
      tenant.businessName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      tenant.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPlan = planFilter === 'all' || tenant.plan === planFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && tenant.isActive) ||
      (statusFilter === 'suspended' && !tenant.isActive);

    return matchesSearch && matchesPlan && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Upper Brand Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-[0.25em] mb-1 font-mono">
            <ShieldAlert className="w-4 h-4 text-primary animate-[pulse_2s_infinite]" />
            SUPER ADMINISTRATOR GATEWAY
          </div>
          <h1 className="text-3xl sm:text-5xl font-normal leading-tight font-serif tracking-tight text-white">
            Qflow <span className="italic text-primary">Control Desk</span>
          </h1>
          <p className="text-zinc-400 text-sm font-medium mt-1">
            Platform-wide tenant diagnostics, licensing toggles, metrics profiling, and subscription management.
          </p>
        </div>
        <div>
          <Button 
            onClick={onNavigate}
            variant="outline"
            className="rounded-full border-white/20 hover:bg-white/5 text-xs font-bold tracking-wider uppercase flex items-center gap-2 px-5 h-10"
          >
            <ArrowLeft className="w-4 h-4" />
            Launch Client Lounge
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Section 1: Overview Stats Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat Card 1 */}
            <Card className="bg-zinc-900/60 border-border/40 backdrop-blur-md shadow-lg overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full filter blur-xl pointer-events-none group-hover:bg-primary/10 transition-colors duration-500" />
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-mono font-black text-muted-foreground uppercase tracking-widest">Global Tenants</p>
                  <p className="text-4xl font-extrabold text-white tracking-tight">{totalTenants}</p>
                  <p className="text-[10px] text-zinc-400 font-semibold">{proTenants} Pro / {freeTenants} Free tier</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(192,132,252,0.15)]">
                  <Users className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            {/* Stat Card 2 */}
            <Card className="bg-zinc-900/60 border-border/40 backdrop-blur-md shadow-lg overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#1ade6e]/5 rounded-full filter blur-xl pointer-events-none group-hover:bg-[#1ade6e]/10 transition-colors duration-500" />
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-mono font-black text-muted-foreground uppercase tracking-widest">Active Channels</p>
                  <p className="text-4xl font-extrabold text-white tracking-tight">{activeTenants}</p>
                  <p className="text-[10px] text-zinc-400 font-semibold">
                    {suspendedTenants > 0 ? `${suspendedTenants} suspended workspace(s)` : '100% services online'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#1ade6e]/15 border border-[#1ade6e]/20 flex items-center justify-center text-[#1ade6e] shadow-[0_0_15px_rgba(26,222,110,0.1)]">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            {/* Stat Card 3 */}
            <Card className="bg-zinc-900/60 border-border/40 backdrop-blur-md shadow-lg overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#c084fc]/5 rounded-full filter blur-xl pointer-events-none" />
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-mono font-black text-muted-foreground uppercase tracking-widest">Platform Bookings</p>
                  <p className="text-4xl font-extrabold text-[#c084fc] tracking-tight">{globalBookingsCount}</p>
                  <p className="text-[10px] text-zinc-400 font-semibold">Aggregated from all schemas</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                  <Calendar className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            {/* Stat Card 4 */}
            <Card className="bg-zinc-900/60 border-border/40 backdrop-blur-md shadow-lg overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full filter blur-xl pointer-events-none" />
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-mono font-black text-muted-foreground uppercase tracking-widest">Conversion Index</p>
                  <p className="text-4xl font-extrabold text-white tracking-tight">
                    {totalTenants > 0 ? `${Math.round((proTenants / totalTenants) * 100)}%` : '0%'}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-semibold">Pro subscription index</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Crown className="w-6 h-6 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Simple Chart Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-gradient-to-tr from-zinc-900/80 via-zinc-900/55 to-violet-950/10 border-border/40 shadow-xl p-6 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full filter blur-3xl pointer-events-none" />
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold font-serif text-white">Monthly Signup Diagnostics</h3>
                  <p className="text-xs text-muted-foreground">New tenant registrations on Qflow across the last 6 months</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-950 border border-border rounded-full">
                  <Activity className="w-3.5 h-3.5 text-primary animate-[pulse_1.5s_infinite]" />
                  <span className="text-[10px] font-mono font-black text-primary/80 uppercase">SYSTEM FEED</span>
                </div>
              </div>
              <div className="h-64 mt-4 text-xs font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c084fc" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#c084fc" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#52525b" />
                    <YAxis stroke="#52525b" allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }}
                      labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="Signups" stroke="#c084fc" strokeWidth={2} fillOpacity={1} fill="url(#colorSignups)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="bg-zinc-900/60 border-border/40 backdrop-blur-md shadow-lg p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold font-serif text-white mb-2">Platform Policies</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Platform billing cycles require manual upgrades. Users registered on the FREE tier receive upsell prompts in their workspace after 30 days of longevity.
                </p>
              </div>
              
              <div className="space-y-3 my-6">
                <div className="p-3 bg-zinc-950 border border-border/50 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-950 flex items-center justify-center text-primary">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Next Cycle Auto-Scan</h4>
                    <p className="text-[10px] text-muted-foreground">Every 24 hours platform-wide</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-950 border border-border/50 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1ade6e]/10 flex items-center justify-center text-[#1ade6e]">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Relational Schemas</h4>
                    <p className="text-[10px] text-muted-foreground">Isolated via multi-tenant document mapping</p>
                  </div>
                </div>
              </div>

              <div className="text-center p-3 bg-primary/10 border border-primary/20 rounded-2xl">
                <span className="text-[10px] font-bold text-primary block tracking-wider uppercase mb-1">Billing Version</span>
                <p className="text-xs text-zinc-300">Phase 1: Manual Tier Adjustments Enabled (Secure Mode)</p>
              </div>
            </Card>
          </div>

          {/* Section 2: Tenant Management Table */}
          <Card className="bg-zinc-900/35 border-border/40 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-serif text-white">Registered Tenant Directory</h3>
                <p className="text-xs text-muted-foreground">Search, suspend, delete, or profiling salon tenants across Qflow.</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by name, slug..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-border/50 text-white rounded-full pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Plan filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Plan</span>
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value as any)}
                    className="bg-zinc-950 border border-border/50 text-white rounded-full px-3 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="all">All Plan Types</option>
                    <option value="free">Free Tier</option>
                    <option value="pro">Pro Membership</option>
                  </select>
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-zinc-950 border border-border/50 text-white rounded-full px-3 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="suspended">Suspended Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-border/20 rounded-2xl bg-zinc-950/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase font-mono tracking-widest text-[10px]">
                    <th className="py-4 px-6 font-black">Business / Owner</th>
                    <th className="py-4 px-4 font-black">Link Handle</th>
                    <th className="py-4 px-4 font-black">Joined Date</th>
                    <th className="py-4 px-4 font-black">Tier Info</th>
                    <th className="py-4 px-4 font-black">Active Status</th>
                    <th className="py-4 px-6 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 font-medium">
                        No salon tenants match filters selected.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((tenant) => {
                      // Upsell calculations: Free older than 30 days
                      let exceedsFreePeriod = false;
                      let daysActive = 0;
                      if (tenant.createdAt) {
                        try {
                          daysActive = differenceInDays(new Date(), parseISO(tenant.createdAt));
                          exceedsFreePeriod = tenant.plan === 'free' && daysActive > 30;
                        } catch (e) {
                          // No-op
                        }
                      }

                      return (
                        <tr 
                          key={tenant.id} 
                          className={`hover:bg-muted/15 transition-colors cursor-pointer ${
                            selectedTenant?.id === tenant.id ? 'bg-muted/20' : ''
                          }`}
                          onClick={() => setSelectedTenant(tenant)}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-950 to-zinc-950 border border-primary/20 flex items-center justify-center font-bold text-primary">
                                {tenant.businessName ? tenant.businessName.charAt(0) : 'Q'}
                              </div>
                              <div>
                                <p className="font-semibold text-white truncate max-w-[200px]" title={tenant.businessName}>
                                  {tenant.businessName || 'Unnamed Salon'}
                                </p>
                                <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[180px] flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-zinc-600" /> {tenant.ownerEmail}
                                </p>
                              </div>
                            </div>
                          </td>
                          
                          <td className="py-4 px-4 font-mono font-bold text-violet-400">
                            <a 
                              href={`/?tenant=${tenant.slug}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              /{tenant.slug}
                              <ArrowUpRight className="w-3.5 h-3.5 opacity-50" />
                            </a>
                          </td>

                          <td className="py-4 px-4 text-zinc-400">
                            {tenant.createdAt ? (
                              <p className="font-mono">{format(parseISO(tenant.createdAt), 'yyyy-MM-dd')}</p>
                            ) : (
                              <span className="text-zinc-600 italic">No Join Date</span>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                tenant.plan === 'pro' 
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}>
                                {tenant.plan || 'free'}
                              </span>

                              {exceedsFreePeriod && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold animate-[pulse_1.5s_infinite]">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Upsell Target ({daysActive}d)
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
                              tenant.isActive ? 'text-[#1ade6e]' : 'text-rose-400'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${tenant.isActive ? 'bg-[#1ade6e]' : 'bg-rose-400'}`} />
                              {tenant.isActive ? 'ACTIVE' : 'SUSPENDED'}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {/* View details */}
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Inspect Workspace"
                                onClick={() => setSelectedTenant(tenant)}
                                className="w-8 h-8 rounded-full border border-border/50 text-zinc-400 hover:text-white"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              {/* Toggle suspension */}
                              <Button
                                size="icon"
                                variant="ghost"
                                title={tenant.isActive ? 'Suspend Business' : 'Activate Business'}
                                onClick={() => handleToggleStatus(tenant)}
                                className={`w-8 h-8 rounded-full border ${
                                  tenant.isActive 
                                    ? 'border-rose-500/20 text-rose-400 hover:bg-rose-500/10' 
                                    : 'border-green-500/20 text-green-400 hover:bg-green-500/10'
                                }`}
                              >
                                <Clock className="w-4 h-4" />
                              </Button>

                              {/* Delete tenant */}
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Delete Tenant Permanent"
                                onClick={() => handleDeleteTenant(tenant)}
                                className="w-8 h-8 rounded-full border border-red-500/20 text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Section 3: Detail Panel Slider (Animated Side Over or Bento grid under) */}
          {selectedTenant && (
            <Card className="bg-gradient-to-tr from-zinc-950 via-zinc-900 to-indigo-950/30 border-border/60 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full filter blur-3xl pointer-events-none" />
              <div className="absolute top-4 right-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedTenant(null)}
                  className="rounded-full bg-zinc-900 border border-border"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-8">
                {/* Panel Header */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-border/40">
                  <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary font-serif text-3xl">
                    {selectedTenant.businessName ? selectedTenant.businessName.charAt(0) : 'Q'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-2xl sm:text-3xl font-normal font-serif text-white">{selectedTenant.businessName}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        selectedTenant.plan === 'pro' 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {selectedTenant.plan}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        selectedTenant.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {selectedTenant.isActive ? 'Active Channel' : 'Suspended Workspace'}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-xs mt-1">Tenant Subcollection Diagnostics Code: <span className="font-mono text-zinc-300">{selectedTenant.id}</span></p>
                  </div>
                </div>

                {/* Subcollection Statistics Grid */}
                <div>
                  <h4 className="text-xs font-mono font-black text-muted-foreground uppercase tracking-widest mb-4">Diagnostics Feed</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-zinc-950/80 border border-border/50 rounded-2xl flex flex-col justify-between h-28 relative">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase font-black">Services Configured</p>
                      {tenantDetails.loading ? (
                        <div className="animate-pulse h-6 bg-zinc-800 w-12 rounded mt-2"></div>
                      ) : (
                        <p className="text-3xl font-extrabold text-white">{tenantDetails.servicesCount}</p>
                      )}
                      <p className="text-[9px] text-zinc-500 font-semibold">Active nail & makeup services</p>
                    </div>

                    <div className="p-4 bg-zinc-950/80 border border-border/50 rounded-2xl flex flex-col justify-between h-28 relative">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase font-black">Workspace Bookings</p>
                      {tenantDetails.loading ? (
                        <div className="animate-pulse h-6 bg-zinc-800 w-12 rounded mt-2"></div>
                      ) : (
                        <p className="text-3xl font-extrabold text-[#c084fc]">{tenantDetails.bookingsCount}</p>
                      )}
                      <p className="text-[9px] text-zinc-500 font-semibold">Bookings submitted in workspace</p>
                    </div>

                    <div className="p-4 bg-zinc-950/80 border border-border/50 rounded-2xl flex flex-col justify-between h-28 relative">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase font-black">Last Recorded activity</p>
                      {tenantDetails.loading ? (
                        <div className="animate-pulse h-6 bg-zinc-800 w-24 rounded mt-2"></div>
                      ) : (
                        <p className="text-sm font-semibold font-mono text-zinc-300">
                          {tenantDetails.lastActivity ? (
                            format(parseISO(tenantDetails.lastActivity), 'yyyy-MM-dd HH:mm')
                          ) : (
                            <span className="text-zinc-600 italic">No activity registered</span>
                          )}
                        </p>
                      )}
                      <p className="text-[9px] text-zinc-500 font-semibold">Based on bookings feed</p>
                    </div>
                  </div>
                </div>

                {/* Account details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4 p-5 bg-zinc-950/60 border border-border/40 rounded-2xl">
                    <h5 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                      <UserIcon className="w-4 h-4 text-primary" /> Profile Specifications
                    </h5>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <span className="text-zinc-500 font-mono">Owner Email:</span>
                      <span className="col-span-2 text-white font-medium long-word">{selectedTenant.ownerEmail}</span>

                      <span className="text-zinc-500 font-mono">Link Handle:</span>
                      <span className="col-span-2 text-violet-400 font-bold font-mono">/{selectedTenant.slug}</span>

                      <span className="text-zinc-500 font-mono">Artist Name:</span>
                      <span className="col-span-2 text-white font-medium">{selectedTenant.artistName || 'Default Artist'}</span>

                      <span className="text-zinc-500 font-mono">Workspace ID:</span>
                      <span className="col-span-2 text-zinc-400 font-mono text-[10px] truncate">{selectedTenant.id}</span>
                    </div>
                  </div>

                  <div className="space-y-4 p-5 bg-zinc-950/60 border border-border/40 rounded-2xl flex flex-col justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <Crown className="w-4 h-4 text-amber-400" /> Subscription Actions
                      </h5>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Upgrade or downgrade this salon business. Changing the tier dynamically updates features and styling layout limits.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={() => handleUpdatePlan(selectedTenant, 'free')}
                        disabled={selectedTenant.plan === 'free'}
                        className={`flex-1 rounded-full text-xs font-bold ${
                          selectedTenant.plan === 'free' 
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50' 
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-border'
                        }`}
                      >
                        Free Membership
                      </Button>
                      <Button
                        onClick={() => handleUpdatePlan(selectedTenant, 'pro')}
                        disabled={selectedTenant.plan === 'pro'}
                        className={`flex-1 rounded-full text-xs font-bold ${
                          selectedTenant.plan === 'pro' 
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/40 cursor-not-allowed' 
                            : 'bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5 mr-1" /> Upgrade Pro
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Suspension & Deactivation Alert */}
                <div className="bg-red-500/5 border border-red-500/20 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Danger Zone Gate
                    </h5>
                    <p className="text-[11px] text-zinc-400 max-w-xl">
                      Suspending a business blocks all client and tenant admin accesses immediately. Deletion permanent deletes the workspace, configurations and booking tables under the schema.
                    </p>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      onClick={() => handleToggleStatus(selectedTenant)}
                      variant="outline"
                      className={`flex-1 sm:flex-none rounded-full text-xs font-bold px-5 h-9 ${
                        selectedTenant.isActive
                          ? 'border-red-500/30 hover:bg-red-500/10 text-red-400'
                          : 'border-green-500/30 hover:bg-green-500/10 text-green-400'
                      }`}
                    >
                      {selectedTenant.isActive ? 'Suspend Space' : 'Restore Workspace'}
                    </Button>
                    <Button
                      onClick={() => handleDeleteTenant(selectedTenant)}
                      className="flex-1 sm:flex-none rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 h-9"
                    >
                      Delete Permanent
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
