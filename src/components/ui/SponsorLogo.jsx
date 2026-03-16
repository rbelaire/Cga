export default function SponsorLogo({ sponsor }) {
  const { name, url, logo } = sponsor

  const inner = logo ? (
    <img src={logo} alt={name} className="max-h-12 max-w-full object-contain opacity-70 hover:opacity-100 transition-opacity" />
  ) : (
    <span className="text-gray-400 font-sans text-sm font-medium text-center px-2 hover:text-gold transition-colors">
      {name}
    </span>
  )

  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center p-4 rounded-lg border border-gray-700 hover:border-gold transition-colors bg-charcoal min-h-[72px]"
      aria-label={`Visit ${name}`}
    >
      {inner}
    </a>
  ) : (
    <div className="flex items-center justify-center p-4 rounded-lg border border-gray-700 bg-charcoal min-h-[72px]">
      {inner}
    </div>
  )
}
