export default function MemberCard({ member }) {
  const { name, handicap, memberSince } = member
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="bg-charcoal border border-gray-700 rounded-lg p-4 flex items-center gap-4 hover:border-gold transition-colors">
      <div className="w-11 h-11 rounded-full bg-forest border border-gold flex items-center justify-center flex-shrink-0">
        <span className="text-gold font-serif font-bold text-sm">{initials}</span>
      </div>
      <div className="min-w-0">
        <p className="text-offwhite font-sans font-medium text-sm truncate">{name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="stat-number text-xs text-gold">HCP {handicap?.toFixed(1) ?? 'N/A'}</span>
          <span className="text-xs text-gray-500 font-sans">Since {memberSince}</span>
        </div>
      </div>
    </div>
  )
}
