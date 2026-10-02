export default function RevenueCard() {
  const BAR_HEIGHTS = [
    23, 40, 53, 40, 33, 14, 7, 17, 75, 65,
    88, 75, 65, 47, 33, 88, 4, 7, 9, 14,
    95, 65, 79, 37, 7, 40, 17, 20, 62, 47,
    92, 72,
  ];

  const maxHeight = Math.max(...BAR_HEIGHTS);

  return (
    <div className="w-full max-w-[405px] mx-auto lg:mx-0">
      <div className="w-full rounded-[24px] sm:rounded-[33px] bg-[rgba(17,16,15,0.35)] backdrop-blur-[20px] p-5 sm:p-8 pb-5 sm:pb-6">
        <p className="text-white text-[16px] sm:text-[20px] font-[450] leading-[20px] mb-3 sm:mb-4">
          Revenue Growth
        </p>
        <p className="mb-2 sm:mb-3 flex items-baseline gap-[10px]">
          <span className="text-white text-[28px] sm:text-[46px] font-[450] leading-[1]">$14,205,890</span>
          <span className="text-white/20 text-[28px] sm:text-[46px] font-[450] leading-[1]">.00</span>
        </p>
        <div className="flex items-center gap-[10px] mb-6 sm:mb-8">
          <span className="px-[6px] py-[7px] bg-white/20 rounded-[6px] text-white text-[12px] sm:text-[14px] font-[450] leading-[14px]">+32.4%</span>
          <span className="text-white/80 text-[12px] sm:text-[14px] font-[450] leading-[14px] opacity-70">vs. previous period ($10.7M)</span>
        </div>
        <div className="relative">
          <div className="flex items-end gap-[1.5px] h-[80px] sm:h-[100px]">
            {BAR_HEIGHTS.map((h, i) => {
              const isProjected = i >= 28;
              const heightPercent = (h / maxHeight) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-[0.5px] animate-[bar-grow_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards] origin-bottom"
                  style={{ height: `${heightPercent}%`, backgroundColor: isProjected ? 'rgba(255,255,255,0.1)' : 'white', animationDelay: `${1100 + i * 30}ms`, opacity: 0 }}
                />
              );
            })}
          </div>
          <div className="absolute inset-0 pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-white/10"
                style={{ left: `${((i + 1) / 5) * 100}%` }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-between mt-3">
          {['10:00', '12:00', '14:00', '16:00', '16:00'].map((time, i) => (
            <div
              key={time}
              className="text-[9px] sm:text-[10px] font-[450] leading-[10px] text-white/80"
              style={{ opacity: i >= 3 ? 0.4 : 1 }}
            >
              {time}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}