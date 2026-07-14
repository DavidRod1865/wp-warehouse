/**
 * PoUploadZone — Drag-and-drop PDF upload for purchase orders
 *
 * Generic PdfDropZone adapted for PO parsing. Can be reused for other document types.
 */
import { useRef, useState } from 'react'
import { Icon } from '../../../components/ui/Icon'

interface PoUploadZoneProps {
  onFileParsed: (file: File) => void
  isParsing: boolean
  error: string | null
}

export function PoUploadZone({ onFileParsed, isParsing, error }: PoUploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      return
    }
    setFileName(file.name)
    onFileParsed(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <div
        className="rounded-xl text-center py-8 px-6 cursor-pointer transition-colors"
        style={{
          border: `1.5px dashed ${isDragging ? 'var(--signal)' : 'var(--line-2)'}`,
          background: isDragging
            ? 'color-mix(in oklab, var(--signal) 5%, var(--panel))'
            : 'color-mix(in oklab, var(--panel-2) 60%, transparent)',
        }}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleChange}
        />

        {isParsing ? (
          <>
            <div
              className="relative mx-auto mb-3 overflow-hidden rounded-full"
              style={{ width: 200, height: 4, background: 'var(--panel-2)' }}
            >
              <div
                className="absolute top-0 h-full rounded-full"
                style={{
                  width: '33%',
                  background: 'var(--signal)',
                  animation: 'indeterminateSlide 1.4s ease-in-out infinite',
                }}
              />
            </div>
            <div
              className="text-[var(--ink)]"
              style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}
            >
              Parsing purchase order...
            </div>
            <div className="text-[var(--muted)] text-sm mt-1">
              {fileName && <span>{fileName} &middot; </span>}
              Extracting details with AI
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex p-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] mb-2.5">
              <Icon name="upload" className="w-5 h-5 text-[var(--ink-2)]" />
            </div>
            <div
              className="text-[var(--ink)]"
              style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}
            >
              {fileName ? fileName : 'Drop purchase order PDF here'}
            </div>
            <div className="text-[var(--muted)] text-sm mt-1">
              or click to browse &middot; accepts PDF
            </div>
          </>
        )}
      </div>

      {error && (
        <div
          className="mt-2 px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
