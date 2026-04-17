import { formatName } from '../../utils/formatName'
import TeeTag from './TeeTag'

export default function MemberCard({ member }) {
  const { name, ptm, memberSince, email, cell, homePhone, tee, flight } = member
  const hasData = ptm !== null && flight != null
  const phone = cell || homePhone
  const displayName = formatName(name)
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)

  return (
    <div className={`bg-white border rounded-lg p-4 flex items-start gap-4 hover:border-gold hover:shadow-sm transition-colors ${
      hasData ? 'border-gray-200' : 'border-gray-100'
    }`}>
      <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        hasData ? 'bg-forest' : 'bg-gray-200'
      }`}>
        <span className={`font-serif font-bold text-sm ${hasData ? 'text-white' : 'text-gray-400'}`}>
          {initials}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`font-sans font-medium text-sm truncate ${hasData ? 'text-darktext' : 'text-gray-500'}`}>
            {displayName}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <TeeTag tee={tee} />
            {memberSince && (
              <span className="text-xs text-gray-400 font-sans">'{String(memberSince).slice(-2)}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          {email && (
            <a
              href={`mailto:${email}`}
              className="text-xs text-blue-500 hover:text-blue-700 font-sans truncate max-w-[160px]"
              title={email}
            >
              {email}
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone.replace(/\D/g, '')}`}
              className="text-xs text-gray-500 hover:text-forest font-sans whitespace-nowrap"
            >
              {phone}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
