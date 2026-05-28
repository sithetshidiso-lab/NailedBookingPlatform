import { useState, useEffect } from 'react';
import { format, addDays, startOfToday, isSameDay, parseISO, isAfter } from 'date-fns';
import { Service, Booking, AppSettings, Client, GalleryImage } from '../types';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, getDoc, getDocs, updateDoc, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Check, Clock, Calendar as CalendarIcon, User, Phone, Mail, FileText, Info, ChevronRight, ChevronLeft, Image as ImageIcon, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';
import { isTimeSlotAvailable, getBookingDuration, generateTimeSlots } from '@/lib/booking-utils';
import { sendConfirmationEmail } from '@/services/emailService';
import { syncAvailability } from '@/lib/availability-utils';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'motion/react';
import { tenant } from '../tenant';

interface BookingPlatformProps {
  services: Service[];
  clients: Client[];
  isAdmin: boolean;
  isGalleryOpen?: boolean;
  setIsGalleryOpen?: (open: boolean) => void;
}

const TIME_SLOTS = generateTimeSlots("07:30", "18:00", 30);

export function BookingPlatform({ 
  services, 
  clients, 
  isAdmin, 
  isGalleryOpen = false, 
  setIsGalleryOpen 
}: BookingPlatformProps) {
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfToday());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastBookingData, setLastBookingData] = useState<any>(null);
  const [isNewClient, setIsNewClient] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  // Slideshow auto-play (3 existing images max)
  useEffect(() => {
    const slideCount = Math.min(gallery.length, 3);
    if (slideCount <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, 4500);
    return () => clearInterval(interval);
  }, [gallery.length]);

  // Keys control for the expanded lightbox
  useEffect(() => {
    if (activeImageIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveImageIndex(prev => (prev === null ? 0 : (prev === 0 ? gallery.length - 1 : prev - 1)));
      } else if (e.key === 'ArrowRight') {
        setActiveImageIndex(prev => (prev === null ? 0 : (prev === gallery.length - 1 ? 0 : prev + 1)));
      } else if (e.key === 'Escape') {
        setActiveImageIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImageIndex, gallery.length]);

  const handlePrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeImageIndex === null || gallery.length === 0) return;
    setActiveImageIndex(prev => (prev === null ? 0 : (prev === 0 ? gallery.length - 1 : prev - 1)));
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeImageIndex === null || gallery.length === 0) return;
    setActiveImageIndex(prev => (prev === null ? 0 : (prev === gallery.length - 1 ? 0 : prev + 1)));
  };

  useEffect(() => {
    const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const galleryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GalleryImage));
      setGallery(galleryData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gallery');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'app'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as AppSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/app');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const q = query(collection(db, 'availability'), where('date', '==', dateStr));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as Booking));
      setExistingBookings(bookingsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'availability');
    });

    return () => unsubscribe();
  }, [selectedDate]);

  const isSlotAvailable = (time: string) => {
    const duration = totalDuration || 60; // Default to 60 if no service selected
    return isTimeSlotAvailable(time, duration, existingBookings, services);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId) 
        : [...prev, serviceId]
    );
  };

  const selectedServices = services.filter(s => selectedServiceIds.includes(s.id!));
  const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);
  const totalDuration = selectedServices.reduce((acc, s) => acc + (s.duration || 0), 0);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServiceIds.length === 0 || !selectedDate || !selectedTime || !formData.name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!isAdmin && !policyAccepted) {
      toast.error('Please read and accept the booking policy');
      return;
    }

    setIsSubmitting(true);

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const refCode = `NBN-${randomSuffix}`;

      const bookingData: Omit<Booking, 'id'> = {
        serviceIds: selectedServiceIds,
        serviceNames: selectedServices.map(s => s.name),
        clientName: formData.name,
        clientEmail: formData.email,
        clientPhone: formData.phone,
        date: dateStr,
        time: selectedTime,
        status: isAdmin ? 'confirmed' : 'pending',
        notes: formData.notes,
        totalPrice: totalPrice,
        createdAt: new Date().toISOString(),
        policyAccepted: true,
        referenceNumber: refCode,
        proofOfPaymentSubmitted: false
      };

      if (!isSlotAvailable(selectedTime)) {
        toast.error('This slot is no longer available. Please choose another time.');
        setIsSubmitting(false);
        return;
      }

      const bookingDoc = await addDoc(collection(db, 'bookings'), bookingData);
      
      // Sync to availability collection (publicly readable)
      try {
        await syncAvailability(
          bookingDoc.id, 
          bookingData.date, 
          bookingData.time, 
          totalDuration, 
          bookingData.status
        );
      } catch (syncError) {
        console.error('Failed to sync availability:', syncError);
      }
      
      // Send confirmation email
      try {
        const emailResult = await sendConfirmationEmail({ ...bookingData, id: bookingDoc.id } as Booking);
        if (emailResult.success) {
          await updateDoc(doc(db, 'bookings', bookingDoc.id), {
            confirmationEmailSent: true,
            confirmationId: emailResult.confirmationId
          });
        }
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // We don't block the booking if email fails, but we log it
      }
      
      // Create or update client record (both admin and client portal submissions)
      {
        const clientsRef = collection(db, 'clients');
        const clientQuery = query(clientsRef, where('email', '==', formData.email));
        const clientSnapshot = await getDocs(clientQuery);
        
        if (clientSnapshot.empty) {
          await addDoc(clientsRef, {
            name: formData.name,
            email: formData.email,
            phone: formData.phone || '',
            lastBooking: new Date().toISOString(),
            totalBookings: 1,
            notes: formData.notes || '',
            loyaltyPoints: 0
          });
        } else {
          const clientDoc = clientSnapshot.docs[0];
          const clientData = clientDoc.data();
          await updateDoc(doc(db, 'clients', clientDoc.id), {
            name: formData.name,
            phone: formData.phone || clientData.phone || '',
            lastBooking: new Date().toISOString(),
            totalBookings: (clientData.totalBookings || 0) + 1,
            notes: formData.notes ? `${clientData.notes || ''}\n${formData.notes}` : (clientData.notes || ''),
            loyaltyPoints: clientData.loyaltyPoints !== undefined ? clientData.loyaltyPoints : 0
          });
        }
      }
      
      toast.success(isAdmin ? 'Booking created successfully!' : 'Booking request sent! We will confirm shortly.');
      
      setLastBookingData({
        ...bookingData,
        id: bookingDoc.id
      });
      setIsSuccess(true);
      
      setSelectedServiceIds([]);
      setSelectedTime('');
      setFormData({ name: '', email: '', phone: '', notes: '' });
      setPolicyAccepted(false);
      setSelectedClientId('');
      setIsNewClient(true);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClientSelect = (clientId: string) => {
    if (clientId === 'new') {
      setIsNewClient(true);
      setSelectedClientId('');
      setFormData({ name: '', email: '', phone: '', notes: '' });
    } else {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setIsNewClient(false);
        setSelectedClientId(clientId);
        setFormData({
          name: client.name,
          email: client.email,
          phone: client.phone || '',
          notes: ''
        });
      }
    }
  };

  const handleWhatsAppTrigger = async () => {
    if (!lastBookingData?.id) return;
    try {
      await updateDoc(doc(db, 'bookings', lastBookingData.id), {
        proofOfPaymentSubmitted: true
      });
      const parsedServices = lastBookingData.serviceNames.join(', ');
      const textMessage = `Hi! Here is my proof of payment for booking *${lastBookingData.referenceNumber || 'NBN-XXXXX'}* for R${lastBookingData.totalPrice} (${parsedServices}) on ${lastBookingData.date} at ${lastBookingData.time}.`;
      const whatsappUrl = `https://wa.me/${tenant.whatsappPhone}?text=${encodeURIComponent(textMessage)}`;
      window.open(whatsappUrl, '_blank', 'referrer');
      toast.success('Opening WhatsApp. Thank you!');
    } catch (e) {
      console.error(e);
      const parsedServices = lastBookingData.serviceNames.join(', ');
      const textMessage = `Hi! Here is my proof of payment for booking *${lastBookingData.referenceNumber || 'NBN-XXXXX'}* for R${lastBookingData.totalPrice} (${parsedServices}) on ${lastBookingData.date} at ${lastBookingData.time}.`;
      window.open(`https://wa.me/${tenant.whatsappPhone}?text=${encodeURIComponent(textMessage)}`, '_blank', 'referrer');
    }
  };

  if (isSuccess && lastBookingData) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 h-full flex flex-col justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <Card className="border-border shadow-2xl rounded-[2.5rem] overflow-hidden bg-card">
            <div className="bg-gradient-to-tr from-primary to-violet-950 p-10 text-center text-primary-foreground relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full filter blur-xl" />
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12 }}
                className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <Check className="w-8 h-8 text-white" />
              </motion.div>
              <h2 className="text-3xl font-black tracking-tight mb-1">Booking Pending!</h2>
              <p className="font-semibold text-xs uppercase tracking-widest opacity-80">Awaiting Deposit Match</p>
            </div>
            
            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Reference Plate */}
              <div className="p-5 bg-muted/40 rounded-2xl text-center border border-border space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Your Payment Reference Number</p>
                <p className="font-mono text-2xl font-black text-primary tracking-wider">{lastBookingData.referenceNumber || 'NBN-XXXXX'}</p>
                <p className="text-[10px] text-muted-foreground font-semibold">Copy this and use it as your payment reference.</p>
              </div>

              {/* Booking Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 border-y border-border">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Scheduled Date & Time</p>
                  <p className="font-bold text-foreground">{format(parseISO(lastBookingData.date), 'EEEE, MMMM d, yyyy')}</p>
                  <p className="text-primary font-black text-sm">at {lastBookingData.time}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Requested Services</p>
                  <p className="font-bold text-foreground text-sm leading-tight truncate">{lastBookingData.serviceNames.join(', ')}</p>
                  <p className="text-primary font-black text-base">Total amount: R{lastBookingData.totalPrice}</p>
                </div>
              </div>

              {/* Bank Transfer Details */}
              <div className="p-5 border border-primary/20 bg-primary/5 rounded-2xl space-y-2">
                <h4 className="text-xs font-black text-foreground uppercase tracking-wider">South African Bank EFT Instructions:</h4>
                <div className="grid grid-cols-2 gap-y-1 text-xs sm:text-sm font-semibold">
                  <span className="text-muted-foreground">Bank:</span>
                  <span className="text-foreground">First National Bank (FNB)</span>
                  <span className="text-muted-foreground">Account Holder:</span>
                  <span className="text-foreground">{tenant.businessName}</span>
                  <span className="text-muted-foreground">Account Number:</span>
                  <span className="text-foreground">62908756345</span>
                  <span className="text-muted-foreground">Branch Code:</span>
                  <span className="text-foreground">250655</span>
                  <span className="text-primary font-bold">Reference:</span>
                  <span className="text-primary font-black">{lastBookingData.referenceNumber || 'NBN-XXXXX'}</span>
                </div>
              </div>

              {/* Cancellation Policy */}
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                <p className="text-[11px] text-rose-600 font-bold leading-relaxed">
                  <strong>Cancellation/Refund Policy:</strong> {settings?.cancellationPolicy || 'All cancellations must be updated 24 hours prior to your slot to claim deposit refunds.'}
                </p>
              </div>

              {/* CTAs */}
              <div className="pt-2 flex flex-col gap-3">
                <Button 
                  onClick={handleWhatsAppTrigger} 
                  className="w-full h-12 bg-[#25d366] hover:bg-[#20ba5a] text-zinc-950 font-black rounded-xl shadow-md uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                >
                  Submit Proof of Payment on WhatsApp →
                </Button>
                <div className="flex gap-3">
                  <Button onClick={() => setIsSuccess(false)} variant="outline" className="flex-1 h-11 border-border font-bold rounded-xl text-xs uppercase">
                    New Booking
                  </Button>
                  <Button variant="ghost" onClick={() => window.print()} className="flex-1 h-11 text-muted-foreground font-semibold rounded-xl text-xs uppercase">
                    Print Slip
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Interactive Featured Slideshow Section on landing */}
      {gallery.length > 0 && (
        <section className="space-y-6 pt-4 max-w-3xl mx-auto">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-foreground tracking-tighter">Featured Masterpieces</h3>
            <p className="text-muted-foreground font-medium text-sm">A tiny snippet of our nail art. Click to view the full catalogue.</p>
          </div>
          
          <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full rounded-[2.5rem] overflow-hidden border border-border shadow-2xl group bg-muted/40">
            <AnimatePresence mode="wait">
              {gallery.slice(0, 3).map((img, index) => {
                if (index !== currentSlide) return null;
                return (
                  <motion.div
                    key={img.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    onClick={() => setIsGalleryOpen?.(true)}
                    className="absolute inset-0 cursor-pointer"
                  >
                    <img 
                      src={img.url} 
                      alt={img.name || `Slideshow ${index}`} 
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                      referrerPolicy="no-referrer"
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                    {/* Image Name and Price - Bottom Right corner */}
                    {(img.name || img.price) && (
                      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md px-4 py-2 border border-white/10 rounded-2xl text-white text-[11px] font-black tracking-tight shadow-xl flex flex-col items-end z-10">
                        {img.name && <span className="font-bold">{img.name}</span>}
                        {img.price !== undefined && img.price !== null && (
                          <span className="text-primary font-black text-[11px] mt-0.5">R{img.price}</span>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Slideshow Arrows */}
            {gallery.slice(0, 3).length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentSlide(prev => (prev === 0 ? Math.min(gallery.length, 3) - 1 : prev - 1)); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 hover:scale-110 active:scale-95 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm z-20"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentSlide(prev => (prev === Math.min(gallery.length, 3) - 1 ? 0 : prev + 1)); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 hover:scale-110 active:scale-95 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm z-20"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Dots indicators */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                  {gallery.slice(0, 3).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); setCurrentSlide(idx); }}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-primary scale-125 w-6' : 'bg-white/50 hover:bg-white'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-center">
            <Button 
              onClick={() => setIsGalleryOpen?.(true)} 
              variant="outline" 
              className="rounded-full border-primary/20 text-primary hover:bg-primary/5 font-extrabold text-xs px-6 py-2"
            >
              <ImageIcon className="w-4 h-4 mr-2" /> Browse Full Catalogue ({gallery.length} Designs)
            </Button>
          </div>
        </section>
      )}

      {/* Full Gallery Catalogue Overlay Modal */}
      <AnimatePresence>
        {isGalleryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col p-4 sm:p-8 overflow-y-auto"
          >
            <div className="max-w-6xl w-full mx-auto space-y-8 flex-1 flex flex-col justify-between py-8">
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <div>
                  <h2 className="text-3xl font-black text-foreground tracking-tighter flex items-center gap-2">
                    <ImageIcon className="w-8 h-8 text-primary" /> Inspiration Gallery
                  </h2>
                  <p className="text-muted-foreground font-medium text-sm">Browse our designs. Click to expand and navigate.</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-12 w-12 hover:bg-muted border border-border"
                  onClick={() => setIsGalleryOpen?.(false)}
                >
                  <XCircle className="w-6 h-6 text-foreground" />
                </Button>
              </div>

              {/* Grid of all Gallery Images */}
              {gallery.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <ImageIcon className="w-16 h-16 text-muted-foreground/50" />
                  <p className="text-muted-foreground font-semibold">No designs added to the catalogue yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {gallery.map((img, i) => (
                    <motion.div
                      key={img.id}
                      whileHover={{ scale: 1.03 }}
                      onClick={() => setActiveImageIndex(i)}
                      className="aspect-square rounded-3xl overflow-hidden border border-border shadow-lg group relative cursor-pointer bg-muted"
                    >
                      <img 
                        src={img.url} 
                        alt={img.name || `Design ${i}`} 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                      />
                      
                      {/* Thumbnail overlay */}
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors" />

                      {/* Name and Price on bottom-right corner of every thumbnail */}
                      {(img.name || img.price) && (
                        <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-xl text-white text-[10px] font-black tracking-tight flex flex-col items-end border border-white/5 z-10 transition-transform group-hover:translate-x-[-2px] group-hover:translate-y-[-2px]">
                          {img.name && <span className="opacity-95">{img.name}</span>}
                          {img.price !== undefined && img.price !== null && (
                            <span className="text-primary font-bold mt-0.5">R{img.price}</span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="flex justify-center pt-8">
                <Button 
                  onClick={() => setIsGalleryOpen?.(false)} 
                  className="bg-primary text-primary-foreground font-bold rounded-2xl px-8 h-12 shadow-lg"
                >
                  Close Catalogue
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Lightbox Slider */}
      <AnimatePresence>
        {activeImageIndex !== null && gallery[activeImageIndex] && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
            onClick={() => setActiveImageIndex(null)}
          >
            {/* Immersive Image Display */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[80vh] flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <img 
                src={gallery[activeImageIndex].url} 
                alt={gallery[activeImageIndex].name || `Gallery ${activeImageIndex}`}
                className="max-w-full max-h-[75vh] object-contain rounded-3xl shadow-2xl border border-white/10" 
                referrerPolicy="no-referrer"
              />

              {/* Name and Price on bottom-right corner of Expanded Lightbox Image! */}
              {(gallery[activeImageIndex].name || gallery[activeImageIndex].price) && (
                <div className="absolute bottom-6 right-6 bg-black/85 backdrop-blur-md p-4 rounded-2xl text-white text-sm font-black tracking-tight shadow-xl flex flex-col items-end border border-white/10 select-none">
                  {gallery[activeImageIndex].name && (
                    <span className="text-base text-foreground font-extrabold">{gallery[activeImageIndex].name}</span>
                  )}
                  {gallery[activeImageIndex].price !== undefined && gallery[activeImageIndex].price !== null && (
                    <span className="text-primary text-sm font-black mt-1">R{gallery[activeImageIndex].price}</span>
                  )}
                </div>
              )}

              {/* Chevron Navigation inside lightbox */}
              {gallery.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-[-2rem] sm:left-[-4rem] top-1/2 -translate-y-1/2 text-white hover:bg-white/10 rounded-full h-12 w-12 border border-white/10 backdrop-blur-sm shadow-xl z-20"
                    onClick={handlePrevImage}
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-[-2rem] sm:right-[-4rem] top-1/2 -translate-y-1/2 text-white hover:bg-white/10 rounded-full h-12 w-12 border border-white/10 backdrop-blur-sm shadow-xl z-20"
                    onClick={handleNextImage}
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>
                </>
              )}

              {/* Top-right close button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute -top-16 right-0 text-white hover:bg-white/10 rounded-full border border-white/10 h-10 w-10 z-20"
                onClick={() => setActiveImageIndex(null)}
              >
                <XCircle className="w-6 h-6" />
              </Button>
            </motion.div>

            {/* Progress dot info */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/50 font-black">
              {activeImageIndex + 1} / {gallery.length} • Swipe or use Arrow keys
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Service Selection - Storefront Style */}
        <div className="lg:col-span-2 space-y-8">
          <section className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-foreground tracking-tighter">Choose Services</h2>
              <p className="text-muted-foreground font-medium">Select one or more treatments for your session.</p>
            </div>
            
            {Object.entries(
              services.reduce((acc, s) => {
                if (!acc[s.category]) acc[s.category] = [];
                acc[s.category].push(s);
                return acc;
              }, {} as Record<string, Service[]>)
            ).map(([category, categoryServices]) => {
              const isExpanded = expandedCategories[category] === true; // Default to collapsed
              return (
                <div key={category} className="space-y-4">
                  <button 
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between group py-2 px-4 rounded-full bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em]">
                      {category}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-primary/60">{categoryServices.length} Services</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                          {categoryServices.map((s) => (
                            <motion.div
                              key={s.id}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => toggleService(s.id!)}
                              className={`
                                relative group cursor-pointer overflow-hidden rounded-3xl border-2 transition-all duration-300
                                ${selectedServiceIds.includes(s.id!) 
                                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' 
                                  : 'border-border bg-card hover:border-primary/30 hover:shadow-md'}
                              `}
                            >
                              <div className="flex h-32">
                                <div className="w-1/3 h-full overflow-hidden bg-muted">
                                  {s.image ? (
                                    <img src={s.image} alt={s.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                      <ImageIcon className="w-8 h-8 opacity-20" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 p-4 flex flex-col justify-between">
                                  <div>
                                    <h4 className="font-bold text-foreground leading-tight">{s.name}</h4>
                                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{s.description || 'Professional styling treatment.'}</p>
                                  </div>
                                  <div className="flex justify-between items-end">
                                    <div className="space-y-0.5">
                                      <p className="text-xs font-bold text-primary">R{s.price}</p>
                                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {s.duration} min
                                      </p>
                                    </div>
                                    {selectedServiceIds.includes(s.id!) && (
                                      <div className="bg-primary text-primary-foreground p-1.5 rounded-full">
                                        <Check className="w-3 h-3" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </section>

          <section className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-foreground tracking-tighter">Pick a Time</h2>
              <p className="text-muted-foreground font-medium">When should we expect you?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-card border border-border p-6 rounded-[2rem] shadow-sm">
              <div className="space-y-4">
                <Label className="text-foreground font-bold uppercase text-xs tracking-widest">1. Select Date</Label>
                <div className="flex justify-center p-2 bg-muted/30 rounded-2xl border border-border">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < startOfToday()}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-foreground font-bold uppercase text-xs tracking-widest">2. Select Slot</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TIME_SLOTS.map((time) => {
                    const available = isSlotAvailable(time);
                    return (
                      <Button
                        key={time}
                        variant={selectedTime === time ? "default" : "outline"}
                        disabled={!available}
                        onClick={() => setSelectedTime(time)}
                        className={`
                          h-12 rounded-xl text-sm font-bold transition-all
                          ${selectedTime === time ? 'bg-primary text-primary-foreground shadow-lg' : 'border-border text-muted-foreground hover:bg-primary/5 hover:text-primary'}
                          ${!available ? 'opacity-20 grayscale cursor-not-allowed' : ''}
                        `}
                      >
                        {time}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Checkout Sidebar */}
        <div className="space-y-6 sticky top-8">
          <Card className="border-border shadow-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-xl font-black text-foreground">Your Booking</CardTitle>
              <CardDescription className="text-muted-foreground font-medium">Review your selections</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                {selectedServices.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground italic text-sm">No services selected yet.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedServices.map(s => (
                      <div key={s.id} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="font-bold text-foreground">{s.name}</span>
                        </div>
                        <span className="font-black text-primary">R{s.price}</span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-border flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Estimated Time</span>
                      <span className="text-xs font-bold text-foreground">{totalDuration} minutes</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-lg font-black text-foreground uppercase tracking-tighter">Total</span>
                      <span className="text-3xl font-black text-primary">R{totalPrice}</span>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleBooking} className="space-y-4">
                {isAdmin && (
                  <div className="space-y-3 pb-2 border-b border-border">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client Selection</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        type="button" 
                        variant={isNewClient ? 'default' : 'outline'} 
                        onClick={() => handleClientSelect('new')}
                        className="h-10 rounded-xl text-xs font-bold"
                      >
                        New Client
                      </Button>
                      <select 
                        className="h-10 rounded-xl bg-muted/30 border border-border px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary"
                        value={selectedClientId}
                        onChange={(e) => handleClientSelect(e.target.value)}
                      >
                        <option value="">Select Existing</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  <Input
                    placeholder="Full Name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-12 rounded-xl bg-muted/30 border-border"
                    required
                    readOnly={isAdmin && !isNewClient}
                  />
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-12 rounded-xl bg-muted/30 border-border"
                    required
                    readOnly={isAdmin && !isNewClient}
                  />
                  <Input
                    placeholder="Phone Number"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-12 rounded-xl bg-muted/30 border-border"
                    readOnly={isAdmin && !isNewClient}
                  />
                  <Input
                    placeholder="Special Requests"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="h-12 rounded-xl bg-muted/30 border-border"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl space-y-2">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1">
                      <Info className="w-3 h-3" /> Cancellation Policy
                    </p>
                    <p className="text-[10px] text-rose-600/70 font-bold leading-tight">
                      {settings?.cancellationPolicy || '24h notice required for refunds.'}
                    </p>
                  </div>

                  {!isAdmin && (
                    <div className="flex items-start space-x-3 p-3 bg-muted/20 rounded-xl border border-border">
                      <Checkbox 
                        id="policy" 
                        checked={policyAccepted} 
                        onCheckedChange={(checked) => setPolicyAccepted(checked as boolean)}
                        className="mt-1"
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="policy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">
                          I have read and accept the <button type="button" onClick={() => setShowPolicy(true)} className="text-primary underline">Booking Policy</button>
                        </label>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting || selectedServiceIds.length === 0}
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95"
                  >
                    {isSubmitting ? 'Processing...' : isAdmin ? 'Create Appointment' : 'Book Appointment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Policy Modal */}
      <AnimatePresence>
        {showPolicy && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background border border-border rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-border bg-primary/5">
                <h3 className="text-2xl font-black text-foreground tracking-tighter">Booking Policy</h3>
                <p className="text-sm text-muted-foreground font-medium">Please review our terms before booking.</p>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-8">
                <div className="prose prose-sm text-muted-foreground font-medium">
                  <h4 className="text-foreground font-bold flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-primary" /> Booking Rules
                  </h4>
                  {settings?.bookingPolicy ? (
                    <div dangerouslySetInnerHTML={{ __html: settings.bookingPolicy.replace(/\n/g, '<br/>') }} />
                  ) : (
                    <p>Standard booking terms apply.</p>
                  )}
                </div>

                <div className="prose prose-sm text-muted-foreground font-medium p-6 bg-rose-50 rounded-3xl border border-rose-100">
                  <h4 className="text-rose-700 font-bold flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4" /> Cancellation Policy
                  </h4>
                  {settings?.cancellationPolicy ? (
                    <div dangerouslySetInnerHTML={{ __html: settings.cancellationPolicy.replace(/\n/g, '<br/>') }} />
                  ) : (
                    <p>Cancellations must be made at least 24 hours in advance to receive a full deposit refund.</p>
                  )}
                </div>
              </div>
              <div className="p-8 border-t border-border flex justify-end">
                <Button onClick={() => setShowPolicy(false)} className="bg-primary text-white font-bold rounded-xl px-8">
                  Got it
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

