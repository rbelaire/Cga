import { SaveBtn } from './ui'

export function UsersPanel({
  users, userSearch, setUserSearch, newUser, setNewUser,
  addUser, updateUser, toggleUserStatus, saveUsers, usersSaving, usersSaveStatus,
}) {
  return (
    <div className="space-y-4">
      <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={newUser.name} onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))} placeholder="Full name" className="sm:col-span-2 border border-gray-300 rounded-md px-3 py-2 text-sm font-sans" />
          <input type="email" value={newUser.email} onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" className="border border-gray-300 rounded-md px-3 py-2 text-sm font-sans" />
          <select value={newUser.role} onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))} className="border border-gray-300 rounded-md px-3 py-2 text-sm font-sans">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={addUser} className="min-h-[44px] px-4 py-2 rounded-md bg-forest text-white text-sm font-semibold font-sans">Add User</button>
          <SaveBtn onClick={saveUsers} saving={usersSaving} status={usersSaveStatus} />
        </div>
      </section>
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users…" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-sans" />
        </div>
        <div className="divide-y divide-gray-100">
          {users.map(user => (
            <div key={user.id} className="p-4 grid gap-2 sm:grid-cols-12 sm:items-center">
              <input value={user.name ?? ''} onChange={e => updateUser(user.id, 'name', e.target.value)} className="sm:col-span-3 border border-gray-300 rounded-md px-2.5 py-2 text-sm font-sans" aria-label={`Name for ${user.email}`} />
              <input type="email" value={user.email ?? ''} onChange={e => updateUser(user.id, 'email', e.target.value)} className="sm:col-span-4 border border-gray-300 rounded-md px-2.5 py-2 text-sm font-sans" aria-label={`Email for ${user.name}`} />
              <select value={user.role ?? 'member'} onChange={e => updateUser(user.id, 'role', e.target.value)} className="sm:col-span-2 border border-gray-300 rounded-md px-2.5 py-2 text-sm font-sans" aria-label={`Role for ${user.name}`}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={() => toggleUserStatus(user.id)} className={`sm:col-span-3 min-h-[44px] px-3 py-2 rounded-md text-sm font-semibold font-sans border ${user.status === 'disabled' ? 'border-gray-300 text-gray-600 bg-gray-100' : 'border-green-300 text-green-700 bg-green-50'}`}>
                {user.status === 'disabled' ? 'Disabled' : 'Active'}
              </button>
            </div>
          ))}
          {users.length === 0 && <p className="px-4 py-8 text-sm text-gray-500 font-sans text-center">No users match your search.</p>}
        </div>
      </section>
    </div>
  )
}
