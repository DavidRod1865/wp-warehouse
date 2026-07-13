/**
 * useParsePo — Call the parse-purchase-order edge function
 *
 * Sends a PDF (as base64) to Claude Haiku for structured PO extraction.
 * Returns parsed PO data with confidence levels.
 */
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { ParsedPurchaseOrder } from '../types'

interface ParsePoState {
  isParsing: boolean
  error: string | null
  data: ParsedPurchaseOrder | null
}

export function useParsePo() {
  const [state, setState] = useState<ParsePoState>({
    isParsing: false,
    error: null,
    data: null,
  })

  const parsePo = async (file: File): Promise<ParsedPurchaseOrder> => {
    setState({ isParsing: true, error: null, data: null })

    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)

      const { data, error } = await supabase.functions.invoke(
        'parse-purchase-order',
        {
          body: {
            pdf_base64: base64,
          },
        }
      )

      if (error) throw new Error(error.message || 'Failed to parse PO')

      const result = data as ParsedPurchaseOrder
      setState({ isParsing: false, error: null, data: result })
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse PO'
      setState({ isParsing: false, error: message, data: null })
      throw err
    }
  }

  const reset = () => setState({ isParsing: false, error: null, data: null })

  return { ...state, parsePo, reset }
}
