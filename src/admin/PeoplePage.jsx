import { useState } from 'react'
import { DB } from '../db'
import { useClub } from './useClub'
import { note } from './note'
import { Help, Notice, Panel } from './ui'

export default function PeoplePage() {
  const club = useClub()
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ name: '', email: '', role: 'admin' })
  if (!club.ready) return <Notice>Loading accounts…</Notice>
  return (
    <div className="space-y-4">
      <Help>Admins can run events. A disabled account cannot. The owner account always has access. Saving writes the admin list the site checks, including the email list used by the security rules.</Help>
      {message && <Notice>{message}</Notice>}
      {(club.users || []).length === 0 && <Notice>No board accounts are listed yet. Add the people who should run events.</Notice>}
      <ul className="space-y-2">
        {(club.users || []).map((person) => (
          <li key={person.email || person.id} className="bg-white border border-[#E5E0D4] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <div>
              <p className="font-semibold">{person.name || person.email}</p>
              <p className="text-sm text-gray-500">{person.email} · {person.role} · {person.status || 'active'}</p>
            </div>
            <button type="button" className="btn-outline" onClick={async () => {
              const status = person.status === 'disabled' ? 'active' : 'disabled'
              const next = club.users.map((item) => item.email === person.email ? { ...item, status } : item)
              await DB.saveUsers(next)
              await note('Accounts', `${person.email} ${status}`, club.actor)
              setMessage(`${person.email} is ${status}.`)
            }}>{person.status === 'disabled' ? 'Enable' : 'Disable'}</button>
          </li>
        ))}
      </ul>
      <Panel title="Add an account">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={form.name} onChange={(input) => setForm({ ...form, name: input.target.value })} placeholder="Name" className="rounded border border-[#E5E0D4] px-3 py-2" />
          <input value={form.email} onChange={(input) => setForm({ ...form, email: input.target.value })} placeholder="Email" className="rounded border border-[#E5E0D4] px-3 py-2" />
          <select value={form.role} onChange={(input) => setForm({ ...form, role: input.target.value })} className="rounded border border-[#E5E0D4] px-3 py-2">
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
          <button type="button" className="btn-primary" onClick={async () => {
            const email = form.email.trim().toLowerCase()
            if (!email.includes('@')) return setMessage('Enter a valid email.')
            if (club.users.some((person) => (person.email || '').toLowerCase() === email)) return setMessage('That email is already listed.')
            await DB.saveUsers([...club.users, { id: email, name: form.name.trim(), email, role: form.role, status: 'active' }])
            setForm({ name: '', email: '', role: 'admin' })
            setMessage('Account saved.')
          }}>Save account</button>
        </div>
      </Panel>
    </div>
  )
}
