import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, limit, where, Timestamp, updateDoc, doc, deleteDoc, addDoc, setDoc, writeBatch, getDocs, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Booking, Service, Expense, AppSettings, Client, GalleryImage, Promotion } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, Calendar as CalendarIcon, CreditCard, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, Edit2, Trash2, ChevronDown, ChevronUp, Mail, Phone, ExternalLink, Plus, ImageIcon, Settings, FileText, Save, Check, Megaphone, Sparkles } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, isSameDay, parseISO } from 'date-fns';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';
import { isTimeSlotAvailable, getBookingDuration, generateTimeSlots } from '@/lib/booking-utils';
import { sendConfirmationEmail, sendReminderEmail } from '@/services/emailService';
import { syncAvailability } from '@/lib/availability-utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { tenant, getTenantCollectionPath } from '../tenant';
import { useTenant } from '../context/TenantContext';

interface AdminDashboardProps {
  services: Service[];
  initialTab?: 'overview' | 'services' | 'settings' | 'expenses' | 'clients' | 'calendar';
  onNavigate?: (tab: any) => void;
}

type DrillDownType = 'revenue' | 'active' | 'pending' | null;

interface GalleryItemCardProps {
  img: GalleryImage;
  onRemove: (id: string) => void;
  onUpdate: (id: string, name: string, price: number) => void;
}

function GalleryItemCard({ img, onRemove, onUpdate }: GalleryItemCardProps) {
  const [name, setName] = useState(img.name || '');
  const [price, setPrice] = useState(img.price !== undefined && img.price !== null ? String(img.price) : '');

  useEffect(() => {
    setName(img.name || '');
    setPrice(img.price !== undefined && img.price !== null ? String(img.price) : '');
  }, [img.name, img.price]);

  const handleBlur = () => {
    const numericPrice = parseFloat(price);
    onUpdate(img.id!, name, isNaN(numericPrice) ? 0 : numericPrice);
  };

  return (
    <Card className="overflow-hidden border border-border bg-card shadow-sm flex flex-col justify-between rounded-3xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted font-sans z-0">
        <img src={img.url} className="w-full h-full object-cover" />
        <button 
          type="button"
          onClick={() => img.id && onRemove(img.id)}
          className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white p-2 border-none rounded-full shadow-lg transition-transform active:scale-95 z-10 cursor-pointer"
          title="Delete image"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3.5 space-y-2.5 bg-muted/10 border-t border-border flex-1 flex flex-col justify-end">
        <div className="space-y-1">
          <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block font-sans">Design Set Name</Label>
          <Input 
            className="h-8 text-xs rounded-xl bg-background border-border"
            placeholder="e.g. Lavender Starburst"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block font-sans">Optional Price (R)</Label>
          <Input 
            type="number"
            className="h-8 text-xs rounded-xl bg-background border-border"
            placeholder="e.g. R450"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={handleBlur}
          />
        </div>
      </div>
    </Card>
  );
}

export function AdminDashboard({ services, initialTab = 'overview', onNavigate }: AdminDashboardProps) {
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

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDrillDown, setActiveDrillDown] = useState<DrillDownType>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(new Date());
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isAddingBooking, setIsAddingBooking] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);
  
  const handleEditBooking = (booking: Booking) => {
    console.log('Setting editing booking:', booking);
    setEditingBooking(booking);
  };

  const [newBooking, setNewBooking] = useState<Partial<Booking>>({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceNames: [],
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    status: 'confirmed',
    totalPrice: 0,
    notes: ''
  });
  const [isNewClientForAdmin, setIsNewClientForAdmin] = useState(true);
  
  // Client Management State
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [viewingClientHistory, setViewingClientHistory] = useState<Client | null>(null);
  
  // Service Management State
  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
  const [isAddingService, setIsAddingService] = useState(false);

  // Expense Management State
  const [editingExpense, setEditingExpense] = useState<Partial<Expense> | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    bookingPolicy: '',
    cancellationPolicy: '',
    galleryImages: []
  });
  const [gallery, setGallery] = useState<GalleryImage[]>([]);

  // Promotions State
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [newPromo, setNewPromo] = useState<Partial<Promotion>>({
    title: '',
    description: '',
    discountValue: '',
    promoCode: '',
    active: true
  });
  const [isPromoSaving, setIsPromoSaving] = useState(false);

  const totalRevenue = bookings
    .filter(b => b.status === 'completed')
    .reduce((acc, b) => acc + (b.totalPrice || 0), 0);

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  
  const stats = [
    { id: 'revenue', title: 'Total Revenue', value: `R${totalRevenue}`, icon: CreditCard, color: 'text-emerald-500', trend: '+12.5%' },
    { id: 'active', title: 'Active Bookings', value: confirmedBookings.length, icon: CalendarIcon, color: 'text-purple-500', trend: '+3' },
    { id: 'pending', title: 'Pending Requests', value: pendingBookings.length, icon: Clock, color: 'text-amber-500', trend: 'Needs Action' },
    { id: 'clients', title: 'Total Clients', value: new Set(bookings.map(b => b.clientEmail)).size, icon: Users, color: 'text-blue-500', trend: '+2 this week' },
  ];

  const chartData = [
    { name: 'Mon', revenue: 400 },
    { name: 'Tue', revenue: 300 },
    { name: 'Wed', revenue: 600 },
    { name: 'Thu', revenue: 800 },
    { name: 'Fri', revenue: 1200 },
    { name: 'Sat', revenue: 1500 },
    { name: 'Sun', revenue: 500 },
  ];

  const filteredBookingsForDate = bookings.filter(b => 
    selectedCalendarDate && isSameDay(parseISO(b.date), selectedCalendarDate)
  );

  useEffect(() => {
    const q = query(collection(db, getTenantCollectionPath('bookings')), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setBookings(bookingsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, getTenantCollectionPath('bookings'));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, getTenantCollectionPath('gallery')), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const galleryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GalleryImage));
      setGallery(galleryData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, getTenantCollectionPath('gallery'));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, getTenantCollectionPath('expenses')), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(expensesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, getTenantCollectionPath('expenses'));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, getTenantCollectionPath('clients')), orderBy('lastBooking', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, getTenantCollectionPath('clients'));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, getTenantCollectionPath('promotions')), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const promosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion));
      setPromotions(promosData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, getTenantCollectionPath('promotions'));
    });

    return () => unsubscribe();
  }, []);

  const handleAddPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.title || !newPromo.description) {
      toast.error('Title and Description are required.');
      return;
    }
    setIsPromoSaving(true);
    try {
      await addDoc(collection(db, getTenantCollectionPath('promotions')), {
        ...newPromo,
        createdAt: new Date().toISOString()
      });
      setNewPromo({ title: '', description: '', discountValue: '', promoCode: '', active: true });
      toast.success('Promo offering created successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create promotion');
    } finally {
      setIsPromoSaving(false);
    }
  };

  const handleTogglePromo = async (promoId: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, getTenantCollectionPath('promotions'), promoId), {
        active: !currentActive
      });
      toast.success('Promotion toggled successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to toggle promotion');
    }
  };

  const handleDeletePromo = async (promoId: string) => {
    try {
      await deleteDoc(doc(db, getTenantCollectionPath('promotions'), promoId));
      toast.success('Promotion deleted successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete promotion');
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, getTenantCollectionPath('settings'), 'app'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as AppSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, getTenantCollectionPath('settings') + '/app');
    });
    return () => unsubscribe();
  }, []);

  const updateBookingStatus = async (bookingId: string, status: Booking['status']) => {
    try {
      await updateDoc(doc(db, getTenantCollectionPath('bookings'), bookingId), { status });
      
      const booking = bookings.find(b => b.id === bookingId);
      if (booking) {
        const duration = getBookingDuration(booking, services);
        await syncAvailability(bookingId, booking.date, booking.time, duration, status);

        // Loyalty Points logic
        if (status === 'completed' && !booking.pointsAwarded) {
          const pointsToEarn = Math.floor((booking.totalPrice || 0) / 10);
          if (pointsToEarn > 0) {
            const matchingClient = clients.find(c => c.email === booking.clientEmail);
            if (matchingClient && matchingClient.id) {
              await updateDoc(doc(db, getTenantCollectionPath('clients'), matchingClient.id), {
                loyaltyPoints: (matchingClient.loyaltyPoints || 0) + pointsToEarn
              });
            } else {
              // Create new client in Firestore if they don't exist
              await addDoc(collection(db, getTenantCollectionPath('clients')), {
                name: booking.clientName,
                email: booking.clientEmail,
                phone: booking.clientPhone || '',
                lastBooking: new Date().toISOString(),
                totalBookings: 1,
                loyaltyPoints: pointsToEarn,
                notes: 'Automatically created from completed appointment'
              });
            }
            await updateDoc(doc(db, getTenantCollectionPath('bookings'), bookingId), {
              pointsAwarded: true,
              pointsEarned: pointsToEarn
            });
            toast.success(`Booking completed! Awarded ${pointsToEarn} loyalty points.`);
          } else {
            await updateDoc(doc(db, 'bookings', bookingId), {
              pointsAwarded: true,
              pointsEarned: 0
            });
            toast.success('Booking marked as completed.');
          }
        } else if (status !== 'completed' && booking.pointsAwarded) {
          // Changed status away from completed: reverse points!
          const pointsToDeduct = booking.pointsEarned || 0;
          if (pointsToDeduct > 0) {
            const matchingClient = clients.find(c => c.email === booking.clientEmail);
            if (matchingClient && matchingClient.id) {
              await updateDoc(doc(db, 'clients', matchingClient.id), {
                loyaltyPoints: Math.max(0, (matchingClient.loyaltyPoints || 0) - pointsToDeduct)
              });
            }
          }
          await updateDoc(doc(db, 'bookings', bookingId), {
            pointsAwarded: false,
            pointsEarned: 0
          });
          toast.success(`Reversed ${pointsToDeduct} loyalty points.`);
        } else if (status === 'confirmed') {
          toast.success('Booking confirmed! Notification sent to client.');
        } else {
          toast.success(`Booking status set to ${status}.`);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const cancelBooking = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const reason = window.prompt(`Are you sure you want to cancel this booking?\n\nPolicy: ${settings.cancellationPolicy}\n\nEnter reason for cancellation:`);
    
    if (reason === null) return; // Cancelled prompt

    try {
      await updateDoc(doc(db, 'bookings', bookingId), { 
        status: 'cancelled',
        cancellationReason: reason,
        cancelledAt: new Date().toISOString()
      });
      
      const duration = getBookingDuration(booking, services);
      await syncAvailability(bookingId, booking.date, booking.time, duration, 'cancelled');
      
      // If client had redeemed points, refund them!
      if (booking.pointsRedeemed && booking.pointsRedeemed > 0 && !booking.pointsRefunded) {
        const matchingClient = clients.find(c => c.email === booking.clientEmail);
        if (matchingClient && matchingClient.id) {
          await updateDoc(doc(db, 'clients', matchingClient.id), {
            loyaltyPoints: (matchingClient.loyaltyPoints || 0) + booking.pointsRedeemed
          });
          await updateDoc(doc(db, 'bookings', bookingId), {
            pointsRefunded: true
          });
          toast.success(`Refunded ${booking.pointsRedeemed} loyalty points of client.`);
        }
      }

      // Reverse points if booking was marked completed
      if (booking.pointsAwarded && (booking.pointsEarned || 0) > 0) {
        const matchingClient = clients.find(c => c.email === booking.clientEmail);
        if (matchingClient && matchingClient.id) {
          await updateDoc(doc(db, 'clients', matchingClient.id), {
            loyaltyPoints: Math.max(0, (matchingClient.loyaltyPoints || 0) - booking.pointsEarned!)
          });
        }
        await updateDoc(doc(db, 'bookings', bookingId), {
          pointsAwarded: false,
          pointsEarned: 0
        });
      }

      toast.success('Booking cancelled successfully.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const deleteBooking = async (bookingId: string) => {
    console.log('Attempting to delete booking:', bookingId);
    setBookingToDelete(bookingId);
  };

  const confirmDeleteBooking = async () => {
    if (!bookingToDelete) return;
    console.log('Confirming deletion of:', bookingToDelete);
    try {
      const booking = bookings.find(b => b.id === bookingToDelete);
      if (booking) {
        // Refund redeemed points
        if (booking.pointsRedeemed && booking.pointsRedeemed > 0 && !booking.pointsRefunded) {
          const matchingClient = clients.find(c => c.email === booking.clientEmail);
          if (matchingClient && matchingClient.id) {
            await updateDoc(doc(db, 'clients', matchingClient.id), {
              loyaltyPoints: (matchingClient.loyaltyPoints || 0) + booking.pointsRedeemed
            });
            toast.success(`Refunded ${booking.pointsRedeemed} loyalty points of client.`);
          }
        }
        // Recover awarded points
        if (booking.pointsAwarded && (booking.pointsEarned || 0) > 0) {
          const matchingClient = clients.find(c => c.email === booking.clientEmail);
          if (matchingClient && matchingClient.id) {
            await updateDoc(doc(db, 'clients', matchingClient.id), {
              loyaltyPoints: Math.max(0, (matchingClient.loyaltyPoints || 0) - booking.pointsEarned!)
            });
          }
        }
      }
      await deleteDoc(doc(db, 'bookings', bookingToDelete));
      await syncAvailability(bookingToDelete, '', '', 0, 'cancelled');
      toast.success('Booking deleted successfully.');
      setBookingToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      handleFirestoreError(error, OperationType.DELETE, `bookings/${bookingToDelete}`);
    }
  };

  const [isSendingReminders, setIsSendingReminders] = useState(false);

  const getRemindersDue = () => {
    const now = new Date();
    return bookings.filter(b => {
      if (b.status !== 'confirmed') return false;
      const bDate = new Date(`${b.date}T${b.time}`);
      const diffMs = bDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours > 0 && diffHours <= 48 && !b.reminderSent;
    });
  };

  const triggerReminder = async (booking: Booking) => {
    if (!booking.id) return;
    try {
      const result = await sendReminderEmail(booking);
      if (result.success) {
        await updateDoc(doc(db, 'bookings', booking.id), {
          reminderSent: true,
          reminderSentAt: new Date().toISOString()
        });
        toast.success(`Automated Email Reminder successfully sent to ${booking.clientName}! Reference ID: ${result.reminderId}`);
      }
    } catch (e) {
      console.error(e);
      toast.error(`Could not dispatch email reminder for ${booking.clientName}.`);
    }
  };

  const triggerAllRemindersCount = async () => {
    const due = getRemindersDue();
    if (due.length === 0) {
      toast.info('No pending reminders due right now.');
      return;
    }
    setIsSendingReminders(true);
    let successCount = 0;
    for (const booking of due) {
      try {
        const result = await sendReminderEmail(booking);
        if (result.success) {
          await updateDoc(doc(db, 'bookings', booking.id!), {
            reminderSent: true,
            reminderSentAt: new Date().toISOString()
          });
          successCount++;
        }
      } catch (e) {
        console.error('Trigger reminder error:', e);
      }
    }
    setIsSendingReminders(false);
    toast.success(`Dispatched ${successCount} automated appointment reminder email(s) successfully!`);
  };

  const syncClients = async () => {
    try {
      const batch = writeBatch(db);
      const clientsMap = new Map<string, Client>();
      
      // Group bookings by client email
      bookings.forEach(b => {
        if (!b.clientEmail) return;
        const existing = clientsMap.get(b.clientEmail);
        if (!existing || new Date(b.date) > new Date(existing.lastBooking || '')) {
          clientsMap.set(b.clientEmail, {
            name: b.clientName,
            email: b.clientEmail,
            phone: b.clientPhone,
            lastBooking: b.date,
            notes: b.notes || ''
          });
        }
      });

      // Check which clients already exist in the collection
      const existingClientsSnapshot = await getDocs(collection(db, getTenantCollectionPath('clients')));
      const existingEmails = new Set(existingClientsSnapshot.docs.map(doc => doc.data().email));

      let count = 0;
      clientsMap.forEach((client, email) => {
        if (!existingEmails.has(email)) {
          const newDocRef = doc(collection(db, getTenantCollectionPath('clients')));
          batch.set(newDocRef, client);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        toast.success(`Synced ${count} new client records from bookings.`);
      } else {
        toast.info('All clients are already in the database.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to sync clients');
    }
  };

  const saveNewBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBooking.clientName || !newBooking.clientEmail || !newBooking.date || !newBooking.time) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // Check availability
      const bookingsForDate = bookings.filter(b => b.date === newBooking.date);
      const duration = getBookingDuration(newBooking as Booking, services);
      if (!isTimeSlotAvailable(newBooking.time!, duration, bookingsForDate, services, undefined)) {
        toast.error('This slot is already taken. Please choose another time.');
        return;
      }

      const bookingData = {
        ...newBooking,
        createdAt: serverTimestamp(),
        status: 'confirmed'
      };

      const bookingDoc = await addDoc(collection(db, getTenantCollectionPath('bookings')), bookingData);

      // Deduct loyalty points and adjust balance
      if (newBooking.pointsRedeemed && newBooking.pointsRedeemed > 0) {
        const matchingClient = clients.find(c => c.email === newBooking.clientEmail);
        if (matchingClient && matchingClient.id) {
          const nextPoints = Math.max(0, (matchingClient.loyaltyPoints || 0) - newBooking.pointsRedeemed);
          await updateDoc(doc(db, getTenantCollectionPath('clients'), matchingClient.id), {
            loyaltyPoints: nextPoints
          });
        }
      }

      // Sync to availability
      try {
        const duration = getBookingDuration(bookingData as any as Booking, services);
        await syncAvailability(bookingDoc.id, bookingData.date!, bookingData.time!, duration, bookingData.status!);
      } catch (syncError) {
        console.error('Failed to sync availability:', syncError);
      }

      // Send confirmation email
      try {
        // Use a string for createdAt when sending email to satisfy the type
        const emailResult = await sendConfirmationEmail({ 
          ...bookingData, 
          id: bookingDoc.id,
          createdAt: new Date().toISOString() 
        } as any as Booking);
        if (emailResult.success) {
          await updateDoc(doc(db, getTenantCollectionPath('bookings'), bookingDoc.id), {
            confirmationEmailSent: true,
            confirmationId: emailResult.confirmationId
          });
        }
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }

      if (isNewClientForAdmin) {
        const clientExists = clients.some(c => c.email === newBooking.clientEmail);
        if (!clientExists) {
          await addDoc(collection(db, getTenantCollectionPath('clients')), {
            name: newBooking.clientName,
            email: newBooking.clientEmail,
            phone: newBooking.clientPhone || '',
            lastBooking: newBooking.date,
            totalBookings: 1,
            notes: newBooking.notes || '',
            loyaltyPoints: 0
          });
        }
      }

      setIsAddingBooking(false);
      setNewBooking({
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        serviceNames: [],
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        status: 'confirmed',
        totalPrice: 0,
        notes: '',
        pointsRedeemed: 0,
        discountApplied: 0
      });
      toast.success('Appointment created successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bookings');
    }
  };

  const saveBookingEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking?.id) {
      console.error('Cannot save edit: No booking ID');
      return;
    }
    console.log('Saving booking edit for:', editingBooking.id, editingBooking);
    try {
      // Check availability
      const bookingsForDate = bookings.filter(b => b.date === editingBooking.date);
      const duration = getBookingDuration(editingBooking, services);
      if (!isTimeSlotAvailable(editingBooking.time, duration, bookingsForDate, services, editingBooking.id)) {
        toast.error('This slot overlaps with another booking. Please choose another time.');
        return;
      }

      // Reconcile redeemed points modifications
      const origBooking = bookings.find(b => b.id === editingBooking.id);
      const oldRedeemed = origBooking?.pointsRedeemed || 0;
      const newRedeemed = editingBooking.pointsRedeemed || 0;
      const diffRedeemed = newRedeemed - oldRedeemed;

      if (diffRedeemed !== 0) {
        const matchingClient = clients.find(c => c.email === editingBooking.clientEmail);
        if (matchingClient && matchingClient.id) {
          const currentPoints = matchingClient.loyaltyPoints || 0;
          await updateDoc(doc(db, 'clients', matchingClient.id), {
            loyaltyPoints: Math.max(0, currentPoints - diffRedeemed)
          });
        }
      }

      const { id, ...data } = editingBooking;
      await updateDoc(doc(db, 'bookings', id), data);
      
      // Sync to availability
      try {
        const duration = getBookingDuration(data as Booking, services);
        await syncAvailability(id, data.date!, data.time!, duration, data.status!);
      } catch (syncError) {
        console.error('Failed to sync availability:', syncError);
      }

      setEditingBooking(null);
      toast.success('Booking updated successfully.');
    } catch (error) {
      console.error('Save edit error:', error);
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${editingBooking.id}`);
    }
  };

  // Service Management Logic
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Increase limit to 5MB as requested
    if (file.size > 5 * 1024 * 1024) { 
      toast.error('Image is too large. Please use an image under 5MB.');
      return;
    }

    const loadingToast = toast.loading('Processing image...');

    try {
      // Compress image to stay under Firestore's 1MB document limit
      // We target ~700KB to be safe with base64 overhead
      const options = {
        maxSizeMB: 0.7,
        maxWidthOrHeight: 1200,
        useWebWorker: true
      };

      const compressedFile = await imageCompression(file, options);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        callback(reader.result as string);
        toast.dismiss(loadingToast);
        toast.success('Image processed successfully');
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Compression error:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to process image');
    }
  };

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService?.name || !editingService?.price) return;

    try {
      if (editingService.id) {
        const { id, ...data } = editingService;
        await updateDoc(doc(db, getTenantCollectionPath('services'), id), data);
        toast.success('Service updated successfully');
      } else {
        await addDoc(collection(db, getTenantCollectionPath('services')), editingService);
        toast.success('Service added successfully');
      }
      setEditingService(null);
      setIsAddingService(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, getTenantCollectionPath('services'));
    }
  };

  const deleteService = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      await deleteDoc(doc(db, getTenantCollectionPath('services'), id));
      toast.success('Service deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, getTenantCollectionPath('services') + `/${id}`);
    }
  };

  // Expense Management Logic
  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense?.title || !editingExpense?.amount || !editingExpense?.date) return;

    try {
      if (editingExpense.id) {
        const { id, ...data } = editingExpense;
        await updateDoc(doc(db, getTenantCollectionPath('expenses'), id), data);
        toast.success('Expense updated successfully');
      } else {
        await addDoc(collection(db, getTenantCollectionPath('expenses')), editingExpense);
        toast.success('Expense added successfully');
      }
      setEditingExpense(null);
      setIsAddingExpense(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, getTenantCollectionPath('expenses'));
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteDoc(doc(db, getTenantCollectionPath('expenses'), id));
      toast.success('Expense deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, getTenantCollectionPath('expenses') + `/${id}`);
    }
  };

  // Client Management Logic
  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient?.name || !editingClient?.email) return;

    try {
      if (editingClient.id) {
        const { id, ...data } = editingClient;
        await updateDoc(doc(db, getTenantCollectionPath('clients'), id), data);
        toast.success('Client updated successfully');
      } else {
        await addDoc(collection(db, getTenantCollectionPath('clients')), {
          ...editingClient,
          lastBooking: '',
          totalBookings: 0
        });
        toast.success('Client added successfully');
      }
      setEditingClient(null);
      setIsAddingClient(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, getTenantCollectionPath('clients'));
    }
  };

  const deleteClient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
      await deleteDoc(doc(db, getTenantCollectionPath('clients'), id));
      toast.success('Client deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, getTenantCollectionPath('clients') + `/${id}`);
    }
  };

  // Settings Management Logic
  const saveSettings = async () => {
    try {
      // Don't save galleryImages in the settings doc anymore to avoid size limits
      const { galleryImages, ...otherSettings } = settings;
      await setDoc(doc(db, getTenantCollectionPath('settings'), 'app'), otherSettings);
      toast.success('Settings saved successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, getTenantCollectionPath('settings') + '/app');
    }
  };

  const addGalleryImage = async (base64: string) => {
    try {
      await addDoc(collection(db, getTenantCollectionPath('gallery')), {
        url: base64,
        createdAt: serverTimestamp()
      });
      toast.success('Gallery image added');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, getTenantCollectionPath('gallery'));
    }
  };

  const removeGalleryImage = async (id: string) => {
    try {
      await deleteDoc(doc(db, getTenantCollectionPath('gallery'), id));
      toast.success('Gallery image removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, getTenantCollectionPath('gallery') + `/${id}`);
    }
  };

  const updateGalleryImageDetails = async (id: string, name: string, price: number) => {
    try {
      await updateDoc(doc(db, getTenantCollectionPath('gallery'), id), {
        name,
        priceByNum: isNaN(price) ? 0 : price,
        price: isNaN(price) ? 0 : price,
        updatedAt: serverTimestamp()
      });
      toast.success('Gallery image updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, getTenantCollectionPath('gallery') + `/${id}`);
    }
  };

  const renderServices = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-foreground tracking-tight">Manage Services</h2>
          <Button onClick={() => { setIsAddingService(true); setEditingService({ name: '', price: 0, category: 'Nails', duration: 30 }); }} className="bg-primary text-white font-bold">
            <Plus className="w-4 h-4 mr-2" /> Add Service
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(s => (
            <Card key={s.id} className="border-border shadow-sm overflow-hidden group">
              <div className="h-32 bg-muted relative overflow-hidden">
                {s.image ? (
                  <img src={s.image} alt={s.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-8 h-8 opacity-20" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                  <Button size="icon" variant="secondary" className="h-8 w-8 shadow-md" onClick={() => setEditingService(s)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-8 w-8 shadow-md" onClick={() => deleteService(s.id!)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">{s.category}</p>
                    <h4 className="font-bold text-foreground">{s.name}</h4>
                  </div>
                  <p className="font-black text-foreground">R{s.price}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {s.duration} minutes
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Service Edit Modal */}
        {(editingService || isAddingService) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-6 border-b border-border bg-muted/30">
                <h3 className="text-xl font-black text-foreground">{editingService?.id ? 'Edit Service' : 'Add New Service'}</h3>
              </div>
              <form onSubmit={saveService} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service Name</Label>
                    <Input value={editingService?.name || ''} onChange={e => setEditingService({...editingService!, name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={editingService?.category || 'Nails'} onValueChange={val => setEditingService({...editingService!, category: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nails">Nails</SelectItem>
                        <SelectItem value="Pedicure">Pedicure</SelectItem>
                        <SelectItem value="Manicure">Manicure</SelectItem>
                        <SelectItem value="Art">Art</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price (R)</Label>
                    <Input type="number" value={editingService?.price !== undefined && editingService?.price !== null ? editingService.price : ''} onChange={e => setEditingService({...editingService!, price: Number(e.target.value)})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input type="number" value={editingService?.duration !== undefined && editingService?.duration !== null ? editingService.duration : ''} onChange={e => setEditingService({...editingService!, duration: Number(e.target.value)})} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={editingService?.description || ''} onChange={e => setEditingService({...editingService!, description: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Service Image</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden border border-border">
                      {editingService?.image ? <img src={editingService.image} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-6 text-muted-foreground opacity-20" />}
                    </div>
                    <Input type="file" accept="image/*" onChange={e => handleImageUpload(e, (base64) => setEditingService({...editingService!, image: base64}))} className="flex-1" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => { setEditingService(null); setIsAddingService(false); }}>Cancel</Button>
                  <Button type="submit" className="bg-primary text-white font-bold">Save Service</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    );

  const renderClients = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Client Database</h2>
            <p className="text-sm text-muted-foreground font-medium">Total Clients: <span className="text-primary font-bold">{clients.length}</span></p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncClients} className="border-primary/50 text-primary hover:bg-primary/10">
              <Users className="w-4 h-4 mr-2" /> Sync
            </Button>
            <Button onClick={() => { setIsAddingClient(true); setEditingClient({ name: '', email: '', phone: '', notes: '' }); }} className="bg-primary text-white font-bold">
              <Plus className="w-4 h-4 mr-2" /> Add Client
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {clients.length === 0 ? (
            <Card className="border-border shadow-sm p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground italic">No clients registered yet.</p>
            </Card>
          ) : (
            clients.map(client => (
              <Card key={client.id} className="border-border shadow-sm hover:border-primary/30 transition-colors group">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-black">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-lg text-foreground">{client.name}</h4>
                        <span className="flex items-center gap-1 px-2.5 py-0.5 bg-purple-500/10 text-purple-700 border border-purple-500/20 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <Sparkles className="w-3 h-3 text-purple-500" />
                          {client.loyaltyPoints || 0} pts
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {client.email}
                        </p>
                        {client.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {client.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col md:items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="text-primary" onClick={() => setViewingClientHistory(client)}>
                        <FileText className="w-4 h-4 mr-2" /> History
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => setEditingClient(client)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => deleteClient(client.id!)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Last Booking: <span className="text-foreground">{client.lastBooking ? format(parseISO(client.lastBooking), 'MMM d, yyyy') : 'Never'}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Client Edit Modal */}
        {(editingClient || isAddingClient) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-6 border-b border-border bg-muted/30">
                <h3 className="text-xl font-black text-foreground">{editingClient?.id ? 'Edit Client' : 'Add New Client'}</h3>
              </div>
              <form onSubmit={saveClient} className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={editingClient?.name || ''} onChange={e => setEditingClient({...editingClient!, name: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={editingClient?.email || ''} onChange={e => setEditingClient({...editingClient!, email: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={editingClient?.phone || ''} onChange={e => setEditingClient({...editingClient!, phone: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <textarea 
                    value={editingClient?.notes || ''} 
                    onChange={e => setEditingClient({...editingClient!, notes: e.target.value})}
                    className="w-full h-32 p-3 bg-muted/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => { setEditingClient(null); setIsAddingClient(false); }}>Cancel</Button>
                  <Button type="submit" className="bg-primary text-white font-bold">Save Client</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Client History Modal */}
        {viewingClientHistory && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
              <div className="p-6 border-b border-border bg-muted/30 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-foreground">Booking History</h3>
                  <p className="text-sm text-muted-foreground">{viewingClientHistory.name}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setViewingClientHistory(null)}><XCircle className="w-5 h-5" /></Button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                {bookings.filter(b => b.clientEmail === viewingClientHistory.email).length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground italic">No booking history found.</p>
                ) : (
                  bookings.filter(b => b.clientEmail === viewingClientHistory.email).map(b => (
                    <div key={b.id} className="p-4 bg-muted/20 rounded-xl border border-border flex justify-between items-center">
                      <div>
                        <p className="font-bold text-foreground">{b.serviceNames?.join(', ')}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(b.date), 'MMMM d, yyyy')} at {b.time}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-primary">R{b.totalPrice}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          b.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          b.status === 'confirmed' ? 'bg-purple-100 text-purple-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {b.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );

  const renderCalendar = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-foreground tracking-tight">Booking Calendar</h2>
          <Button onClick={() => onNavigate?.('bookings')} className="bg-primary text-white font-bold">
            <Plus className="w-4 h-4 mr-2" /> New Appointment
          </Button>
        </div>
        
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-purple-500" /> Smart Calendar
            </CardTitle>
            <CardDescription>Select a date to manage appointments.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="flex justify-center p-4 bg-background rounded-2xl border border-border shadow-inner">
              <Calendar
                mode="single"
                selected={selectedCalendarDate}
                onSelect={setSelectedCalendarDate}
                className="rounded-md border-none"
              />
            </div>
            <div className="space-y-4">
              <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                <span>Appointments for {selectedCalendarDate ? format(selectedCalendarDate, 'MMMM d, yyyy') : 'Selected Date'}</span>
                <span className="bg-purple-500 text-white px-2 py-0.5 rounded-full text-[10px]">{filteredBookingsForDate.length}</span>
              </h4>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {filteredBookingsForDate.length === 0 ? (
                  <div className="text-center py-12 bg-background/50 rounded-xl border border-dashed border-border">
                    <CalendarIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                    <p className="text-muted-foreground italic">No appointments scheduled for this day.</p>
                  </div>
                ) : (
                  filteredBookingsForDate.map(booking => (
                    <div key={booking.id} className="p-4 bg-background rounded-xl border border-border shadow-sm group hover:border-primary/50 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground">{booking.clientName}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              booking.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              booking.status === 'confirmed' ? 'bg-purple-100 text-purple-700' :
                              booking.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium">{booking.time} • {booking.serviceNames?.join(', ') || 'No services'}</p>
                        </div>
                        <div className="flex items-center gap-1 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleEditBooking(booking)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {booking.status !== 'cancelled' && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:bg-rose-50" title="Cancel Booking" onClick={() => cancelBooking(booking.id!)}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => deleteBooking(booking.id!)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {booking.clientPhone || 'N/A'}</span>
                        <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> R{booking.totalPrice}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );

  const renderExpenses = () => {
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Expense Tracker</h2>
            <p className="text-sm text-muted-foreground font-medium">Total Expenditure: <span className="text-rose-600 font-bold">R{totalExpenses}</span></p>
          </div>
          <Button onClick={() => { setIsAddingExpense(true); setEditingExpense({ title: '', amount: 0, category: 'Supplies', date: format(new Date(), 'yyyy-MM-dd') }); }} className="bg-primary text-white font-bold">
            <Plus className="w-4 h-4 mr-2" /> Log Expense
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {expenses.length === 0 ? (
            <Card className="border-border shadow-sm p-12 text-center">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground italic">No expenses logged yet.</p>
            </Card>
          ) : (
            expenses.map(e => (
              <Card key={e.id} className="border-border shadow-sm group hover:border-rose-200 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">{e.title}</h4>
                      <p className="text-xs text-muted-foreground font-medium">{e.category} • {e.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <p className="text-lg font-black text-rose-600">-R{e.amount}</p>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => setEditingExpense(e)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => deleteExpense(e.id!)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Expense Edit Modal */}
        {(editingExpense || isAddingExpense) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-6 border-b border-border bg-muted/30">
                <h3 className="text-xl font-black text-foreground">{editingExpense?.id ? 'Edit Expense' : 'Log New Expense'}</h3>
              </div>
              <form onSubmit={saveExpense} className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label>Expense Title</Label>
                  <Input value={editingExpense?.title || ''} onChange={e => setEditingExpense({...editingExpense!, title: e.target.value})} required placeholder="e.g., New Nail Polishes" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (R)</Label>
                    <Input type="number" value={editingExpense?.amount !== undefined && editingExpense?.amount !== null ? editingExpense.amount : ''} onChange={e => setEditingExpense({...editingExpense!, amount: Number(e.target.value)})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={editingExpense?.category || 'Supplies'} onValueChange={val => setEditingExpense({...editingExpense!, category: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Supplies">Supplies</SelectItem>
                        <SelectItem value="Rent">Rent</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Equipment">Equipment</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={editingExpense?.date || ''} onChange={e => setEditingExpense({...editingExpense!, date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Input value={editingExpense?.description || ''} onChange={e => setEditingExpense({...editingExpense!, description: e.target.value})} />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => { setEditingExpense(null); setIsAddingExpense(false); }}>Cancel</Button>
                  <Button type="submit" className="bg-primary text-white font-bold">Save Expense</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    );
  };

  const syncAllAvailability = async () => {
    try {
      toast.loading('Syncing availability...');
      for (const booking of bookings) {
        const duration = getBookingDuration(booking, services);
        await syncAvailability(booking.id!, booking.date, booking.time, duration, booking.status);
      }
      toast.dismiss();
      toast.success('Availability synced successfully!');
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error('Failed to sync availability');
    }
  };

  const renderSettings = () => (
    <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-foreground tracking-tight">Booking Form Settings</h2>
          <Button onClick={saveSettings} className="bg-primary text-white font-bold">
            <Save className="w-4 h-4 mr-2" /> Save All Settings
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Booking Policy */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Booking Policy
              </CardTitle>
              <CardDescription>This will be shown to clients before they book.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={settings.bookingPolicy || ''}
                onChange={e => setSettings({...settings, bookingPolicy: e.target.value})}
                className="w-full h-64 p-4 bg-muted/30 border border-border rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="Enter your booking terms, cancellation policy, etc..."
              />
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-500" /> Cancellation Policy
              </CardTitle>
              <CardDescription>Shown to clients during booking and confirmation.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={settings.cancellationPolicy || ''}
                onChange={e => setSettings({...settings, cancellationPolicy: e.target.value})}
                className="w-full h-64 p-4 bg-muted/30 border border-border rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                placeholder="Enter your cancellation policy (e.g. 24 hour notice required)..."
              />
            </CardContent>
          </Card>

          {/* Gallery Management */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" /> Gallery Images
              </CardTitle>
              <CardDescription>Manage the "Our Work" section on the booking form. Give images names and prices to display them to clients.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Upload Card */}
                <label className="aspect-square rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-all p-4 text-center group">
                  <div className="p-4 bg-muted rounded-full group-hover:scale-110 transition-transform">
                    <Plus className="w-8 h-8 text-primary" />
                  </div>
                  <span className="text-xs font-black text-foreground uppercase mt-3">Add Custom Image</span>
                  <p className="text-[10px] text-muted-foreground max-w-[150px] mt-1">Will be automatically optimized & compressed.</p>
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, addGalleryImage)} />
                </label>

                {gallery.map((img) => (
                  <GalleryItemCard 
                    key={img.id} 
                    img={img} 
                    onRemove={removeGalleryImage} 
                    onUpdate={updateGalleryImageDetails} 
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground font-medium italic">Changes to name and price are automatically saved when you click away/blur the input fields.</p>
            </CardContent>
          </Card>
        </div>

        {/* Promotions and Offers Manager */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary animate-pulse" /> Promotions & Client Offers
            </CardTitle>
            <CardDescription>Create customized discount codes and banner offers that appear instantly on your client's dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddPromotion} className="p-5 bg-muted/20 border border-border rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Offer Title</Label>
                <Input 
                  value={newPromo.title || ''} 
                  onChange={e => setNewPromo({...newPromo, title: e.target.value})} 
                  placeholder="e.g. Winter Specials discount" 
                  required 
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Discount (Value/%)</Label>
                <Input 
                  value={newPromo.discountValue || ''} 
                  onChange={e => setNewPromo({...newPromo, discountValue: e.target.value})} 
                  placeholder="e.g. 15% Off or R50 Off"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Promo Code (Optional)</Label>
                <Input 
                  value={newPromo.promoCode || ''} 
                  onChange={e => setNewPromo({...newPromo, promoCode: e.target.value})} 
                  placeholder="e.g. WINTER15"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Description</Label>
                <Input 
                  value={newPromo.description || ''} 
                  onChange={e => setNewPromo({...newPromo, description: e.target.value})} 
                  placeholder="e.g. Get 15% off on all acrylic sets booked before end of June." 
                  required
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="flex items-center gap-2.5 pb-2">
                <input 
                  type="checkbox" 
                  id="promo-active-input"
                  checked={newPromo.active ?? true} 
                  onChange={e => setNewPromo({...newPromo, active: e.target.checked})} 
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <Label htmlFor="promo-active-input" className="text-xs font-bold text-foreground cursor-pointer">Active Immediately</Label>
              </div>
              <div className="md:col-span-4 flex justify-end">
                <Button type="submit" disabled={isPromoSaving} className="bg-primary text-primary-foreground font-bold px-8 h-10 rounded-xl">
                  {isPromoSaving ? 'Saving Offer...' : 'Create Promotional Banner'}
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Active & Inactive Promotions ({promotions.length})</h4>
              {promotions.length === 0 ? (
                <p className="text-sm text-muted-foreground italic p-4 text-center border border-dashed border-border rounded-2xl">No promotional setups yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {promotions.map((p) => (
                    <div key={p.id} className="p-5 border border-border bg-background rounded-2xl flex items-start justify-between gap-4 shadow-sm transition-colors hover:border-primary/20">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="font-extrabold text-sm text-foreground">{p.title}</h5>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${p.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                            {p.active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                        <div className="flex gap-2 text-[10px] font-bold text-primary">
                          {p.discountValue && <span>• {p.discountValue}</span>}
                          {p.promoCode && <span className="font-mono bg-primary/10 px-1.5 py-0.5 rounded text-primary">CODE: {p.promoCode}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className={`h-8 w-8 text-muted-foreground ${p.active ? 'text-amber-500 bg-amber-500/10' : 'text-emerald-500 bg-emerald-500/10'}`}
                          title={p.active ? 'Pause promotion' : 'Activate promotion'}
                          onClick={() => handleTogglePromo(p.id!, p.active)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                          title="Delete promotion"
                          onClick={() => handleDeletePromo(p.id!)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" /> System Maintenance
            </CardTitle>
            <CardDescription>Advanced tools to keep the system running smoothly.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/30 rounded-2xl border border-border">
              <div>
                <p className="font-bold text-foreground">Sync Availability</p>
                <p className="text-xs text-muted-foreground">Re-sync all bookings to the public availability collection. Use this if slots are not showing correctly.</p>
              </div>
              <Button onClick={syncAllAvailability} variant="outline" className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10">
                Sync Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );

  const renderContent = () => {
    switch (initialTab) {
      case 'services': return renderServices();
      case 'clients': return renderClients();
      case 'calendar': return renderCalendar();
      case 'expenses': return renderExpenses();
      case 'settings': return renderSettings();
      default: return renderOverview();
    }
  };

  const renderOverview = () => (
    <div className="space-y-6 sm:space-y-8">
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tight">Welcome back!</h2>
          <p className="text-muted-foreground font-medium">Here's what's happening with {resolvedTenant.businessName} today.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground bg-muted/50 px-4 py-2 rounded-2xl border border-border">
          <CalendarIcon className="w-4 h-4 text-primary" />
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 rounded-2xl border-primary/20 hover:border-primary hover:bg-primary/5 transition-all"
          onClick={() => onNavigate?.('bookings')}
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">New Booking</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 rounded-2xl border-purple-500/20 hover:border-purple-500 hover:bg-purple-500/5 transition-all"
          onClick={() => onNavigate?.('calendar')}
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Calendar</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 rounded-2xl border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/5 transition-all"
          onClick={() => onNavigate?.('clients')}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Users className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Clients</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 rounded-2xl border-rose-500/20 hover:border-rose-500 hover:bg-rose-500/5 transition-all"
          onClick={() => onNavigate?.('expenses')}
        >
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Expenses</span>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card 
            key={stat.id} 
            className={`border-border shadow-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary/20 ${activeDrillDown === stat.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveDrillDown(activeDrillDown === stat.id ? null : stat.id as DrillDownType)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.title}</CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-foreground">{stat.value}</div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-[10px] font-bold flex items-center gap-1">
                  {stat.trend.includes('+') ? (
                    <span className="text-emerald-600 flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                      {stat.trend}
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center">
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />
                      {stat.trend}
                    </span>
                  )}
                  <span className="text-muted-foreground font-medium">vs last month</span>
                </p>
                {activeDrillDown === stat.id ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Drill Down Sections */}
      <AnimatePresence mode="wait">
        {activeDrillDown === 'revenue' && (
          <motion.div
            key="revenue-drilldown"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" /> Revenue Breakdown
                </CardTitle>
                <CardDescription>Detailed view of completed and confirmed earnings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-background rounded-xl border border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Completed</p>
                    <p className="text-2xl font-black text-emerald-600">R{totalRevenue}</p>
                  </div>
                  <div className="p-4 bg-background rounded-xl border border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Confirmed (Pending Payment)</p>
                    <p className="text-2xl font-black text-amber-600">
                      R{bookings.filter(b => b.status === 'confirmed').reduce((acc, b) => acc + (b.totalPrice || 0), 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-background rounded-xl border border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Total Potential</p>
                    <p className="text-2xl font-black text-primary">
                      R{bookings.filter(b => b.status !== 'cancelled').reduce((acc, b) => acc + (b.totalPrice || 0), 0)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Confirm Completion & Payment</h4>
                  <div className="grid gap-3">
                    {confirmedBookings.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground italic">No confirmed bookings awaiting completion.</p>
                    ) : (
                      confirmedBookings.map(booking => (
                        <div key={booking.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-background rounded-xl border border-border gap-4">
                          <div>
                            <p className="font-bold text-foreground">{booking.clientName}</p>
                            <p className="text-xs text-muted-foreground">{booking.serviceNames?.join(', ') || 'No services'} • {booking.date} at {booking.time}</p>
                          </div>
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <span className="text-lg font-black text-primary mr-4">R{booking.totalPrice}</span>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => cancelBooking(booking.id!)}
                            >
                              <XCircle className="w-4 h-4 mr-2" /> Cancel
                            </Button>
                            <Button 
                              size="sm" 
                              className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none"
                              onClick={() => updateBookingStatus(booking.id!, 'completed')}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Paid & Complete
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeDrillDown === 'active' && (
          <motion.div
            key="active-drilldown"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-purple-500" /> Smart Calendar
                </CardTitle>
                <CardDescription>Select a date to manage appointments.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex justify-center p-4 bg-background rounded-2xl border border-border shadow-inner">
                  <Calendar
                    mode="single"
                    selected={selectedCalendarDate}
                    onSelect={setSelectedCalendarDate}
                    className="rounded-md border-none"
                  />
                </div>
                <div className="space-y-4">
                  <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>Appointments for {selectedCalendarDate ? format(selectedCalendarDate, 'MMMM d, yyyy') : 'Selected Date'}</span>
                      <span className="bg-purple-500 text-white px-2 py-0.5 rounded-full text-[10px]">{filteredBookingsForDate.length}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-[10px] font-black border-purple-200 text-purple-600 hover:bg-purple-50"
                      onClick={() => setIsAddingBooking(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" /> New Appointment
                    </Button>
                  </h4>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {filteredBookingsForDate.length === 0 ? (
                      <div className="text-center py-12 bg-background/50 rounded-xl border border-dashed border-border">
                        <CalendarIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                        <p className="text-muted-foreground italic">No appointments scheduled for this day.</p>
                      </div>
                    ) : (
                      filteredBookingsForDate.map(booking => (
                        <div key={booking.id} className="p-4 bg-background rounded-xl border border-border shadow-sm group hover:border-primary/50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-foreground">{booking.clientName}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  booking.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                  booking.status === 'confirmed' ? 'bg-purple-100 text-purple-700' :
                                  booking.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {booking.status}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground font-medium">{booking.time} • {booking.serviceNames?.join(', ') || 'No services'}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleEditBooking(booking)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {booking.status !== 'cancelled' && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:bg-rose-50" title="Cancel Booking" onClick={() => cancelBooking(booking.id!)}>
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => deleteBooking(booking.id!)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {booking.clientPhone || 'N/A'}</span>
                            <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> R{booking.totalPrice}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeDrillDown === 'pending' && (
          <motion.div
            key="pending-drilldown"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" /> Pending Requests
                </CardTitle>
                <CardDescription>Review and confirm new booking requests.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {pendingBookings.length === 0 ? (
                    <div className="text-center py-12 bg-background/50 rounded-xl border border-dashed border-border">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-20" />
                      <p className="text-muted-foreground italic">All caught up! No pending requests.</p>
                    </div>
                  ) : (
                    pendingBookings.map(booking => (
                      <div key={booking.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-background rounded-2xl border border-border shadow-sm gap-6">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-lg text-foreground">{booking.clientName}</h4>
                            <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">New Request</span>
                            <span className="font-mono text-xs font-black tracking-wider text-purple-700 px-2 py-0.5 bg-purple-100 rounded-md">
                              REF: {booking.referenceNumber || 'NBN-N/A'}
                            </span>
                            {booking.proofOfPaymentSubmitted ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">
                                ✓ POP Submitted
                              </span>
                            ) : (
                              <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] px-2 py-0.5 rounded-full font-black uppercase animate-pulse">
                                Awaiting POP
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-primary" /> {format(parseISO(booking.date), 'EEEE, MMMM d')} at {booking.time}
                          </p>
                          <p className="text-sm font-bold text-primary">{booking.serviceNames?.join(', ') || 'No services'} • R{booking.totalPrice}</p>
                          {booking.notes && (
                            <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border italic">
                              "{booking.notes}"
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                          <Button 
                            variant="outline" 
                            className="w-full sm:w-auto border-rose-200 text-rose-600 hover:bg-rose-50"
                            onClick={() => cancelBooking(booking.id!)}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Decline
                          </Button>
                          <Button 
                            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold"
                            onClick={() => updateBookingStatus(booking.id!, 'confirmed')}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm & Notify
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <Card className="lg:col-span-2 border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Revenue Overview</CardTitle>
            <CardDescription>Weekly performance tracking.</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] sm:h-[300px] pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `R${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#7c3aed', fontWeight: 'bold' }}
                  cursor={{ fill: '#f4f4f5' }}
                />
                <Bar dataKey="revenue" fill="#7c3aed" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
            <CardDescription>Latest booking requests.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {bookings.slice(0, 6).map((booking) => (
                <div key={booking.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-black">
                    {booking.clientName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{booking.clientName}</p>
                    <p className="text-[10px] font-medium text-muted-foreground truncate uppercase tracking-tighter">{booking.serviceNames?.join(', ') || 'No services'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground">{booking.time}</p>
                    <p className="text-[10px] font-medium text-muted-foreground">{booking.date}</p>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <p className="text-center text-muted-foreground py-8 italic text-sm">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automated Reminders Engine Widget */}
      <Card className="border-border shadow-md overflow-hidden bg-card border-primary/20 rounded-[2rem]">
        <CardHeader className="p-6 sm:p-8 border-b border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary animate-pulse" /> Automated Appointment Reminders
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              Scan, review, and trigger friendly reminder alerts for bookings scheduled in the next 24-48 hours. Alerts include secure links to let clients cancel or reschedule autonomously inside the client portal.
            </CardDescription>
          </div>
          <Button
            size="sm"
            disabled={isSendingReminders || getRemindersDue().length === 0}
            onClick={triggerAllRemindersCount}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider rounded-xl h-10 px-5 active:scale-95 transition-all outline-none gap-2 shrink-0 shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            {isSendingReminders ? 'Sending...' : `Send Reminders (${getRemindersDue().length})`}
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {getRemindersDue().length === 0 ? (
              <div className="text-center py-10 bg-muted/20 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-pulse" />
                <p className="text-muted-foreground text-xs font-semibold">All active client appointments have their notification reminders sent!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
                {getRemindersDue().map(booking => (
                  <div key={booking.id} className="p-4 rounded-2xl bg-background border border-border/80 flex items-center justify-between gap-4 hover:border-primary/25 transition-all">
                    <div className="min-w-0 flex-1 col-span-2">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-bold text-foreground truncate">{booking.clientName}</p>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase bg-purple-500/10 text-primary">Due 24-48h</span>
                      </div>
                      <p className="text-[10px] font-semibold text-muted-foreground truncate">{booking.serviceNames?.join(', ')}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {booking.date}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {booking.time}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSendingReminders}
                      onClick={() => triggerReminder(booking)}
                      className="border-primary/40 text-primary hover:bg-primary/10 rounded-xl font-bold text-[10px] px-3 h-8 shrink-0 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Send Alert
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="relative">
      {renderContent()}
      
      {/* Delete Confirmation Modal */}
      {bookingToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-foreground">Delete Appointment?</h3>
              <p className="text-sm text-muted-foreground">This action cannot be undone. Are you sure you want to remove this booking?</p>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setBookingToDelete(null)}>Cancel</Button>
                <Button variant="destructive" className="flex-1 font-bold" onClick={confirmDeleteBooking}>Delete</Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-6 border-b border-border bg-muted/30">
              <h3 className="text-xl font-black text-foreground">Edit Appointment</h3>
              <p className="text-sm text-muted-foreground">Update client details or service info.</p>
            </div>
            <form onSubmit={saveBookingEdit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input value={editingBooking.clientName || ''} onChange={e => setEditingBooking({...editingBooking, clientName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={editingBooking.clientPhone || ''} onChange={e => setEditingBooking({...editingBooking, clientPhone: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Select Services</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-muted/20 rounded-xl border border-border">
                  {services.map(service => (
                    <div key={service.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`edit-service-${service.id}`}
                        checked={editingBooking.serviceIds?.includes(service.id!)}
                        onCheckedChange={(checked) => {
                          const currentServiceIds = editingBooking.serviceIds || [];
                          const newServiceIds = checked 
                            ? [...currentServiceIds, service.id!]
                            : currentServiceIds.filter(id => id !== service.id);
                          
                          const newServices = services
                            .filter(s => newServiceIds.includes(s.id!))
                            .map(s => s.name);
                          
                          const newPrice = services
                            .filter(s => newServiceIds.includes(s.id!))
                            .reduce((acc, s) => acc + s.price, 0);
                          
                          const discount = editingBooking.discountApplied || 0;
                          setEditingBooking({
                            ...editingBooking, 
                            serviceIds: newServiceIds,
                            serviceNames: newServices,
                            totalPrice: Math.max(0, newPrice - discount)
                          });
                        }}
                      />
                      <Label htmlFor={`edit-service-${service.id}`} className="text-xs cursor-pointer">{service.name} (R{service.price})</Label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Loyalty Reward Selector in Edit Dialog */}
              {(() => {
                const matchedClientForEdit = clients.find(c => c.email === editingBooking.clientEmail);
                const editClientPoints = matchedClientForEdit?.loyaltyPoints || 0;
                
                if (editClientPoints >= 100 || (editingBooking.pointsRedeemed && editingBooking.pointsRedeemed > 0)) {
                  // Admin can redeem multiples of 100 points
                  return (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-600 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                          Client Loyalty (Balance: {editClientPoints} pts)
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-6 w-6 rounded border-border"
                            onClick={() => {
                              const currentRedeemed = editingBooking.pointsRedeemed || 0;
                              if (currentRedeemed >= 100) {
                                const nextRedeemed = currentRedeemed - 100;
                                const discount = (nextRedeemed / 100) * 50;
                                const originalCalculatedPrice = services
                                  .filter(s => editingBooking.serviceIds?.includes(s.id!))
                                  .reduce((acc, s) => acc + s.price, 0);
                                setEditingBooking({
                                  ...editingBooking,
                                  pointsRedeemed: nextRedeemed,
                                  discountApplied: discount,
                                  totalPrice: Math.max(0, originalCalculatedPrice - discount)
                                });
                              }
                            }}
                            disabled={!editingBooking.pointsRedeemed || editingBooking.pointsRedeemed === 0}
                          >
                            -
                          </Button>
                          <span className="text-xs font-bold">
                            {Math.floor((editingBooking.pointsRedeemed || 0) / 100)} (R{editingBooking.discountApplied || 0})
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-6 w-6 rounded border-border"
                            onClick={() => {
                              const currentRedeemed = editingBooking.pointsRedeemed || 0;
                              // User can redeem up to their current balance + what was already saved on this booking
                              const savedRedeemed = bookings.find(b => b.id === editingBooking.id)?.pointsRedeemed || 0;
                              const maxRedeemable = Math.floor((editClientPoints + savedRedeemed) / 100) * 100;
                              
                              if (currentRedeemed < maxRedeemable) {
                                const nextRedeemed = currentRedeemed + 100;
                                const discount = (nextRedeemed / 100) * 50;
                                const originalCalculatedPrice = services
                                  .filter(s => editingBooking.serviceIds?.includes(s.id!))
                                  .reduce((acc, s) => acc + s.price, 0);
                                setEditingBooking({
                                  ...editingBooking,
                                  pointsRedeemed: nextRedeemed,
                                  discountApplied: discount,
                                  totalPrice: Math.max(0, originalCalculatedPrice - discount)
                                });
                              }
                            }}
                            disabled={(editingBooking.pointsRedeemed || 0) >= Math.floor((editClientPoints + (bookings.find(b => b.id === editingBooking.id)?.pointsRedeemed || 0)) / 100) * 100}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Every 100 points redeems R50 off. Redeeming {editingBooking.pointsRedeemed || 0} points for R{editingBooking.discountApplied || 0} off.</p>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={editingBooking.date || ''} onChange={e => setEditingBooking({...editingBooking, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={editingBooking.time || ''} onChange={e => setEditingBooking({...editingBooking, time: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={editingBooking.notes || ''} onChange={e => setEditingBooking({...editingBooking, notes: e.target.value})} />
              </div>
              <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                <p className="text-sm font-bold text-primary flex justify-between">
                  <span>Total Price:</span>
                  <span>R{editingBooking.totalPrice}</span>
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setEditingBooking(null)}>Cancel</Button>
                <Button type="submit" className="bg-primary text-white font-bold">Save Changes</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* New Booking Modal */}
      {isAddingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-6 border-b border-border bg-muted/30">
              <h3 className="text-xl font-black text-foreground">New Appointment</h3>
              <p className="text-sm text-muted-foreground">Schedule a new session for a client.</p>
            </div>
            <form onSubmit={saveNewBooking} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-2 bg-muted/30 rounded-xl">
                  <Button 
                    type="button"
                    variant={isNewClientForAdmin ? "default" : "ghost"}
                    className="flex-1 rounded-lg"
                    onClick={() => {
                      setIsNewClientForAdmin(true);
                      setNewBooking({...newBooking, clientName: '', clientEmail: '', clientPhone: ''});
                    }}
                  >
                    New Client
                  </Button>
                  <Button 
                    type="button"
                    variant={!isNewClientForAdmin ? "default" : "ghost"}
                    className="flex-1 rounded-lg"
                    onClick={() => setIsNewClientForAdmin(false)}
                  >
                    Existing Client
                  </Button>
                </div>

                {!isNewClientForAdmin ? (
                  <div className="space-y-2">
                    <Label>Select Client</Label>
                    <Select onValueChange={(val) => {
                      const client = clients.find(c => c.id === val);
                      if (client) {
                        setNewBooking({
                          ...newBooking,
                          clientName: client.name,
                          clientEmail: client.email,
                          clientPhone: client.phone,
                          pointsRedeemed: 0,
                          discountApplied: 0
                        });
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a client..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(client => (
                          <SelectItem key={client.id} value={client.id!}>{client.name} ({client.email})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client Name</Label>
                      <Input value={newBooking.clientName || ''} onChange={e => setNewBooking({...newBooking, clientName: e.target.value})} placeholder="Full Name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Email</Label>
                      <Input type="email" value={newBooking.clientEmail || ''} onChange={e => setNewBooking({...newBooking, clientEmail: e.target.value})} placeholder="email@example.com" />
                    </div>
                  </div>
                )}

                {isNewClientForAdmin && (
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input value={newBooking.clientPhone || ''} onChange={e => setNewBooking({...newBooking, clientPhone: e.target.value})} placeholder="071 234 5678" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Select Services</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-muted/20 rounded-xl border border-border">
                    {services.map(service => (
                      <div key={service.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`new-service-${service.id}`}
                          checked={newBooking.serviceNames?.includes(service.name)}
                          onCheckedChange={(checked) => {
                            const currentServiceIds = newBooking.serviceIds || [];
                            const newServiceIds = checked 
                              ? [...currentServiceIds, service.id!]
                              : currentServiceIds.filter(id => id !== service.id);
                            
                            const newServices = services
                              .filter(s => newServiceIds.includes(s.id!))
                              .map(s => s.name);
                            
                            const newPrice = services
                              .filter(s => newServiceIds.includes(s.id!))
                              .reduce((acc, s) => acc + s.price, 0);
                            
                            const discount = newBooking.discountApplied || 0;
                            setNewBooking({
                              ...newBooking, 
                              serviceIds: newServiceIds,
                              serviceNames: newServices,
                              totalPrice: Math.max(0, newPrice - discount)
                            });
                          }}
                        />
                        <Label htmlFor={`new-service-${service.id}`} className="text-xs cursor-pointer">{service.name} (R{service.price})</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* New Booking Loyalty Points Panel */}
                {(() => {
                  const matchedClientForNew = clients.find(c => c.email === newBooking.clientEmail);
                  const newClientPoints = matchedClientForNew?.loyaltyPoints || 0;
                  
                  if (!isNewClientForAdmin && newClientPoints >= 100) {
                    return (
                      <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-600 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                            Client Loyalty (Balance: {newClientPoints} pts)
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-6 w-6 rounded border-border"
                              onClick={() => {
                                const currentRedeemed = newBooking.pointsRedeemed || 0;
                                if (currentRedeemed >= 100) {
                                  const nextRedeemed = currentRedeemed - 100;
                                  const discount = (nextRedeemed / 100) * 50;
                                  const originalCalculatedPrice = services
                                    .filter(s => newBooking.serviceIds?.includes(s.id!))
                                    .reduce((acc, s) => acc + s.price, 0);
                                  setNewBooking({
                                    ...newBooking,
                                    pointsRedeemed: nextRedeemed,
                                    discountApplied: discount,
                                    totalPrice: Math.max(0, originalCalculatedPrice - discount)
                                  });
                                }
                              }}
                              disabled={!newBooking.pointsRedeemed || newBooking.pointsRedeemed === 0}
                            >
                              -
                            </Button>
                            <span className="text-xs font-bold">
                              {Math.floor((newBooking.pointsRedeemed || 0) / 100)} (R{newBooking.discountApplied || 0})
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-6 w-6 rounded border-border"
                              onClick={() => {
                                const currentRedeemed = newBooking.pointsRedeemed || 0;
                                const maxRedeemable = Math.floor(newClientPoints / 100) * 100;
                                if (currentRedeemed < maxRedeemable) {
                                  const nextRedeemed = currentRedeemed + 100;
                                  const discount = (nextRedeemed / 100) * 50;
                                  const originalCalculatedPrice = services
                                    .filter(s => newBooking.serviceIds?.includes(s.id!))
                                    .reduce((acc, s) => acc + s.price, 0);
                                  setNewBooking({
                                    ...newBooking,
                                    pointsRedeemed: nextRedeemed,
                                    discountApplied: discount,
                                    totalPrice: Math.max(0, originalCalculatedPrice - discount)
                                  });
                                }
                              }}
                              disabled={(newBooking.pointsRedeemed || 0) >= Math.floor(newClientPoints / 100) * 100}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Every 100 points redeems R50 off. Redeeming {newBooking.pointsRedeemed || 0} points for R{newBooking.discountApplied || 0} off.</p>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={newBooking.date || ''} onChange={e => setNewBooking({...newBooking, date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input type="time" value={newBooking.time || ''} onChange={e => setNewBooking({...newBooking, time: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Input value={newBooking.notes || ''} onChange={e => setNewBooking({...newBooking, notes: e.target.value})} placeholder="Any special requests..." />
                </div>

                <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                  <p className="text-sm font-bold text-primary flex justify-between">
                    <span>Total Price:</span>
                    <span>R{newBooking.totalPrice}</span>
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setIsAddingBooking(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary text-white font-bold">Create Appointment</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
