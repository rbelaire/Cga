export default function MemberCard({ member }) {
  const { name, ptm, memberSince } = member
  const hasData = ptm !== null
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)

  return (
    <div className={`bg-white border rounded-lg p-4 flex items-center gap-4 hover:border-gold hover:shadow-sm transition-colors ${
      hasData ? 'border-gray-200' : 'border-gray-100'
    }`}>
      <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
        hasData ? 'bg-forest' : 'bg-gray-200'
      }`}>
        <span className={`font-serif font-bold text-sm ${hasData ? 'text-white' : 'text-gray-400'}`}>
          {initials}
        </span>
      </div>
      <div className="min-w-0">
        <p className={`font-sans font-medium text-sm truncate ${hasData ? 'text-darktext' : 'text-gray-500'}`}>
          {name}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          {hasData ? (
            <span className="stat-number text-xs text-gold font-semibold">PTM {ptm}</span>
          ) : (
            <span className="text-xs text-gray-300 font-sans">PTM —</span>
          )}
          {memberSince && (
            <span className="text-xs text-gray-400 font-sans">Since {memberSince}</span>
          )}
        </div>
      </div>
    </div>
  )
}
