import { Service } from './types';

export const INITIAL_SERVICES: Service[] = [
  // New Set
  { name: "Acrylic Tips", category: "New Set", price: 350, duration: 90 },
  { name: "Acrylic Sculpture", category: "New Set", price: 450, duration: 120 },
  { name: "Acrylic Overlay", category: "New Set", price: 300, duration: 60 },
  { name: "Basic Manicure (With Strengthener)", category: "New Set", price: 200, duration: 45 },
  { name: "Gel Overlay", category: "New Set", price: 280, duration: 60 },
  { name: "Hybrid Overlay", category: "New Set", price: 350, duration: 75 },
  { name: "Hybrid Gel Tips", category: "New Set", price: 400, duration: 90 },
  { name: "Hybrid Gel Sculpture", category: "New Set", price: 500, duration: 120 },
  
  // Maintenance
  { name: "1 Week Fill", category: "Maintenance", price: 150, duration: 45 },
  { name: "2 Week Fill", category: "Maintenance", price: 230, duration: 60 },
  { name: "3 Week Fill", category: "Maintenance", price: 330, duration: 75 },
  { name: "4 Week Fill", category: "Maintenance", price: 400, duration: 90 },
  { name: "Acrylic Soak Off", category: "Maintenance", price: 100, duration: 30 },
  { name: "Gel Soak Off", category: "Maintenance", price: 50, duration: 20 },
  
  // Toes & Pedicures
  { name: "Gel Overlay (Toes)", category: "Toes & Pedicures", price: 250, duration: 45 },
  { name: "Acrylic Overlay (Big Toes Only)", category: "Toes & Pedicures", price: 280, duration: 45 },
  { name: "Express Pedicure", category: "Toes & Pedicures", price: 180, duration: 30 },
  { name: "Spa Feel Pedicure", category: "Toes & Pedicures", price: 250, duration: 60 },
  { name: "Spa Feel Milk & Honey Pedicure", category: "Toes & Pedicures", price: 300, duration: 75 },
];
