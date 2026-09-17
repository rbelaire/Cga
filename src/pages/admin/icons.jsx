// Admin panel icon set (thin wrappers over a shared SVG shell).
export function AdminActionIcon({ children, className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

export const DashboardIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h7V3H3v10zm11 8h7V11h-7v10zM3 21h7v-4H3v4zm11-10h7V3h-7v8z" />
  </AdminActionIcon>
)

export const ReceiptIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h10l2 2v16l-3-2-3 2-3-2-3 2V5l2-2z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6M9 13h6" />
  </AdminActionIcon>
)

export const UsersIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11a4 4 0 100-8 4 4 0 000 8zM8 13a4 4 0 100-8 4 4 0 000 8zM2 21a6 6 0 0112 0M14 21a6 6 0 018 0" />
  </AdminActionIcon>
)

export const GolfFlagIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21V3m0 0h10l-2.5 3L18 9H8" />
  </AdminActionIcon>
)

export const TrophyIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h8v3a4 4 0 01-8 0V4zm-3 1h3v2a5 5 0 01-3-2zm14 0h-3v2a5 5 0 003-2zM10 14h4m-5 6h6" />
  </AdminActionIcon>
)

export const ExportIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l4-4m-4 4l-4-4M5 15v3h14v-3" />
  </AdminActionIcon>
)

export const FolderIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h6l2 2h10v10H3V7z" />
  </AdminActionIcon>
)

export const ArchiveIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h14a1 1 0 011 1v2H4V5a1 1 0 011-1zm0 4h14v12a1 1 0 01-1 1H6a1 1 0 01-1-1V8zm5 4h4" />
  </AdminActionIcon>
)

export const ClockListIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </AdminActionIcon>
)

export const LayersIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </AdminActionIcon>
)

export const LockIcon = ({ className = 'w-10 h-10 text-gray-300' }) => (
  <AdminActionIcon className={className}>
    <rect x="6" y="11" width="12" height="9" rx="2" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11V8a3 3 0 116 0v3" />
  </AdminActionIcon>
)

export const CheckIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </AdminActionIcon>
)

export const ErrorIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
  </AdminActionIcon>
)
