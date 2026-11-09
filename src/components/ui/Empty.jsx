export default function Empty({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E5E0D4] bg-white px-4 py-10 text-center">
      <p className="font-heading font-semibold text-forest">{title}</p>
      {children && <p className="mt-2 text-sm text-gray-500">{children}</p>}
    </div>
  )
}
