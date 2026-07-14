/**
 * SignatureModal — Full-screen proof-of-delivery modal.
 *
 * Flow:
 *  1. Driver enters "signed by" name + optional notes.
 *  2. Signs on the canvas.
 *  3. On Confirm:
 *     a. Canvas → Blob (PNG)
 *     b. Upload to 'delivery-signatures-v2' at path {deliveryId}/{Date.now()}.png
 *     c. Call confirm_delivery RPC with storage path + per-item quantities.
 *  4. On success → onSuccess() callback (navigate back).
 *  5. On error → show error + allow retry (modal stays open).
 */
import { useRef, useState, useCallback } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '../../../lib/supabase'

interface DeliveredQty {
  delivery_item_id: number
  delivered_quantity: number
}

interface Props {
  deliveryId: number
  deliveredQtys: DeliveredQty[]
  onSuccess: () => void
  onClose: () => void
}

type Step = 'form' | 'uploading' | 'success'

export function SignatureModal({ deliveryId, deliveredQtys, onSuccess, onClose }: Props) {
  const sigRef = useRef<SignatureCanvas>(null)
  const [signedBy, setSignedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [uploadStatus, setUploadStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSigEmpty, setIsSigEmpty] = useState(true)

  const handleClear = useCallback(() => {
    sigRef.current?.clear()
    setIsSigEmpty(true)
    setError(null)
  }, [])

  const handleSigEnd = useCallback(() => {
    setIsSigEmpty(sigRef.current?.isEmpty() ?? true)
  }, [])

  const canvasToBlob = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const canvas = sigRef.current?.getTrimmedCanvas()
      if (!canvas) return reject(new Error('No canvas'))
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to convert canvas to blob'))
      }, 'image/png')
    })

  const handleConfirm = async () => {
    setError(null)

    if (!signedBy.trim()) {
      setError('Please enter the name of the person signing.')
      return
    }

    if (sigRef.current?.isEmpty()) {
      setError('Please provide a signature.')
      return
    }

    try {
      setStep('uploading')
      setUploadStatus('Uploading signature...')

      const blob = await canvasToBlob()
      const filePath = `${deliveryId}/${Date.now()}.png`

      const { error: uploadError } = await supabase.storage
        .from('delivery-signatures-v2')
        .upload(filePath, blob, { contentType: 'image/png', upsert: true })

      if (uploadError) throw new Error(`Signature upload failed: ${uploadError.message}`)

      setUploadStatus('Confirming delivery...')

      const { data, error: rpcError } = await supabase.rpc('confirm_delivery', {
        p_delivery_id: deliveryId,
        p_signed_by_name: signedBy.trim(),
        p_signature_storage_path: filePath,
        p_notes: notes.trim() || null,
        // supabase-js serializes jsonb params itself — pre-stringifying would
        // deliver a JSON string scalar and break jsonb_array_elements in the RPC
        p_delivered: deliveredQtys.length > 0 ? deliveredQtys : null,
      })

      if (rpcError) throw new Error(`Delivery confirmation failed: ${rpcError.message}`)

      const result = data as { success: boolean } | null
      if (!result?.success) throw new Error('confirm_delivery returned unsuccessful')

      setStep('success')
    } catch (err) {
      setStep('form')
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.')
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="fixed inset-0 z-50 bg-base-100 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-6xl">✓</div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-success">Delivery Confirmed!</h2>
          <p className="text-base-content/70 mt-2">
            Signed by <strong>{signedBy}</strong>
          </p>
        </div>
        <button className="btn btn-primary btn-lg w-full max-w-sm" onClick={onSuccess}>
          Back to Deliveries
        </button>
      </div>
    )
  }

  // ── Upload in progress ────────────────────────────────────────────────────
  if (step === 'uploading') {
    return (
      <div className="fixed inset-0 z-50 bg-base-100 flex flex-col items-center justify-center gap-4 px-6">
        <span className="loading loading-spinner loading-lg" />
        <p className="text-base-content/70">{uploadStatus}</p>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-base-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-200">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onClose}
        >
          Cancel
        </button>
        <h2 className="flex-1 text-center font-bold text-lg">Proof of Delivery</h2>
        <div className="w-16" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

        {/* Signed by */}
        <div className="form-control gap-1">
          <label className="label py-0">
            <span className="label-text font-semibold">
              Received by <span className="text-error">*</span>
            </span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full text-base"
            placeholder="Full name of recipient"
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Notes */}
        <div className="form-control gap-1">
          <label className="label py-0">
            <span className="label-text font-semibold">Notes <span className="text-base-content/40">(optional)</span></span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full text-base resize-none"
            rows={2}
            placeholder="Any delivery notes or discrepancies…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Signature pad */}
        <div className="form-control gap-1">
          <div className="flex items-center justify-between">
            <label className="label-text font-semibold">
              Signature <span className="text-error">*</span>
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-xs text-base-content/50"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
          <div className="border-2 border-base-300 rounded-xl overflow-hidden bg-white touch-none">
            <SignatureCanvas
              ref={sigRef}
              penColor="#1e293b"
              canvasProps={{
                className: 'w-full',
                style: { width: '100%', height: 200, display: 'block' },
              }}
              clearOnResize={false}
              onEnd={handleSigEnd}
              onBegin={() => setIsSigEmpty(false)}
            />
          </div>
          {isSigEmpty && (
            <p className="text-xs text-base-content/40 mt-1 pl-1">
              Sign in the box above
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error text-sm py-2">
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Sticky confirm button */}
      <div className="p-4 border-t border-base-300 bg-base-100">
        <button
          type="button"
          className="btn btn-success btn-lg w-full"
          onClick={handleConfirm}
          disabled={step !== 'form'}
        >
          Confirm Delivery
        </button>
      </div>
    </div>
  )
}
