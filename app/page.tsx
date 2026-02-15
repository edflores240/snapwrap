'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { Inter, Playfair_Display, Caveat } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });
const caveat = Caveat({ subsets: ['latin'] });

export default function Home() {
  const router = useRouter();

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
    <main className={`min-h-screen relative overflow-hidden bg-[#FFF8F0] ${inter.className} text-neutral-900 selection:bg-[#FF8FAB] selection:text-white`}>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link href="/">
          <h1 className={`text-2xl font-bold tracking-tight ${playfair.className}`}>
            SnapWrap
          </h1>
        </Link>
        <div>
          <Link href="/admin/login">
            <Button variant="secondary" className="bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-900 shadow-sm rounded-full px-6">
              Sign In
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20 pb-32">

        {/* Decorative Elements */}
        <div className={`absolute top-32 left-10 md:left-20 rotate-[-12deg] ${caveat.className} text-2xl md:text-3xl text-neutral-400 pointer-events-none`}>
          Premium Quality
          <svg className="w-8 h-8 ml-2 scale-x-[-1] mt-1" viewBox="0 0 100 100"><path d="M10,10 Q50,50 90,10" fill="none" stroke="currentColor" strokeWidth="3" /></svg>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto relative z-10"
        >
          <div className="inline-block px-4 py-1.5 mb-8 rounded-full bg-white border border-neutral-200 text-sm font-medium text-neutral-500 shadow-sm">
            est. 2024
          </div>

          <h1 className={`text-6xl md:text-9xl font-black mb-6 leading-[0.9] tracking-tighter ${playfair.className}`}>
            SnapWrap
          </h1>

          <h2 className={`text-2xl md:text-4xl italic font-light mb-8 text-neutral-600 ${playfair.className}`}>
            The Ultimate Photo Booth Experience
          </h2>

          <p className="text-lg md:text-xl text-neutral-500 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
            Elevate your events with our premium, customizable photo booth service.
            Instant sharing, stunning templates, and unforgettable memories.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/admin/login">
              <Button size="lg" className="px-12 py-6 text-lg rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition-all font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1">
                Book Now / Sign In
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Decorative Image/Pattern */}
        <div className="absolute top-[60%] right-[10%] w-64 h-64 bg-[#FFE4E1] rounded-full blur-[80px] opacity-60 pointer-events-none -z-0" />
        <div className="absolute top-[30%] left-[10%] w-72 h-72 bg-[#E0F7FA] rounded-full blur-[80px] opacity-60 pointer-events-none -z-0" />

        <div className={`absolute bottom-32 right-10 md:right-20 rotate-[12deg] ${caveat.className} text-2xl md:text-3xl text-neutral-400 pointer-events-none`}>
          Make memories!
          <svg className="w-10 h-10 ml-4 mt-2" viewBox="0 0 100 100"><path d="M10,10 C30,80 80,10 90,90" fill="none" stroke="currentColor" strokeWidth="2" markerEnd="url(#arrow)" /></svg>
        </div>

      </section>

      {/* Developer Footer */}
      <footer className="py-16 bg-white border-t border-neutral-100 relative z-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className={`text-2xl mb-6 ${playfair.className} font-bold text-neutral-800`}>
            Developed by Jay Flores
          </p>

          <p className="text-neutral-500 mb-8 max-w-md mx-auto leading-relaxed">
            Want the same premium photo booth experience for your event?
            Get in touch with me directly to discuss your custom setup.
          </p>

          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-neutral-600">
            <a href="mailto:edflores240@gmail.com" className="flex items-center gap-2 hover:text-neutral-900 transition-colors bg-neutral-50 px-4 py-2 rounded-full border border-neutral-100">
              <span>✉️</span> edflores240@gmail.com
            </a>
            <a href="tel:09480285798" className="flex items-center gap-2 hover:text-neutral-900 transition-colors bg-neutral-50 px-4 py-2 rounded-full border border-neutral-100">
              <span>📱</span> 09480285798
            </a>
            <a href="https://instagram.com/eddyjayflores" target="_blank" className="flex items-center gap-2 hover:text-neutral-900 transition-colors bg-neutral-50 px-4 py-2 rounded-full border border-neutral-100">
              <span>📸</span> @eddyjayflores
            </a>
          </div>

          <div className="mt-12 pt-8 border-t border-neutral-100 text-xs text-neutral-400 uppercase tracking-widest">
            © {new Date().getFullYear()} SnapWrap • All Rights Reserved
          </div>
        </div>
      </footer>
    </main>
  );
}
