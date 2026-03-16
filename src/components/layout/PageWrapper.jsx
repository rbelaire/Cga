export default function PageWrapper({ children, className = '' }) {
  return (
    <main className={`flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 ${className}`}>
      {children}
    </main>
  )
}
