import { Booking, Service } from '../types';
import { parse, addMinutes, isBefore, isAfter, isEqual, format } from 'date-fns';

/**
 * Generates an array of time slots between start and end times.
 */
export const generateTimeSlots = (start: string, end: string, intervalMinutes: number): string[] => {
  const slots: string[] = [];
  let current = parse(start, 'HH:mm', new Date());
  const endTime = parse(end, 'HH:mm', new Date());

  while (current <= endTime) {
    slots.push(format(current, 'HH:mm'));
    current = addMinutes(current, intervalMinutes);
  }
  return slots;
};

/**
 * Calculates the total duration of a booking based on its service IDs.
 */
export const getBookingDuration = (booking: Partial<Booking>, services: Service[]): number => {
  if (!booking.serviceIds || booking.serviceIds.length === 0) return 0;
  
  return services
    .filter(s => booking.serviceIds?.includes(s.id!))
    .reduce((acc, s) => acc + (s.duration || 0), 0);
};

/**
 * Checks if a proposed time slot overlaps with any existing bookings.
 * 
 * @param proposedTime The start time of the proposed booking (HH:MM)
 * @param proposedDuration The duration of the proposed booking in minutes
 * @param existingBookings List of existing bookings for the same day
 * @param services List of all available services (to calculate durations of existing bookings)
 * @param excludeBookingId Optional ID of a booking to exclude from the check (useful for editing)
 */
export const isTimeSlotAvailable = (
  proposedTime: string,
  proposedDuration: number,
  existingBookings: Booking[],
  services: Service[],
  excludeBookingId?: string
): boolean => {
  if (!proposedTime || proposedDuration <= 0) return true;

  const proposedStart = parse(proposedTime, 'HH:mm', new Date());
  const proposedEnd = addMinutes(proposedStart, proposedDuration);

  for (const booking of existingBookings) {
    if (booking.id === excludeBookingId) continue;
    if (booking.status === 'cancelled') continue;

    const bookingDuration = (booking as any).duration || getBookingDuration(booking, services);
    const bookingStart = parse(booking.time, 'HH:mm', new Date());
    const bookingEnd = addMinutes(bookingStart, bookingDuration);

    // Check for overlap:
    // (StartA < EndB) AND (EndA > StartB)
    const hasOverlap = isBefore(proposedStart, bookingEnd) && isAfter(proposedEnd, bookingStart);
    
    if (hasOverlap) {
      return false;
    }
  }

  return true;
};
