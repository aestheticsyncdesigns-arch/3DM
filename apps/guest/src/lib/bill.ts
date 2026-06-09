import { supabase } from './supabase'

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

/** Calls the generate-bill Edge Function and returns the PDF as a Blob. */
export async function generateBillBlob(orderId: string): Promise<{ blob: Blob; filename: string }> {
  const { data, error } = await supabase.functions.invoke('generate-bill', {
    body: { order_id: orderId },
  })
  if (error) throw new Error(error.message)
  if (!data?.pdf_base64) throw new Error(data?.error ?? 'No bill returned')
  return {
    blob: base64ToBlob(data.pdf_base64, 'application/pdf'),
    filename: data.filename ?? `bill-${orderId}.pdf`,
  }
}

/** Generates the bill and triggers a download on the guest's device. */
export async function downloadBill(orderId: string): Promise<void> {
  const { blob, filename } = await generateBillBlob(orderId)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
