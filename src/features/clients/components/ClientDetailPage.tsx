/**
 * ClientDetailPage — View a single general contractor (client)
 *
 * Shows company info and their projects
 */
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { Icon } from '../../../components/ui/Icon'

interface ClientWithProjects {
  id: number
  company_name: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  billing_address?: { street?: string; city?: string; state?: string; zip?: string; notes?: string } | null
  notes?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  projects?: Array<{ id: number; name: string; status: string }>
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const clientId = id ? Number(id) : null
  const { data: clients = [] } = useClients()
  const client = clients.find((c) => c.id === clientId) as ClientWithProjects | undefined

  if (!clientId) {
    return <div>Invalid client ID</div>
  }

  if (!client) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <button
          onClick={() => navigate('/clients')}
          className="inline-flex items-center gap-2 text-[var(--signal)] hover:underline mb-6"
        >
          <Icon name="arrow-left" className="w-4 h-4" />
          Back to Clients
        </button>
        <div className="text-center text-[var(--muted)] py-12">Client not found</div>
      </div>
    )
  }

  const projects = client.projects || []

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/clients')}
        className="inline-flex items-center gap-2 text-[var(--signal)] hover:underline mb-6"
      >
        <Icon name="arrow-left" className="w-4 h-4" />
        Back to Clients
      </button>

      {/* Info Card */}
      <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--ink)] mb-2">{client.company_name}</h1>
            <span
              className="inline-block px-3 py-1 rounded-lg text-sm font-medium"
              style={{
                background: client.is_active
                  ? 'color-mix(in oklab, var(--success) 20%, var(--panel))'
                  : 'color-mix(in oklab, var(--danger) 20%, var(--panel))',
                color: client.is_active ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {client.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-[var(--line)]">
          {client.contact_name && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
                Contact Name
              </div>
              <div className="text-[var(--ink)] font-medium">{client.contact_name}</div>
            </div>
          )}

          {client.phone && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
                Phone
              </div>
              <div className="text-[var(--ink)]">
                <a href={`tel:${client.phone}`} className="text-[var(--signal)] hover:underline">
                  {client.phone}
                </a>
              </div>
            </div>
          )}

          {client.email && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
                Email
              </div>
              <div className="text-[var(--ink)]">
                <a href={`mailto:${client.email}`} className="text-[var(--signal)] hover:underline">
                  {client.email}
                </a>
              </div>
            </div>
          )}

          {client.billing_address && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase mb-1" style={{ fontFamily: 'var(--mono)' }}>
                Billing Address
              </div>
              <div className="text-[var(--ink)] text-sm">
                {client.billing_address.street && <div>{client.billing_address.street}</div>}
                {(client.billing_address.city || client.billing_address.state) && (
                  <div>
                    {client.billing_address.city}, {client.billing_address.state}{' '}
                    {client.billing_address.zip}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {client.notes && (
          <div className="mt-6 pt-6 border-t border-[var(--line)]">
            <div className="text-xs text-[var(--muted)] uppercase mb-2" style={{ fontFamily: 'var(--mono)' }}>
              Notes
            </div>
            <p className="text-sm text-[var(--ink-2)]">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Projects Section */}
      <div className="bg-[var(--panel)] rounded-xl border border-[var(--line)] overflow-hidden">
        <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-2)]">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Projects</h2>
        </div>

        {projects.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">No projects</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--ink)]">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-[var(--ink)]">Action</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b border-[var(--line)] hover:bg-[var(--panel-2)]">
                    <td className="px-4 py-3 text-sm text-[var(--ink)]">
                      <Link to={`/projects/${project.id}`} className="text-[var(--signal)] hover:underline">
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className="inline-block px-2 py-1 rounded text-xs font-medium"
                        style={{
                          background:
                            project.status === 'active'
                              ? 'color-mix(in oklab, var(--success) 20%, var(--panel))'
                              : 'var(--panel-2)',
                          color:
                            project.status === 'active' ? 'var(--success)' : 'var(--muted)',
                        }}
                      >
                        {project.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/projects/${project.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--panel-2)] transition-colors"
                      >
                        <Icon name="arrow-right" className="w-4 h-4 text-[var(--ink-2)]" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
