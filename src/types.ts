export interface Service {
  id?: string;
  name: string;
  category: string;
  price: number;
  duration: number; // in minutes
  image?: string; // base64 or URL
  description?: string;
}

export interface Booking {
  id?: string;
  serviceIds: string[];
  serviceNames: string[];
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  depositPaid?: boolean;
  totalPrice: number;
  notes?: string;
  createdAt?: string;
  policyAccepted: boolean;
  confirmationEmailSent?: boolean;
  confirmationId?: string;
  referenceNumber?: string;
  proofOfPaymentSubmitted?: boolean;
  originalPrice?: number;
  discountApplied?: number;
  pointsRedeemed?: number;
  pointsEarned?: number;
  pointsAwarded?: boolean;
  pointsRefunded?: boolean;
  reminderSent?: boolean;
  reminderSentAt?: string;
}

export interface Promotion {
  id?: string;
  title: string;
  description: string;
  discountValue?: string | number;
  promoCode?: string;
  active: boolean;
  createdAt?: string;
}

export interface AppSettings {
  id?: string;
  bookingPolicy: string;
  cancellationPolicy: string;
  galleryImages: string[]; // array of base64 or URLs
}

export interface Client {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  lastBooking?: string;
  totalBookings?: number;
  loyaltyPoints?: number;
}

export interface Expense {
  id?: string;
  title: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  description?: string;
}

export interface GalleryImage {
  id?: string;
  url: string; // base64 or URL
  name?: string;
  price?: number;
  createdAt?: any;
}
