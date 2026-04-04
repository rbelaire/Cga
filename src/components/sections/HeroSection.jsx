export default function HeroSection() {
  return (
    <section className="bg-forest border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-6 h-0.5 bg-gold" />
          <span className="text-gold text-xs font-sans font-semibold uppercase tracking-widest">
            Member Dashboard
          </span>
        </div>
        <h1 className="text-offwhite text-2xl sm:text-3xl font-serif font-bold leading-tight">
          Carencro <span className="text-gold">Golf Association</span>
        </h1>
        <p className="text-gray-300 text-sm font-sans mt-1.5">
          Quick access to tournaments, standings, members, and rules.
        </p>
      </div>
    </section>
  )
}
