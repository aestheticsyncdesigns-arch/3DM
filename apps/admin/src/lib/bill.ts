import { supabase } from '../supabase'

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

/** Calls the generate-bill Edge Function and opens the PDF in a new tab. */
export async function openBill(orderId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('generate-bill', {
    body: { order_id: orderId },
  })
  if (error) throw new Error(error.message)
  if (!data?.pdf_base64) throw new Error(data?.error ?? 'No bill returned')

  const blob = base64ToBlob(data.pdf_base64, 'application/pdf')
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
