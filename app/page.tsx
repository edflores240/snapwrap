'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Inter, Playfair_Display } from 'next/font/google';
import { Camera, ArrowRight, Laptop, Sparkles, Smartphone, Download, Check, Shield, Layers, Users, Calendar, FileText, Zap, Globe, Palette, MessageSquare } from 'lucide-react';
import Logo from '@/components/ui/Logo';

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });

export default function Home() {
  const router = useRouter();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  
  const { scrollY } = useScroll();

  // Parallax translation transforms
  const heroY = useTransform(scrollY, [0, 800], [0, 200]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const backgroundY = useTransform(scrollY, [0, 1000], [0, 100]);
  
  const floatY1 = useTransform(scrollY, [0, 1000], [0, -150]);
  const floatY2 = useTransform(scrollY, [0, 1000], [0, -80]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/admin/dashboard');
      }
    };
    checkUser();
  }, [router]);

  return (
    <main 
      ref={containerRef} 
      className={`min-h-screen bg-[#FAF8F5] ${inter.className} text-[#2A2724] selection:bg-[#8CA382] selection:text-white relative overflow-x-hidden`}
    >
      {/* Background paper texture & subtle warm grid (Parallax Shifted) */}
      <motion.div 
        style={{ y: backgroundY }}
        className="absolute inset-0 bg-[radial-gradient(#e3dfd5_1.5px,transparent_1.5px)] [background-size:32px_32px] opacity-40 pointer-events-none -z-10" 
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#FAF8F5]/85 backdrop-blur-md border-b border-[#ECE8DF]/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center w-full">
          <Link href="/" className="flex items-center gap-2 group">
            <Logo size={32} priority className="transition-transform group-hover:rotate-6" />
            <span className={`text-2xl font-black tracking-tight ${playfair.className}`}>
              SnapWrap
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/admin/login">
              <button className="text-sm font-semibold hover:text-[#8CA382] transition-colors">
                Sign In
              </button>
            </Link>
            <Link href="/admin/login">
              <Button className="bg-[#2A2724] hover:bg-[#3D3935] text-white rounded-full px-6 py-2 text-sm font-bold shadow-sm">
                Open Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative max-w-7xl mx-auto px-6 pt-32 pb-24 text-center flex flex-col items-center">
        
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-4xl mx-auto z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-[#EBF0E9] border border-[#D5E0D0] text-xs font-bold uppercase tracking-wider text-[#5A7350] shadow-sm">
            <Sparkles size={12} /> The All-in-One Photo Booth Platform
          </div>

          <h1 className={`text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[0.95] tracking-tight ${playfair.className}`}>
            Run your photo booth business on autopilot.
          </h1>

          <p className="text-lg md:text-xl text-neutral-500 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
            From booking your first client to delivering the final print. SnapWrap gives you a beautiful public storefront, AI-powered design tools, and a bulletproof offline-first desktop app to run your events flawlessly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/admin/login">
              <Button size="lg" className="px-10 py-6 text-base rounded-full bg-[#2A2724] text-white hover:bg-[#3D3935] transition-all font-bold shadow-lg hover:shadow-xl flex items-center gap-2">
                Start Building Free <ArrowRight size={18} />
              </Button>
            </Link>
            <p className="text-xs text-neutral-400 mt-4 sm:mt-0 sm:ml-4">No credit card required.</p>
          </div>
        </motion.div>
      </section>

      {/* Feature Pillar 1: The Business Suite */}
      <section className="bg-white py-24 border-t border-[#ECE8DF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 space-y-6">
            <div className="inline-block px-3 py-1 rounded-full bg-[#F5F0E6] border border-[#E6DCC8] text-xs font-bold text-[#8B6E3F] uppercase tracking-wider">
              1. Get Booked
            </div>
            <h2 className={`text-4xl md:text-5xl font-black tracking-tight leading-[1.05] ${playfair.className}`}>
              Your brand, front and center.
            </h2>
            <p className="text-neutral-500 leading-relaxed text-base font-light">
              Stop using generic booking links and fragmented tools. SnapWrap gives you a stunning, customizable public profile that acts as your storefront. Clients can view your packages, check your availability, and book you directly.
            </p>
            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-[#F5F0E6] p-1.5 rounded-md"><Globe size={16} className="text-[#8B6E3F]" /></div>
                <div>
                  <h4 className="font-bold text-neutral-800">Custom Public Profiles</h4>
                  <p className="text-sm text-neutral-500 leading-relaxed">Choose from beautiful themes and customize colors to match your brand perfectly.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-[#F5F0E6] p-1.5 rounded-md"><FileText size={16} className="text-[#8B6E3F]" /></div>
                <div>
                  <h4 className="font-bold text-neutral-800">Invoicing & Contracts</h4>
                  <p className="text-sm text-neutral-500 leading-relaxed">Automatically generate professional quotes, collect digital signatures, and get paid faster.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-[#F5F0E6] p-1.5 rounded-md"><Users size={16} className="text-[#8B6E3F]" /></div>
                <div>
                  <h4 className="font-bold text-neutral-800">Client CRM</h4>
                  <p className="text-sm text-neutral-500 leading-relaxed">Keep track of every client, their event history, and contact details in one central database.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2">
            <div className="bg-[#FAF8F5] p-6 rounded-3xl border border-[#ECE8DF] shadow-lg">
              <div className="aspect-[4/3] rounded-xl bg-white border border-[#ECE8DF] overflow-hidden flex flex-col">
                {/* Mockup header */}
                <div className="h-10 border-b border-[#ECE8DF] bg-[#FAF8F5] flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="ml-4 bg-white border border-[#ECE8DF] rounded text-[10px] text-neutral-400 px-3 py-1 font-mono">snapwrap.com/u/your-brand</div>
                </div>
                {/* Mockup content */}
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center bg-[#1A1A1A] text-white">
                    <h3 className={`text-3xl mb-2 font-serif`}>Luxe Photo Booths</h3>
                    <p className="text-sm text-neutral-400 mb-6">Premium experiences for modern events.</p>
                    <button className="px-6 py-2 bg-white text-black text-sm font-bold rounded-full">Book Now</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillar 2: AI Design */}
      <section className="bg-[#FAF8F5] py-24 border-t border-[#ECE8DF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="w-full lg:w-1/2 space-y-6">
            <div className="inline-block px-3 py-1 rounded-full bg-[#EAE8F5] border border-[#D5D0E6] text-xs font-bold text-[#5B4F96] uppercase tracking-wider">
              2. Design Faster
            </div>
            <h2 className={`text-4xl md:text-5xl font-black tracking-tight leading-[1.05] ${playfair.className}`}>
              AI-powered print templates in seconds.
            </h2>
            <p className="text-neutral-500 leading-relaxed text-base font-light">
              Stop spending unbillable hours tweaking layouts in Photoshop. SnapWrap's revolutionary AI Print Designer lets you describe what you want, and generates production-ready, high-resolution transparent overlays instantly.
            </p>
            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-[#EAE8F5] p-1.5 rounded-md"><Sparkles size={16} className="text-[#5B4F96]" /></div>
                <div>
                  <h4 className="font-bold text-neutral-800">Prompt-to-Layout</h4>
                  <p className="text-sm text-neutral-500 leading-relaxed">Type "modern 2x6 strip for a black-tie wedding, gold accents" and get a perfect template.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-[#EAE8F5] p-1.5 rounded-md"><Palette size={16} className="text-[#5B4F96]" /></div>
                <div>
                  <h4 className="font-bold text-neutral-800">Print Studio Builder</h4>
                  <p className="text-sm text-neutral-500 leading-relaxed">Manually adjust photo slots, add text, and fine-tune your grid layout with our drag-and-drop editor.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2 relative">
             <motion.div style={{ y: floatY1 }} className="bg-white p-6 rounded-3xl border border-[#ECE8DF] shadow-xl relative z-10">
               <div className="space-y-3 mb-6">
                 <div className="text-xs font-bold text-neutral-500 uppercase">AI Prompt</div>
                 <div className="p-4 bg-[#FAF8F5] border border-[#ECE8DF] rounded-xl text-sm font-mono text-neutral-700">
                   "Elegant 4x6 landscape photo layout, minimal floral borders, classic serif typography"
                 </div>
                 <div className="flex gap-2">
                   <div className="h-2 flex-1 bg-[#ECE8DF] rounded-full overflow-hidden">
                     <div className="h-full bg-[#5B4F96] w-3/4 rounded-full" />
                   </div>
                   <span className="text-[10px] font-bold text-[#5B4F96]">Generating...</span>
                 </div>
               </div>
               
               {/* Abstract Layout visualization */}
               <div className="aspect-[4/3] bg-[#FAF8F5] border-2 border-dashed border-[#ECE8DF] rounded-xl p-4 flex gap-4">
                  <div className="w-1/2 h-full bg-[#EAE8F5] border border-[#D5D0E6] rounded flex items-center justify-center opacity-70">
                    <Camera size={24} className="text-[#5B4F96]" />
                  </div>
                  <div className="w-1/2 h-full bg-[#EAE8F5] border border-[#D5D0E6] rounded flex items-center justify-center opacity-70">
                    <Camera size={24} className="text-[#5B4F96]" />
                  </div>
               </div>
             </motion.div>
          </div>
        </div>
      </section>

      {/* Feature Pillar 3: Distributed QR Capture */}
      <section className="bg-white py-24 border-t border-[#ECE8DF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 space-y-6">
            <div className="inline-block px-3 py-1 rounded-full bg-[#EBF0E9] border border-[#D5E0D0] text-xs font-bold text-[#5A7350] uppercase tracking-wider">
              3. Event Execution
            </div>
            <h2 className={`text-4xl md:text-5xl font-black tracking-tight leading-[1.05] ${playfair.className}`}>
              Kill the line. Distributed QR guest sessions.
            </h2>
            <p className="text-neutral-500 leading-relaxed text-base font-light">
              Traditional booths force guests to wait in long lines just to tap an iPad. SnapWrap changes the game. Guests simply scan a QR code at their table to open a private session on their own phone.
            </p>
            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-[#EBF0E9] p-1.5 rounded-md"><Smartphone size={16} className="text-[#5A7350]" /></div>
                <div>
                  <h4 className="font-bold text-neutral-800">No App Downloads</h4>
                  <p className="text-sm text-neutral-500 leading-relaxed">Guests use their native mobile browser to capture photos or remotely trigger your DSLR camera.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-[#EBF0E9] p-1.5 rounded-md"><Layers size={16} className="text-[#5A7350]" /></div>
                <div>
                  <h4 className="font-bold text-neutral-800">Live Public Galleries</h4>
                  <p className="text-sm text-neutral-500 leading-relaxed">Photos instantly sync to a beautiful, branded public gallery where everyone can view and download memories.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-[#EBF0E9] p-1.5 rounded-md"><MessageSquare size={16} className="text-[#5A7350]" /></div>
                <div>
                  <h4 className="font-bold text-neutral-800">SMS & Email Delivery</h4>
                  <p className="text-sm text-neutral-500 leading-relaxed">Automatically queue and send gallery links to guests via text and email in the background.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2 flex justify-center">
            <motion.div style={{ y: floatY2 }} className="w-[300px] bg-[#FAF8F5] border-[12px] border-[#2A2724] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
              <div className="h-6 bg-[#2A2724] w-full flex justify-center items-end pb-1">
                 <div className="w-20 h-4 bg-black rounded-full" />
              </div>
              <div className="flex-1 bg-white p-6 flex flex-col justify-center items-center text-center">
                <div className="w-40 h-40 bg-white border border-[#ECE8DF] shadow-sm rounded-2xl p-2 mb-6">
                   {/* Fake QR Code Grid */}
                   <div className="w-full h-full bg-[#FAF8F5] flex flex-wrap gap-1 p-2">
                     {Array.from({length: 16}).map((_, i) => (
                       <div key={i} className="w-[22%] h-[22%] bg-[#2A2724] rounded-sm opacity-80" />
                     ))}
                   </div>
                </div>
                <h3 className={`text-xl font-black mb-2 ${playfair.className}`}>Scan to Start</h3>
                <p className="text-xs text-neutral-500 mb-6">Take up to 3 photos in this session. Your photos will appear in the main gallery.</p>
                <button className="w-full py-3 bg-[#8CA382] text-white font-bold rounded-xl text-sm">Open Camera</button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature Pillar 4: The Desktop App */}
      <section className="bg-[#FAF8F5] py-28 border-t border-[#ECE8DF]">
        <div className="max-w-5xl mx-auto px-6 text-center mb-16">
           <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-[#2A2724] bg-[#2A2724] text-white text-[10px] font-black uppercase tracking-wider mb-6">
             <Shield size={12} /> Enterprise Reliability
           </div>
           <h2 className={`text-4xl md:text-5xl font-black tracking-tight leading-[1.05] ${playfair.className} mb-6`}>
             A bulletproof desktop app for event day.
           </h2>
           <p className="text-neutral-500 leading-relaxed text-lg font-light max-w-2xl mx-auto">
             Web apps fail when venue Wi-Fi drops. We are building a native macOS and Windows application designed for 100% offline reliability. It's the ultimate execution engine for professional operators.
           </p>
        </div>

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-[#ECE8DF] shadow-sm hover:shadow-md transition-shadow">
             <div className="w-12 h-12 bg-[#FAF8F5] rounded-xl flex items-center justify-center mb-6">
               <Zap size={24} className="text-[#2A2724]" />
             </div>
             <h3 className="text-xl font-bold mb-3">Offline-First Caching</h3>
             <p className="text-sm text-neutral-500 leading-relaxed">
               Photos and metadata are written instantly to your local hard drive and a local SQLite database. If the internet drops, you don't lose a single photo.
             </p>
          </div>
          <div className="bg-white p-8 rounded-3xl border border-[#ECE8DF] shadow-sm hover:shadow-md transition-shadow">
             <div className="w-12 h-12 bg-[#FAF8F5] rounded-xl flex items-center justify-center mb-6">
               <Download size={24} className="text-[#2A2724]" />
             </div>
             <h3 className="text-xl font-bold mb-3">Direct OS Printing</h3>
             <p className="text-sm text-neutral-500 leading-relaxed">
               Bypass clunky browser print dialogs. The desktop app talks directly to your DNP/Citizen dye-sublimation printer drivers or watches hot-folders for instant printing.
             </p>
          </div>
          <div className="bg-white p-8 rounded-3xl border border-[#ECE8DF] shadow-sm hover:shadow-md transition-shadow">
             <div className="w-12 h-12 bg-[#FAF8F5] rounded-xl flex items-center justify-center mb-6">
               <Globe size={24} className="text-[#2A2724]" />
             </div>
             <h3 className="text-xl font-bold mb-3">Local LAN Server</h3>
             <p className="text-sm text-neutral-500 leading-relaxed">
               In a cellular deadzone? The desktop app spins up a local web server. Connect a travel router, and guests can use the QR system completely offline.
             </p>
          </div>
        </div>

        <div className="mt-16 text-center">
           <button className="px-8 py-4 bg-[#2A2724] text-white font-bold rounded-full shadow-lg hover:bg-[#3D3935] transition-colors inline-flex items-center gap-2">
             <Laptop size={18} /> Join the Desktop Beta Waitlist
           </button>
        </div>
      </section>

      {/* Feature Grid (Scale & Integrations) */}
      <section className="bg-white py-24 border-t border-[#ECE8DF]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            <div>
              <h4 className="text-sm font-bold text-neutral-900 mb-2">White-Label Branding</h4>
              <p className="text-sm text-neutral-500 leading-relaxed">Fully remove SnapWrap branding and use your own custom domains for galleries and storefronts.</p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-900 mb-2">Template Marketplace</h4>
              <p className="text-sm text-neutral-500 leading-relaxed">Buy, sell, and share custom print layouts with other operators in the global community.</p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-900 mb-2">Zapier Integrations</h4>
              <p className="text-sm text-neutral-500 leading-relaxed">Connect your booking pipeline directly to external workflows, Google Sheets, or advanced CRMs.</p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-900 mb-2">Detailed Analytics</h4>
              <p className="text-sm text-neutral-500 leading-relaxed">Track session counts, total photos taken, download rates, and social shares for every event.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Developer Footer */}
      <footer className="py-20 bg-[#FAF8F5] border-t border-[#ECE8DF] relative z-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className={`text-3xl mb-4 ${playfair.className} font-black tracking-tight text-[#2A2724]`}>
            Developed by Jay Flores
          </h2>

          <p className="text-neutral-500 mb-8 max-w-md mx-auto leading-relaxed text-sm">
            Interested in modernizing your photo booth operations? Let's build the future of events together.
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-xs font-bold text-neutral-600">
            <a href="mailto:edflores240@gmail.com" className="flex items-center gap-2 hover:text-[#8CA382] transition-colors bg-white px-5 py-3 rounded-full border border-[#ECE8DF] shadow-sm">
              <span>✉️</span> edflores240@gmail.com
            </a>
            <a href="tel:09480285798" className="flex items-center gap-2 hover:text-[#8CA382] transition-colors bg-white px-5 py-3 rounded-full border border-[#ECE8DF] shadow-sm">
              <span>📱</span> 09480285798
            </a>
            <a href="https://instagram.com/eddyjayflores" target="_blank" className="flex items-center gap-2 hover:text-[#8CA382] transition-colors bg-white px-5 py-3 rounded-full border border-[#ECE8DF] shadow-sm">
              <span>📸</span> @eddyjayflores
            </a>
          </div>

          <div className="mt-16 pt-8 border-t border-[#ECE8DF] text-[10px] text-neutral-400 font-bold uppercase tracking-[0.2em]">
            © {new Date().getFullYear()} SnapWrap • All Rights Reserved
          </div>
        </div>
      </footer>
    </main>
  );
}
