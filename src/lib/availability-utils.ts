import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

/**
 * Syncs a booking's availability to a public collection that doesn't contain PII.
 * This allows visitors to see which slots are taken without needing full read access to bookings.
 */
export const syncAvailability = async (bookingId: string, date: string, time: string, duration: number, status: string) => {
  const availabilityRef = doc(db, 'availability', bookingId);
  
  if (status === 'cancelled') {
    await deleteDoc(availabilityRef);
  } else {
    await setDoc(availabilityRef, {
      date,
      time,
      duration,
      bookingId,
      status
    });
  }
};
