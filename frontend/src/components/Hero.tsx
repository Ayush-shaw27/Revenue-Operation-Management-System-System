'use client';

import Nav from './Nav';
import Animate from './Animate';
import RevenueCard from './RevenueCard';

export default function Hero() {
  return (
    <section className="relative w-full h-screen overflow-hidden bg-[#080A19]">
      {/* CSS/Canvas ambient background treatment — zero external video block */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#080A19] via-[#0f172a] to-[#1e1b4b] opacity-90" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="relative z-10 h-full flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center py-8">
          <div className="w-full max-w-[1800px] mx-auto px-5 sm:px-8 md:px-[82px] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10 lg:gap-12">
            <div className="max-w-[593px]">
              <Animate delay={300} direction="up">
                <h1 className="text-white text-[36px] sm:text-[52px] md:text-[64px] lg:text-[72px] font-normal leading-[0.95] mb-5 sm:mb-8 tracking-[0.0018em]">
                  Elevate your essential data to new heights
                </h1>
              </Animate>
              <Animate delay={500} direction="up">
                <p className="text-white/80 text-[16px] sm:text-[18px] md:text-[20px] font-[450] leading-[1.3] max-w-[370px] mb-7 sm:mb-10">
                  Advanced reasoning systems and predictive models built for the unknown
                </p>
              </Animate>
              <Animate delay={700} direction="up">
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  <a href="/login" className="h-[46px] sm:h-[51px] px-5 sm:px-[27px] bg-[#E9E9E9] rounded-[12px] text-[#0A0707] text-[14px] sm:text-[15.5px] font-[450] leading-[15.5px] flex items-center transition-opacity hover:opacity-90">
                    Book a demo
                  </a>
                  <a href="/login" className="h-[46px] sm:h-[51px] px-5 sm:px-[27px] rounded-[12px] border border-white text-white text-[14px] sm:text-[15.5px] font-[450] leading-[15.5px] flex items-center transition-opacity hover:opacity-80">
                    Talk with the team
                  </a>
                </div>
              </Animate>
            </div>
            <Animate delay={900} direction="scale" className="w-full max-w-[405px] mx-auto lg:mx-0">
              <RevenueCard />
            </Animate>
          </div>
        </div>
        <footer className="flex-none pb-[20px] sm:pb-[30px]">
          <Animate delay={1080} direction="up">
            <p className="text-white/95 text-[14px] font-[480] tracking-[0.0065em] text-center opacity-70">
              Built by engineers from
            </p>
          </Animate>
          <Animate delay={1160} direction="up">
            <div className="flex justify-center items-center gap-[62px] mt-[15px]">
              <svg className="w-[30px] h-[30px] text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18a6 6 0 110-12 6 6 0 010 12z" />
              </svg>
              <svg className="w-[25px] h-[25px] text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18a6 6 0 110-12 6 6 0 010 12z" />
              </svg>
              <svg className="w-[33px] h-[33px] text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18a6 6 0 110-12 6 6 0 010 12z" />
              </svg>
            </div>
          </Animate>
        </footer>
      </div>
    </section>
  );
}