export default function HeroSection() {
  return (
    <section className="bg-forest">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-6 h-0.5 bg-gold" />
          <span className="text-gold text-xs font-sans font-semibold uppercase tracking-widest">
            2026 Season
          </span>
        </div>
        <h1 className="text-offwhite text-3xl sm:text-4xl font-serif font-bold leading-tight">
          Carencro <span className="text-gold">Golf Association</span>
        </h1>
        <p className="text-gray-400 text-sm font-sans mt-1.5">
          Bringing Acadiana's finest golfers together.
        </p>
      </div>
    </section>
  )
}
