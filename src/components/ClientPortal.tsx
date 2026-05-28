import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { Service, Booking, Promotion, Client, GalleryImage } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookingPlatform } from './BookingPlatform';
import { syncAvailability } from '@/lib/availability-utils';
import { 
  Sparkles, 
  CalendarDays, 
  History, 
  MessageCircle, 
  Clock, 
  Coins, 
  LogOut, 
  Compass, 
  Heart, 
  ClipboardCheck, 
  ExternalLink,
  ChevronRight,
  MapPin,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { tenant } from '../tenant';

interface ClientPortalProps {
  user: FirebaseUser;
  services: Service[];
  onLogout: () => void;
  isGalleryOpen: boolean;
  setIsGalleryOpen: (open: boolean) => void;
}

export function ClientPortal({ user, services, onLogout, isGalleryOpen, setIsGalleryOpen }: ClientPortalProps) {
  const [activeSegment, setActiveSegment] = useState<'home' | 'book' | 'history'>('home');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [clientRecord, setClientRecord] = useState<Client | null>(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('09:00');

  // Load user's bookings
  useEffect(() => {
    if (!user.email) return;
    const q = query(
      collection(db, 'bookings'),
      where('clientEmail', '==', user.email)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      // Sort client-side by date & time descending to ensure latest is first
      bookingsData.sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());
      setMyBookings(bookingsData);
      setLoadingBookings(false);
    }, (error) => {
      console.error('Error loading my bookings:', error);
      setLoadingBookings(false);
    });

    return () => unsubscribe();
  }, [user.email]);

  // Load promotions
  useEffect(() => {
    const q = query(collection(db, 'promotions'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const promoData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion));
      setPromotions(promoData);
    }, (error) => {
      console.error('Error loading promotions:', error);
    });

    return () => unsubscribe();
  }, []);

  // Fetch client record for additional stats
  useEffect(() => {
    if (!user.email) return;
    const q = query(collection(db, 'clients'), where('email', '==', user.email));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setClientRecord({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Client);
      }
    }, (error) => {
      console.error('Error fetching client stats:', error);
    });
    return () => unsubscribe();
  }, [user.email]);

  const handleWhatsAppPayment = async (booking: Booking) => {
    if (!booking.id) {
      toast.error('Booking ID is missing.');
      return;
    }
    
    try {
      // Mark proofOfPaymentSubmitted as true in Firestore
      await updateDoc(doc(db, 'bookings', booking.id), {
        proofOfPaymentSubmitted: true
      });
      
      const parsedServices = booking.serviceNames.join(', ');
      const textMessage = `Hi! Here is my proof of payment for booking *${booking.referenceNumber}* for R${booking.totalPrice} (${parsedServices}) on ${booking.date} at ${booking.time}.`;
      
      const whatsappUrl = `https://wa.me/${tenant.whatsappPhone}?text=${encodeURIComponent(textMessage)}`;
      
      toast.info('Sending proof of payment. This will open WhatsApp...');
      window.open(whatsappUrl, '_blank', 'referrer');
    } catch (e: any) {
      console.error('WhatsApp payload trigger error:', e);
      toast.error('Could not submit payment trigger.');
    }
  };

  const handleClientCancel = async (booking: Booking) => {
    if (!booking.id) return;
    const confirm = window.confirm("Are you sure you want to cancel this booking?");
    if (!confirm) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancellationReason: 'Cancelled by client via Client Portal'
      });
      // Sync availability as cancelled
      try {
        await syncAvailability(booking.id, booking.date, booking.time, 30, 'cancelled');
      } catch (availError) {
        console.error('Failed to sync availability:', availError);
      }

      // Refund loyalty points if redeemed
      if (booking.pointsRedeemed && booking.pointsRedeemed > 0 && !booking.pointsRefunded) {
        if (clientRecord && clientRecord.id) {
          await updateDoc(doc(db, 'clients', clientRecord.id), {
            loyaltyPoints: (clientRecord.loyaltyPoints || 0) + booking.pointsRedeemed
          });
          await updateDoc(doc(db, 'bookings', booking.id), {
            pointsRefunded: true
          });
          toast.success(`Refunded ${booking.pointsRedeemed} loyalty points!`);
        }
      }
      // Reverse points if completed (should not normally happen but safe)
      if (booking.pointsAwarded && (booking.pointsEarned || 0) > 0) {
        if (clientRecord && clientRecord.id) {
          await updateDoc(doc(db, 'clients', clientRecord.id), {
            loyaltyPoints: Math.max(0, (clientRecord.loyaltyPoints || 0) - booking.pointsEarned!)
          });
        }
        await updateDoc(doc(db, 'bookings', booking.id), {
          pointsAwarded: false,
          pointsEarned: 0
        });
      }
      toast.success("Booking cancelled successfully.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to cancel booking.");
    }
  };

  const handleClientReschedule = async (bookingId: string, newDate: string, newTime: string) => {
    try {
      if (!newDate || !newTime) {
        toast.error("Please select a valid date and time.");
        return;
      }
      const booking = myBookings.find(b => b.id === bookingId);
      if (!booking) return;

      // Update booking
      await updateDoc(doc(db, 'bookings', bookingId), {
        date: newDate,
        time: newTime,
        status: 'pending' // Admin will confirm the new slot
      });
      // Re-sync availability
      try {
        await syncAvailability(bookingId, newDate, newTime, 30, 'pending');
      } catch (availError) {
        console.error('Failed to sync availability:', availError);
      }
      toast.success("Rescheduled successfully! Awaiting validation.");
      setRescheduleBookingId(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to reschedule.");
    }
  };

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">Confirmed</span>;
      case 'pending':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">Pending Deposit</span>;
      case 'completed':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">Completed</span>;
      case 'cancelled':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">Cancelled</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-muted/20 text-muted-foreground">Unknown</span>;
    }
  };

  const upcomingBookings = myBookings.filter(b => b.status === 'confirmed' || b.status === 'pending');
  const pastBookings = myBookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 px-4 py-4 sm:py-8">
      {/* Greetings Header Panel */}
      <div className="bg-gradient-to-tr from-[#0e071f]/60 to-[#1e0e3f]/40 border border-primary/20 p-6 sm:p-10 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-primary/10 rounded-full filter blur-3xl pointer-events-none" />
        
        <div className="space-y-3 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-[10px] tracking-widest font-extrabold uppercase text-primary">CLIENT PORTAL</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-normal font-serif text-foreground">
            Hi, <span className="italic text-primary font-medium">{user.displayName || 'Nail Lover'}!</span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl">
            Welcome to your personal dashboard. Here you can track your magical nail sessions, review our latest designs, and book new slots seamlessly.
          </p>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onLogout} 
            className="rounded-full border-border text-muted-foreground hover:text-foreground h-10 px-5 font-bold"
          >
            <LogOut className="w-4 h-4 mr-2 text-rose-500" /> Logout
          </Button>
        </div>
      </div>

      {/* Segment Navigation */}
      <div className="flex border-b border-border/60 pb-1 gap-2 overflow-x-auto">
        {[
          { id: 'home', label: 'Dashboard Home', icon: Compass },
          { id: 'book', label: 'Schedule Appointment', icon: CalendarDays },
          { id: 'history', label: 'My Bookings History', icon: History },
        ].map((seg) => {
          const Icon = seg.icon;
          const isActive = activeSegment === seg.id;
          return (
            <button
              key={seg.id}
              onClick={() => setActiveSegment(seg.id as any)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all shrink-0 uppercase tracking-wider ${
                isActive 
                  ? 'border-primary text-primary font-black bg-primary/5 rounded-t-xl' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              {seg.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSegment}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
        >
          {/* Dashboard Home View */}
          {activeSegment === 'home' && (
            <div className="space-y-8">
              {/* Promotions Section */}
              {promotions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                    <Megaphone className="w-4.5 h-4.5 text-primary animate-bounceHeading" /> Exclusive Offers & Settings Promo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {promotions.map((promo) => (
                      <div 
                        key={promo.id} 
                        className="p-6 rounded-3xl bg-gradient-to-tr from-[#160d2b] to-[#251547] border border-primary/30 relative overflow-hidden group shadow-xl"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full filter blur-2xl" />
                        <span className="absolute top-4 right-4 text-[10px] sm:text-xs font-black bg-primary text-primary-foreground px-3 py-1 rounded-full shadow-lg">
                          Promo Offer
                        </span>
                        
                        <div className="space-y-2.5">
                          <h4 className="text-lg font-extrabold text-white tracking-tight leading-snug">{promo.title}</h4>
                          <p className="text-muted-foreground text-sm leading-relaxed">{promo.description}</p>
                          
                          <div className="flex items-center gap-3 pt-2">
                            {promo.discountValue && (
                              <div className="px-3.5 py-1 bg-violet-500/20 text-violet-300 rounded-lg text-xs font-extrabold border border-violet-500/30">
                                {promo.discountValue} Off
                              </div>
                            )}
                            {promo.promoCode && (
                              <div className="px-3.5 py-1 bg-orange-500/25 text-orange-300 font-mono rounded-lg text-xs font-bold border border-orange-500/20">
                                CODE: {promo.promoCode}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Hub Panel (Stats) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-border bg-card shadow-sm rounded-3xl p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Total Bookings</p>
                    <p className="text-2xl font-black text-foreground">{myBookings.length}</p>
                  </div>
                </Card>

                <Card className="border-border bg-card shadow-sm rounded-3xl p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Active Pending Sessions</p>
                    <p className="text-2xl font-black text-foreground">{myBookings.filter(b => b.status === 'pending').length}</p>
                  </div>
                </Card>

                <Card className="border-border bg-card shadow-sm rounded-3xl p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Confirmed Bookings</p>
                    <p className="text-2xl font-black text-foreground">{myBookings.filter(b => b.status === 'confirmed').length}</p>
                  </div>
                </Card>

                <Card className="border-primary/20 bg-card shadow-sm rounded-3xl p-6 flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full filter blur-xl" />
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Loyalty Points</p>
                    <p className="text-2xl font-black text-foreground">{clientRecord?.loyaltyPoints || 0} pts</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 font-bold">
                      {clientRecord?.loyaltyPoints && clientRecord.loyaltyPoints >= 100 
                        ? `R${Math.floor(clientRecord.loyaltyPoints / 100) * 50} discount ready!` 
                        : `${100 - ((clientRecord?.loyaltyPoints || 0) % 100)} pts to next R50 off`}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Direct Link to Book CTA */}
              <div className="p-8 bg-gradient-to-tr from-card to-muted/20 border border-border/80 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
                <div className="space-y-1 text-center md:text-left">
                  <h4 className="text-xl font-bold text-foreground">Ready for some custom nail art?</h4>
                  <p className="text-muted-foreground text-xs sm:text-sm font-medium">Select a slot, read our booking guidelines and let us create magic for your hands.</p>
                </div>
                <Button 
                  onClick={() => setActiveSegment('book')}
                  className="bg-primary text-primary-foreground font-black px-8 py-4 h-auto rounded-2xl text-xs uppercase tracking-widest shrink-0 active:scale-95 duration-150"
                >
                  Book New Session Now →
                </Button>
              </div>

              {/* Quick view of upcoming bookings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                    <CalendarDays className="w-4.5 h-4.5 text-primary" /> Upcoming Sessions
                  </h3>
                  {upcomingBookings.length > 3 && (
                    <button onClick={() => setActiveSegment('history')} className="text-primary hover:underline font-bold text-xs uppercase tracking-wider uppercase">
                      View All
                    </button>
                  )}
                </div>

                {loadingBookings ? (
                  <div className="p-8 text-center animate-pulse text-sm text-muted-foreground">Loading schedules...</div>
                ) : upcomingBookings.length === 0 ? (
                  <div className="p-10 border border-dashed border-border rounded-3xl text-center space-y-3">
                    <p className="text-muted-foreground text-sm font-medium">No upcoming sessions found.</p>
                    <Button variant="outline" size="sm" onClick={() => setActiveSegment('book')} className="rounded-full border-primary/40 text-primary">
                      Book Now
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingBookings.slice(0, 3).map((booking) => (
                      <BookingCompactCard 
                        key={booking.id} 
                        booking={booking} 
                        onSubmitPayment={handleWhatsAppPayment} 
                        getStatusBadge={getStatusBadge}
                        onCancelBooking={handleClientCancel}
                        onRescheduleBooking={(b) => {
                          setRescheduleBookingId(b.id || null);
                          setRescheduleDate(b.date);
                          setRescheduleTime(b.time);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Book A New Appointment Scheduler */}
          {activeSegment === 'book' && (
            <Card className="border-border shadow-md rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-6 sm:p-8 border-b border-border/40 bg-muted/10">
                <CardTitle className="text-2xl font-serif">Schedule Your Session</CardTitle>
                <CardDescription>Select your desired nail arts and choose an open slot. Since you are logged in, we've pre-filled your details.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <BookingPlatform 
                  services={services} 
                  clients={[]} 
                  isAdmin={false} 
                  isGalleryOpen={isGalleryOpen}
                  setIsGalleryOpen={setIsGalleryOpen}
                />
              </CardContent>
            </Card>
          )}

          {/* Booking History Tab */}
          {activeSegment === 'history' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-black text-foreground uppercase tracking-widest">Active & Pending Sessions ({upcomingBookings.length})</h3>
                {upcomingBookings.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic font-medium">No active or pending appointments.</p>
                ) : (
                  <div className="space-y-4">
                    {upcomingBookings.map((booking) => (
                      <BookingCompactCard 
                        key={booking.id} 
                        booking={booking} 
                        onSubmitPayment={handleWhatsAppPayment} 
                        getStatusBadge={getStatusBadge}
                        onCancelBooking={handleClientCancel}
                        onRescheduleBooking={(b) => {
                          setRescheduleBookingId(b.id || null);
                          setRescheduleDate(b.date);
                          setRescheduleTime(b.time);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-lg font-black text-foreground uppercase tracking-widest">Completed & Cancelled Sessions ({pastBookings.length})</h3>
                {pastBookings.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic font-medium">No historic sessions found.</p>
                ) : (
                  <div className="space-y-4">
                    {pastBookings.map((booking) => (
                      <BookingCompactCard 
                        key={booking.id} 
                        booking={booking} 
                        onSubmitPayment={handleWhatsAppPayment} 
                        getStatusBadge={getStatusBadge}
                        onCancelBooking={handleClientCancel}
                        onRescheduleBooking={(b) => {
                          setRescheduleBookingId(b.id || null);
                          setRescheduleDate(b.date);
                          setRescheduleTime(b.time);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Reschedule Modal */}
      {rescheduleBookingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4">
            <h3 className="text-xl font-black text-foreground flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-purple-600 animate-pulse" /> Reschedule Session
            </h3>
            <p className="text-xs text-muted-foreground">Change your appointment timing. The salon admin will review and re-confirm your session.</p>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Select New Date</label>
                <input
                  type="date"
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-sm font-semibold"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Select New Time</label>
                <input
                  type="time"
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-sm font-semibold"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setRescheduleBookingId(null)}>Close</Button>
              <Button 
                className="flex-1 font-bold bg-primary text-white rounded-xl" 
                onClick={() => handleClientReschedule(rescheduleBookingId, rescheduleDate, rescheduleTime)}
              >
                Confirm
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Compact row for rendering client booking
interface PromoCompactProps {
  booking: Booking;
  onSubmitPayment: (b: Booking) => void;
  getStatusBadge: (status: Booking['status']) => React.ReactNode;
  onCancelBooking?: (b: Booking) => void;
  onRescheduleBooking?: (b: Booking) => void;
}

function BookingCompactCard({ booking, onSubmitPayment, getStatusBadge, onCancelBooking, onRescheduleBooking }: PromoCompactProps) {
  const isPending = booking.status === 'pending';

  return (
    <div className="p-5 sm:p-6 bg-card border border-border/70 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all hover:border-primary/20 shadow-sm relative overflow-hidden">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-black tracking-wider text-primary px-2.5 py-1 bg-primary/10 rounded-lg">
            REF: {booking.referenceNumber || 'NBN-N/A'}
          </span>
          {getStatusBadge(booking.status)}
          
          {booking.proofOfPaymentSubmitted ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
              POP Submitted
            </span>
          ) : (
            isPending && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                Awaiting POP
              </span>
            )
          )}
        </div>

        <div className="space-y-0.5">
          <p className="text-base font-extrabold text-foreground">{booking.serviceNames.join(', ')}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-semibold">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-primary" /> {format(parseISO(booking.date), 'EEEE, d MMMM yyyy')}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" /> {booking.time}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-primary" /> Total: R{booking.totalPrice}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full md:w-auto shrink-0 flex flex-wrap items-center gap-3">
        {isPending && (
          <Button 
            onClick={() => onSubmitPayment(booking)}
            className="w-full md:w-auto bg-[#1ade6e] hover:bg-[#16c461] text-zinc-950 font-black text-xs rounded-xl h-10 px-5 active:scale-95 transition-all outline-none"
          >
            <MessageCircle className="w-4 h-4 mr-1.5 fill-current" /> Submit POP to WhatsApp
          </Button>
        )}
        {(booking.status === 'confirmed' || booking.status === 'pending') && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full md:w-auto border-purple-200 text-purple-700 hover:bg-purple-100/40 rounded-xl font-bold h-10 px-4 text-xs"
              onClick={() => onRescheduleBooking?.(booking)}
            >
              Reschedule
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full md:w-auto border-red-200 text-red-600 hover:bg-rose-100/40 rounded-xl font-bold h-10 px-4 text-xs"
              onClick={() => onCancelBooking?.(booking)}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
export default ClientPortal;
