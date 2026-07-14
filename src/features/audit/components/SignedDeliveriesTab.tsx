/**
 * SignedDeliveriesTab — List of delivered deliveries with signature and PDF access
 *
 * Filters: project, date range (both optional).
 * Actions per row:
 *   - View signature: resolved from private bucket (delivery-signatures-v2)
 *     with 1-hour signed URL, or legacy public URL fallback.
 *   - Download PDF: delegates to existing generateDeliveryPDF utility.
 */
import { useState } from 'react'
import { ProjectSelector } from '../../projects/components/ProjectSelector'
import { useSignedDeliveries, getSignatureUrl } from '../hooks/useSignedDeliveries'
import { generateDeliveryPDF } from '../../deliveries/utils/generateDeliveryPDF'
import { useToast } from '../../../components/ui/Toast'
import type { SignedDelivery } from '../hooks/useSignedDeliveries'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ── Signature Viewer Modal ────────────────────────────────────────────────────

interface SignatureModalProps {
  signedUrl: string
  onClose: () => void
}

function SignatureModal({ signedUrl, onClose }: SignatureModalProps) {
  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-sm text-center">
        <h3 className="font-bold text-lg mb-4">Delivery Signature</h3>
        <img
          src={signedUrl}
          alt="Delivery signature"
          className="mx-auto border border-[var(--line)] rounded-lg max-w-full"
        />
        <div className="modal-action justify-center">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}

// ── Row actions ───────────────────────────────────────────────────────────────

interface RowActionsProps {
  delivery: SignedDelivery
}

function RowActions({ delivery }: RowActionsProps) {
  const { toast } = useToast()
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [loadingSignature, setLoadingSignature] = useState(false)

  const hasSignature =
    delivery.signature_storage_path != null || delivery.signature_url != null

  async function handleViewSignature() {
    setLoadingSignature(true)
    try {
      const url = await getSignatureUrl(
        delivery.signature_storage_path,
        delivery.signature_url
      )
      if (!url) {
        toast('No signature image available.')
        return
      }
      setSignatureUrl(url)
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoadingSignature(false)
    }
  }

  async function handleDownloadPDF() {
    try {
      await generateDeliveryPDF({
        delivery_number: delivery.delivery_number,
        project_name: delivery.project_name,
        truck_name: null,
        from_address: { company_name: '', street_address: '', city: '', state: '', zip_code: '', phone: '' },
        to_address: { company_name: '', street_address: '', city: '', state: '', zip_code: '', phone: '' },
        status: delivery.status,
        created_at: delivery.created_at,
        items: (delivery.items ?? []).map((i) => ({
          item_name: i.item_name,
          quantity: i.quantity,
          notes: i.notes,
        })),
        signature_name: delivery.signed_by_name,
      })
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 justify-end">
        {hasSignature && (
          <button
            className="btn btn-ghost btn-xs"
            onClick={handleViewSignature}
            disabled={loadingSignature}
            title="View signature"
          >
            {loadingSignature
              ? <span className="loading loading-spinner loading-xs" />
              : 'Signature'}
          </button>
        )}
        <button
          className="btn btn-ghost btn-xs"
          onClick={handleDownloadPDF}
          title="Download PDF"
        >
          PDF
        </button>
      </div>

      {signatureUrl && (
        <SignatureModal signedUrl={signatureUrl} onClose={() => setSignatureUrl(null)} />
      )}
    </>
  )
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export function SignedDeliveriesTab() {
  const [projectId, setProjectId] = useState<number | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: deliveries = [], isLoading } = useSignedDeliveries({
    projectId,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
  })

  const hasSignature = (d: SignedDelivery) =>
    d.signature_storage_path != null || d.signature_url != null

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--ink-2)] shrink-0">Project</label>
          <ProjectSelector
            value={projectId}
            onChange={setProjectId}
            className="select select-bordered select-sm max-w-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--ink-2)] shrink-0">From</label>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--ink-2)] shrink-0">To</label>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {(projectId || dateFrom || dateTo) && (
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => { setProjectId(null); setDateFrom(''); setDateTo('') }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-md text-[var(--muted)]" />
        </div>
      ) : deliveries.length === 0 ? (
        <div className="py-12 text-center text-[var(--muted)]">
          No signed deliveries found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="table table-sm w-full">
            <thead>
              <tr className="bg-[var(--panel-2)] text-[var(--ink-2)] text-xs uppercase tracking-wider">
                <th>Delivery #</th>
                <th>Project</th>
                <th>Signed By</th>
                <th>Delivered</th>
                <th>Signature</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--panel-2)]">
                  <td className="font-mono text-xs">{d.delivery_number}</td>
                  <td className="text-sm text-[var(--ink-2)]">{d.project_name ?? '—'}</td>
                  <td className="text-sm">{d.signed_by_name ?? '—'}</td>
                  <td className="text-sm text-[var(--muted)]">{formatDate(d.delivered_at)}</td>
                  <td>
                    {hasSignature(d) ? (
                      <span className="badge badge-success badge-sm">Yes</span>
                    ) : (
                      <span className="badge badge-neutral badge-sm">No</span>
                    )}
                  </td>
                  <td className="text-right">
                    <RowActions delivery={d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
