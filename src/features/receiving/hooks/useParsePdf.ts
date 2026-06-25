/**
 * useParsePdf — Call the parse-packing-list edge function
 *
 * Sends a PDF (as base64) to Claude Haiku for structured item extraction.
 * Returns parsed items with confidence levels.
 */
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { ParsedPackingItem } from '../types'

interface ParsePdfResult {
  items: ParsedPackingItem[]
}

interface ParsePdfState {
  isParsing: boolean
  error: string | null
  items: ParsedPackingItem[] | null
}

export function useParsePdf() {
  const [state, setState] = useState<ParsePdfState>({
    isParsing: false,
    error: null,
    items: null,
  })

  const parsePdf = async (
    file: File,
    vendor?: string,
    poNumber?: string,
  ): Promise<ParsedPackingItem[]> => {
    setState({ isParsing: true, error: null, items: null })

    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)

      const { data, error } = await supabase.functions.invoke('parse-packing-list', {
        body: {
          pdf_base64: base64,
          vendor: vendor || undefined,
          po_number: poNumber || undefined,
        },
      })

      if (error) throw new Error(error.message || 'Failed to parse PDF')

      const result = data as ParsePdfResult
      setState({ isParsing: false, error: null, items: result.items })
      return result.items
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse PDF'
      setState({ isParsing: false, error: message, items: null })
      throw err
    }
  }

  const reset = () => setState({ isParsing: false, error: null, items: null })

  return { ...state, parsePdf, reset }
}
