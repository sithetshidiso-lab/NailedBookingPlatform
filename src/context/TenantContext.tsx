import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { setCurrentTenantId } from '../tenant';

export interface TenantData {
  businessName: string;
  logoUrl: string;
  description: string;
  phone: string;
  address: string;
  email: string;
  tagline: string;
  artistName: string;
  starEndorsement: string;
  whatsappPhone: string;
  ownerEmail: string;
  slug: string;
  templateId?: string;
  plan: 'free' | 'pro';
  createdAt: string;
  isActive: boolean;
}

interface TenantContextType {
  tenantId: string;
  tenantData: TenantData | null;
  loading: boolean;
  isNotFound: boolean;
  refreshTenant: () => Promise<void>;
  updateTenantData: (data: Partial<TenantData>) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const getSlugFromUrl = (): string | null => {
  const urlParams = new URL(window.location.href).searchParams;
  const tParam = urlParams.get('tenant') || urlParams.get('tenantId');
  if (tParam) return tParam;

  // Parse first segment of path (simple clean URLs)
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);
  const reserved = ['dashboard', 'signup', 'login', 'api', 'admin', 'client', 'bookings', 'assets', 'index.html'];
  if (segments.length > 0 && !reserved.includes(segments[0])) {
    return segments[0];
  }
  return null;
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenantId, setTenantId] = useState<string>('qflow-default');
  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  const updateTenantState = (id: string, data: TenantData) => {
    setTenantId(id);
    setTenantData(data);
    setCurrentTenantId(id);
  };

  const lookupTenant = async (currentUser: User | null) => {
    try {
      setIsNotFound(false);
      // 1. Check URL
      const slug = getSlugFromUrl();
      if (slug) {
        // Try direct lookup by slug document ID
        const tenantRef = doc(db, 'tenants', slug);
        const snap = await getDoc(tenantRef);
        if (snap.exists() && snap.data().isActive) {
          updateTenantState(slug, snap.data() as TenantData);
          setLoading(false);
          return;
        }

        // Try where slug == slug
        const q = query(collection(db, 'tenants'), where('slug', '==', slug), where('isActive', '==', true));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const tDoc = qSnap.docs[0];
          updateTenantState(tDoc.id, tDoc.data() as TenantData);
          setLoading(false);
          return;
        }

        // If a slug is specified but cannot be found, trigger the 404 state
        setIsNotFound(true);
        setLoading(false);
        return;
      }

      // 2. Check current user email (if logged in, check if they own any tenant)
      if (currentUser?.email) {
        const q = query(collection(db, 'tenants'), where('ownerEmail', '==', currentUser.email));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const tDoc = qSnap.docs[0];
          updateTenantState(tDoc.id, tDoc.data() as TenantData);
          setLoading(false);
          return;
        }

        // Check user custom profile document for tenantId mapping
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          if (uData.tenantId) {
            const tenantRef = doc(db, 'tenants', uData.tenantId);
            const snap = await getDoc(tenantRef);
            if (snap.exists() && snap.data().isActive) {
              updateTenantState(uData.tenantId, snap.data() as TenantData);
              setLoading(false);
              return;
            }
          }
        }
      }

      // 3. Fallback to default
      const defaultId = 'qflow-default';
      const tenantRef = doc(db, 'tenants', defaultId);
      const snap = await getDoc(tenantRef);
      if (!snap.exists()) {
        const defaultData: TenantData = {
          businessName: "Qflow",
          logoUrl: "/logo.png",
          description: "A professional booking, scheduler and salon management platform designed to elevate your style.",
          phone: "069 298 1893",
          address: "number two, Central Avenue, Eastleigh, 1609",
          email: "support@qflow.com",
          tagline: "Where every session feels like a breath of fresh air.",
          artistName: "your Stylist",
          starEndorsement: "✨ PROFESSIONAL SCHEDULER",
          whatsappPhone: "27692981893",
          ownerEmail: "sithetshidiso@gmail.com",
          slug: defaultId,
          templateId: "default",
          plan: "pro",
          createdAt: new Date().toISOString(),
          isActive: true
        };
        await setDoc(tenantRef, defaultData);
        updateTenantState(defaultId, defaultData);
      } else {
        updateTenantState(defaultId, snap.data() as TenantData);
      }
    } catch (err) {
      console.error('Error lookupTenant:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshTenant = async () => {
    setLoading(true);
    await lookupTenant(auth.currentUser);
  };

  const updateTenantData = async (data: Partial<TenantData>) => {
    if (!tenantId) return;
    const tenantRef = doc(db, 'tenants', tenantId);
    await updateDoc(tenantRef, data);
    setTenantData(prev => prev ? { ...prev, ...data } : null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      lookupTenant(user);
    });
    return () => unsubscribe();
  }, []);

  return (
    <TenantContext.Provider value={{ tenantId, tenantData, loading, isNotFound, refreshTenant, updateTenantData }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
