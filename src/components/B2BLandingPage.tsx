import { useState } from 'react';
import { 
  Sparkles, 
  Scissors, 
  Calendar, 
  Users, 
  TrendingUp, 
  Smartphone, 
  CheckCircle, 
  MessageSquare, 
  ShieldCheck, 
  Globe, 
  ChevronRight, 
  Star, 
  ArrowRight, 
  Layers, 
  CreditCard,
  Crown,
  Heart,
  Palette,
  Check,
  SmartphoneIcon,
  Play
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { motion, AnimatePresence } from 'motion/react';

interface B2BLandingPageProps {
  onStartSignUp: () => void;
  onLoginClick: () => void;
}

export function B2BLandingPage({ onStartSignUp, onLoginClick }: B2BLandingPageProps) {
  const [activeFeatureTab, setActiveFeatureTab] = useState<'scheduler' | 'branding' | 'crm' | 'finance'>('scheduler');
  const [demoSelectedServices, setDemoSelectedServices] = useState<string[]>(['1']);
  const [demoTimeSlot, setDemoTimeSlot] = useState<string>('12:00');

  const demoServices = [
    { id: '1', name: 'Premium Sculptured Acrylics', price: 'R450', duration: '90 min' },
    { id: '2', name: 'Minimalist Nail Art (Full Set)', price: 'R180', duration: '30 min' },
    { id: '3', name: 'Safe Gel Polish Removal', price: 'R80', duration: '20 min' },
  ];

  const handleToggleDemoService = (id: string) => {
    if (demoSelectedServices.includes(id)) {
      if (demoSelectedServices.length > 1) {
        setDemoSelectedServices(demoSelectedServices.filter(s => s !== id));
      }
    } else {
      setDemoSelectedServices([...demoSelectedServices, id]);
    }
  };

  const calculateDemoTotal = () => {
    return demoServices
      .filter(s => demoSelectedServices.includes(s.id))
      .reduce((sum, s) => sum + parseInt(s.price.replace('R', '')), 0);
  };

  return (
    <div className="font-sans text-zinc-300 bg-zinc-950 overflow-x-hidden min-h-screen">
      {/* Absolute Ambient Background Radials */}
      <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] bg-violet-900/10 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[60%] h-[50%] bg-primary/5 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[50%] h-[50%] bg-violet-950/10 rounded-full filter blur-[150px] pointer-events-none" />

      {/* 1. Hero Section & B2B Hook */}
      <section className="relative px-4 pt-16 sm:pt-24 pb-20 border-b border-zinc-900/60 lg:px-8">
        <div className="max-w-6xl mx-auto text-center space-y-8">
          
          {/* Tagline micro-capsule */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-full bg-zinc-900 border border-violet-500/20 shadow-[0_4px_15px_rgba(192,132,252,0.05)]"
          >
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-[10px] tracking-[0.2em] font-mono font-black text-violet-300 uppercase">
              B2B SALON OPERATIONS PLATFORM
            </span>
          </motion.div>

          {/* Heading with exquisite editorial typographic hierarchy */}
          <div className="space-y-4">
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-6xl lg:text-7xl font-normal leading-[1.1] text-white tracking-tight max-w-4xl mx-auto font-serif"
            >
              The modern booking engine for <span className="italic text-primary font-medium">independent beauty creators</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-zinc-400 text-sm sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed select-none"
            >
              Effortless touchpoint scheduling, bespoke client portals, expense trackers, and custom styled workspaces. Create your branded booking gateway in under 60 seconds.
            </motion.p>
          </div>

          {/* Dual Action CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 relative z-20"
          >
            <Button
              onClick={onStartSignUp}
              className="w-full sm:w-auto rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider h-14 px-8 shadow-2xl shadow-primary/20 transition-all hover:scale-[1.03] active:scale-95 duration-200"
            >
              Claim Your Free Workspace <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={onLoginClick}
              variant="outline"
              className="w-full sm:w-auto rounded-full border-zinc-800 hover:bg-zinc-900/60 text-zinc-300 font-bold text-xs uppercase tracking-wider h-14 px-8 transition-colors"
            >
              Access Member Portal
            </Button>
          </motion.div>

          {/* Trust points */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3 pt-6 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-primary" /> No credit card required
            </div>
            <span className="hidden sm:inline opacity-30">|</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-primary" /> Host private booking links
            </div>
            <span className="hidden sm:inline opacity-30">|</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-[#1ade6e]" /> 1-Click WhatsApp integration
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Interactive App Simulator Widget (Visualizing the actual tool benefits live) */}
      <section className="px-4 py-20 bg-zinc-950 relative border-b border-zinc-900/60">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Lefthand value copywriting */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-1.5 text-xs font-mono font-black text-primary uppercase">
              <Smartphone className="w-4 h-4" /> Live Experience Simulator
            </div>
            <h2 className="text-3xl sm:text-5xl font-normal text-white tracking-tight leading-tight font-serif">
              A bespoke scheduler <span className="italic font-medium text-emerald-400">clients adore.</span>
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
              Don't force your clients to use clumsy directories or app downloads. Qflow provides a gorgeous, lightning-fast web experience that feels like visiting a boutique hotel lobby. Try the simulator on the right to see why slots fill up faster.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-950/50 border border-violet-800/30 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Client-Centric Bliss</h4>
                  <p className="text-xs text-zinc-400">Add custom service categories, notes, prices, durations, and elegant visual guides.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-950/50 border border-emerald-800/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Instant WhatsApp Audits</h4>
                  <p className="text-xs text-zinc-400">Clients submit bookings and send structured proof of payments straight to your chats.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Righthand Live interactive simulator box */}
          <div className="lg:col-span-7">
            <div className="relative mx-auto max-w-[420px] rounded-[3rem] border-[10px] border-zinc-800 bg-zinc-950/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-5 w-28 bg-zinc-800 rounded-b-2xl z-40 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full" />
              </div>

              {/* Simulation Screen Container */}
              <div className="px-5 pt-8 pb-6 space-y-6 text-left">
                {/* Simulated Header */}
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs font-serif">
                      N
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white leading-tight">Nailed by Nesh</p>
                      <p className="text-[9px] text-zinc-500 font-mono">/nailed-by-nesh</p>
                    </div>
                  </div>
                  <span className="text-[8px] tracking-wider uppercase bg-[#1ade6e]/10 text-[#1ade6e] border border-[#1ade6e]/20 px-2 py-0.5 rounded-full font-bold">
                    Booking Link Live
                  </span>
                </div>

                {/* Step indicators */}
                <div className="space-y-1">
                  <p className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase font-black">Step 1 — Choose Treatment</p>
                  <p className="text-xs text-zinc-300 font-semibold">Select nail options to calculate total duration</p>
                </div>

                {/* Simulated Services */}
                <div className="space-y-2">
                  {demoServices.map((service) => {
                    const isSelected = demoSelectedServices.includes(service.id);
                    return (
                      <div 
                        key={service.id}
                        onClick={() => handleToggleDemoService(service.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'bg-primary/5 border-primary/60 shadow-[0_4px_12px_rgba(192,132,252,0.06)]' 
                            : 'bg-zinc-900/40 border-zinc-900 hover:border-zinc-800'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-white">{service.name}</p>
                          <p className="text-[9px] text-zinc-500 font-semibold">{service.duration} duration</p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <p className="text-xs font-mono font-black text-primary">{service.price}</p>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'bg-primary border-primary text-white' : 'border-zinc-700'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Simulated Calendar Selector */}
                <div className="space-y-2">
                  <p className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase font-black">Step 2 — Selecting Clean Time slot</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['09:00', '12:00', '15:30', '18:00'].map((time) => {
                      const isSelected = demoTimeSlot === time;
                      return (
                        <div
                          key={time}
                          onClick={() => setDemoTimeSlot(time)}
                          className={`py-2 rounded-xl text-center text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-purple-950 border border-primary/40 text-primary' 
                              : 'bg-zinc-900 border border-transparent text-zinc-400 hover:bg-zinc-900/60'
                          }`}
                        >
                          {time}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Simulated Summary Desk */}
                <div className="p-3 bg-zinc-900/40 border border-zinc-900 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase font-bold">Estimated Total</p>
                    <p className="font-mono text-white font-extrabold text-sm">R{calculateDemoTotal()}</p>
                  </div>
                  <Button 
                    onClick={onStartSignUp}
                    className="h-8 rounded-full bg-primary text-white text-[10px] font-black uppercase tracking-wider"
                  >
                    Confirm Slots →
                  </Button>
                </div>
              </div>

              {/* Home bar decorator */}
              <div className="w-32 h-1 bg-zinc-800 mx-auto mb-2 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Gorgeous Grid Highlighting key B2B features */}
      <section className="px-4 py-24 border-b border-zinc-900/60">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <span className="text-[10px] tracking-[0.25em] font-mono font-black text-primary uppercase block">
              ENTERPRISE-GRADE WORKFLOWS
            </span>
            <h2 className="text-3xl sm:text-5xl font-normal leading-tight tracking-tight text-white font-serif max-w-2xl mx-auto">
              Everything required to run <span className="italic text-primary">your beauty business.</span>
            </h2>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              Eliminate standard admin fatigue. Integrate automated scheduling, finances, and client journals in one portal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Feature 1 */}
            <Card className="bg-zinc-900/30 border-border/40 hover:border-primary/20 backdrop-blur-sm p-6 rounded-3xl group transition-all duration-300">
              <div className="w-10 h-10 rounded-2xl bg-violet-950/50 border border-violet-800/40 flex items-center justify-center text-primary mb-5 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <Palette className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Bespoke Brand Identity</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Choose custom taglines, artist biographies, WhatsApp trigger parameters, and gallery items. Host an elite catalog on your private handle.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-zinc-900/30 border-border/40 hover:border-primary/20 backdrop-blur-sm p-6 rounded-3xl group transition-all duration-300">
              <div className="w-10 h-10 rounded-2xl bg-violet-950/50 border border-violet-800/40 flex items-center justify-center text-primary mb-5 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Automated Ledger</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Track historic service volumes, completed slot records, specific references, and client email journals without paper manifests.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-zinc-900/30 border-border/40 hover:border-primary/20 backdrop-blur-sm p-6 rounded-3xl group transition-all duration-300">
              <div className="w-10 h-10 rounded-2xl bg-violet-950/50 border border-violet-800/40 flex items-center justify-center text-primary mb-5 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Detailed Expense Logs</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Log salon supplies, polish orders, rent overheads, and miscellaneous operations. Monitor clean margins alongside incoming billing.
              </p>
            </Card>

            {/* Feature 4 */}
            <Card className="bg-zinc-900/30 border-border/40 hover:border-primary/20 backdrop-blur-sm p-6 rounded-3xl group transition-all duration-300">
              <div className="w-10 h-10 rounded-2xl bg-[#1ade6e]/10 border border-[#1ade6e]/20 flex items-center justify-center text-[#1ade6e] mb-5 group-hover:bg-[#1ade6e] group-hover:text-zinc-950 transition-all duration-300">
                <SmartphoneIcon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">No App Setup Required</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Clients link directly from your Instagram bio or WhatsApp card. Complete scheduling on mobile web instantly under secure schemas.
              </p>
            </Card>

          </div>
        </div>
      </section>

      {/* 4. Interactive Subscription Pricing Matrix */}
      <section className="px-4 py-24 bg-gradient-to-tr from-zinc-950 via-zinc-950 to-violet-950/10 border-b border-zinc-900/60">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <span className="text-[10px] tracking-[0.25em] font-mono font-black text-amber-400 uppercase block">
              TRANSPARENT TIER PACKAGES
            </span>
            <h2 className="text-3xl sm:text-5xl font-normal leading-tight tracking-tight text-white font-serif">
              Simple plans for businesses <span className="italic text-amber-400">of any scale.</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
              Start on our feature-packed Free plan, and upgrade to dynamic Pro features when your studio activity scales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* Free Plan Card */}
            <Card className="bg-zinc-900/30 border-border/40 p-8 rounded-3xl flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">Free Workspace</h3>
                    <p className="text-xs text-zinc-500">Perfect for private room artists</p>
                  </div>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 font-bold px-3 py-1 rounded-full uppercase tracking-wider">Standard</span>
                </div>

                <div className="flex items-baseline gap-1 py-1">
                  <span className="text-4xl font-extrabold text-white">R0</span>
                  <span className="text-xs text-zinc-500">/ forever free</span>
                </div>

                <div className="border-t border-border/30 pt-6 space-y-3.5">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-black">Plan features:</p>
                  {[
                    'Host branded scheduling page',
                    'Configure up to 10 treatments/services',
                    'Basic active clients catalog',
                    'Interactive scheduler engine',
                    'Proof of payment via WhatsApp',
                  ].map((feat) => (
                    <div key={feat} className="flex items-center gap-2.5 text-xs text-zinc-300">
                      <Check className="w-4 h-4 text-violet-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                  
                  {/* Upsell warning card representation */}
                  <div className="mt-4 p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                    <p className="text-[10px] font-mono text-rose-400/80 uppercase font-black mb-1">Longevity Warning</p>
                    <p className="text-[10.5px] text-zinc-400 leading-normal">
                      Workspaces running past 30 days are visually flagged with upgrade conversion calls. Perfect to trial the system!
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <Button 
                  onClick={onStartSignUp}
                  className="w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-border/60 text-xs font-bold uppercase tracking-wider h-11"
                >
                  Create Free Workspace
                </Button>
              </div>
            </Card>

            {/* Pro Plan Card */}
            <Card className="bg-zinc-900/60 border-amber-500/30 p-8 rounded-3xl flex flex-col justify-between relative overflow-hidden shadow-[0_15px_40px_-5px_rgba(245,158,11,0.05)]">
              {/* Premium Glow Top Accent Line */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 to-amber-600" />
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-1.5">
                      Pro Membership <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                    </h3>
                    <p className="text-xs text-amber-500/90 font-medium">For scaling studios & full salons</p>
                  </div>
                  <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 font-black px-3 py-1 rounded-full uppercase tracking-wider">Premium</span>
                </div>

                <div className="flex items-baseline gap-1 py-1">
                  <span className="text-4xl font-extrabold text-white">R199</span>
                  <span className="text-xs text-zinc-500">/ per month</span>
                </div>

                <div className="border-t border-border/30 pt-6 space-y-3.5">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-black">Everything in Free, plus:</p>
                  {[
                    'Unlock unlimited services listings',
                    'Zero Qflow branding watermarks',
                    'Priority customer styling support',
                    'No inactive day thresholds (Lifetime valid)',
                    'Enhanced interactive analytics dashboard',
                    'Comprehensive expenses diagnostics sheets',
                  ].map((feat) => (
                    <div key={feat} className="flex items-center gap-2.5 text-xs text-zinc-300">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8">
                <Button 
                  onClick={onStartSignUp}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-black text-xs uppercase tracking-wider h-11"
                >
                  Activate Pro Space
                </Button>
              </div>
            </Card>

          </div>
        </div>
      </section>

      {/* 5. Metrics & Social Proof counters */}
      <section className="px-4 py-20 border-b border-zinc-900/60 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center bg-zinc-900/20 border border-zinc-900/60 p-10 rounded-[2.5rem] backdrop-blur-sm">
          <div className="space-y-1">
            <p className="text-3xl sm:text-4xl font-extrabold text-white">R420k+</p>
            <p className="text-[10px] font-mono text-zinc-500 uppercase font-black">Styled Salon Revenue</p>
          </div>
          <div className="space-y-1">
            <p className="text-3xl sm:text-4xl font-extrabold text-white">1.2k+</p>
            <p className="text-[10px] font-mono text-zinc-500 uppercase font-black">Completed Sessions</p>
          </div>
          <div className="space-y-1">
            <p className="text-3xl sm:text-4xl font-extrabold text-[#c084fc]">94%</p>
            <p className="text-[10px] font-mono text-zinc-500 uppercase font-black">Rebooking Consistency</p>
          </div>
          <div className="space-y-1">
            <p className="text-3xl sm:text-4xl font-extrabold text-[#1ade6e]">&lt;60s</p>
            <p className="text-[10px] font-mono text-zinc-500 uppercase font-black">Workspace Launch Speed</p>
          </div>
        </div>
      </section>

      {/* 6. Ready to Launch final Conversion Block */}
      <section className="px-4 py-24 text-center relative overflow-hidden max-w-4xl mx-auto">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/5 rounded-full filter blur-3xl pointer-events-none" />
        <div className="space-y-8 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-normal leading-tight text-white tracking-tight font-serif">
            Empower your styling chair. <span className="italic block text-primary mt-1">Claim your portal handle today.</span>
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
            Configure your pricing options, list calendars of availability, and let clients book clean slots instantly. Free forever, cancel upgrades anytime.
          </p>
          <div className="pt-2">
            <Button
              onClick={onStartSignUp}
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider h-14 px-8 shadow-2xl shadow-primary/20 transition-all hover:scale-[1.03] active:scale-95 duration-200"
            >
              Configure Salon Workspace Now
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
