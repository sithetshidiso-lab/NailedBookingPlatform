import { Booking } from '../types';

/**
 * Simulates sending a confirmation email to the client.
 * In a production environment, this would use an API like Resend, SendGrid, or Mailgun.
 */
export const sendConfirmationEmail = async (booking: Booking): Promise<{ success: boolean; confirmationId: string }> => {
  console.log(`[Email Service] Sending confirmation email to ${booking.clientEmail}...`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const confirmationId = `CONF-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
  
  console.log(`[Email Service] Email sent successfully to ${booking.clientEmail}. Confirmation ID: ${confirmationId}`);
  
  return {
    success: true,
    confirmationId
  };
};

/**
 * Simulates sending an automated reminder email or SMS to the client 24-48 hours before their appointment.
 * Dispatched notifications prompt clients with their scheduled timing and include instant reschedule/cancellation portal capabilities.
 */
export const sendReminderEmail = async (booking: Booking): Promise<{ success: boolean; reminderId: string }> => {
  console.log(`[Email Service] Dispatching 24h/48h alert reminder email to ${booking.clientEmail} for appointment on ${booking.date} at ${booking.time}...`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const reminderId = `REM-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
  
  console.log(`[Email Service] Automated reminder email sent successfully to ${booking.clientEmail}. Reminder ID: ${reminderId}`);
  
  return {
    success: true,
    reminderId
  };
};
