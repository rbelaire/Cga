import PageWrapper from '../components/layout/PageWrapper'
import MemberCard from '../components/ui/MemberCard'
import SearchBar from '../components/ui/SearchBar'
import { useSearch } from '../hooks/useSearch'
import members from '../data/members.json'

export default function Members() {
  const { query, setQuery, filtered } = useSearch(members, ['name'])

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">Member Directory</h1>
        <div className="gold-divider" />
      </div>

      <div className="max-w-sm mb-6">
        <SearchBar value={query} onChange={setQuery} placeholder="Search members…" />
      </div>

      <p className="text-gray-500 font-sans text-sm mb-4">
        {filtered.length} {filtered.length === 1 ? 'member' : 'members'} found
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((m) => (
          <MemberCard key={m.name} member={m} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-500 font-sans py-16">No members match your search.</p>
      )}
    </PageWrapper>
  )
}
