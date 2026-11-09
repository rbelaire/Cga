import { useEffect, useMemo, useState } from 'react'
import { DB } from '../db'
import { useSubscription } from '../hooks/useSubscription'
import { formatName } from '../utils/formatName'
import PageWrapper from '../components/layout/PageWrapper'
import Empty from '../components/ui/Empty'

export default function Members() {
  useEffect(() => { document.title = 'Members | CGA 2026' }, [])
  const [query, setQuery] = useState('')
  const members = useSubscription(DB.listenMembers, [])
  const list = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (members || [])
      .filter((member) => member?.name && member.active !== false)
      .filter((member) => !needle || member.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [members, query])

  return (
    <PageWrapper>
      <h1 className="section-title">Members</h1>
      <div className="gold-divider" />
      <label className="block mb-4">
        <span className="sr-only">Search members</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" className="w-full max-w-md rounded-md border border-[#E5E0D4] px-3 py-2" />
      </label>
      {members == null ? <p className="text-sm text-gray-500">Loading the roster…</p> : list.length === 0 ? (
        <Empty title={query ? 'No members match that search.' : 'The roster is empty.'} />
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-3">{list.length} members</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((member) => (
              <li key={member.name} className="bg-white border border-[#E5E0D4] rounded-xl p-4">
                <p className="font-heading font-semibold text-forest">{formatName(member.name)}</p>
                <p className="text-sm text-gray-600 mt-1">Tee: {member.tee || '—'} · Points to make: {member.ptm ?? '—'}</p>
                <p className="text-sm mt-2 space-x-3">
                  {member.email && <a className="text-forest underline" href={`mailto:${member.email}`}>{member.email}</a>}
                  {(member.cell || member.homePhone) && <a className="text-forest underline" href={`tel:${member.cell || member.homePhone}`}>{member.cell || member.homePhone}</a>}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageWrapper>
  )
}
