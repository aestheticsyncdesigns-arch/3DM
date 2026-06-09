// Supabase Edge Function: generate-bill
//
// Generates a GST-compliant PDF invoice for an order and returns it as a
// base64 string. The guest app downloads it; the admin app opens it in a tab.
//
// Deploy:  supabase functions deploy generate-bill
// (Uses the project's built-in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — no
//  extra secrets needed. Service role is used to read order/restaurant data
//  regardless of RLS.)
//
// Request body:  { order_id: string }
// Response:      { pdf_base64: string, filename: string }

import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Indian-format money with a "Rs." prefix. The PDF's standard Helvetica font
// can't encode the ₹ glyph (U+20B9), so we use "Rs." — standard on GST bills.
function money(n: number): string {
  return 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dishNameOf(item: any): string {
  const d = item.dishes
  if (Array.isArray(d)) return d[0]?.name ?? 'Item'
  return d?.name ?? 'Item'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { order_id } = await req.json()
    if (!order_id || typeof order_id !== 'string') {
      return json({ error: 'order_id is required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Fetch order, items (+dish names), restaurant, table ────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()
    if (orderErr || !order) return json({ error: 'Order not found' }, 404)

    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, price, dish_id, dishes ( name )')
      .eq('order_id', order_id)

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', order.restaurant_id)
      .single()

    let tableNumber: string | null = null
    if (order.table_id) {
      const { data: table } = await supabase
        .from('tables')
        .select('number')
        .eq('id', order.table_id)
        .single()
      tableNumber = table?.number ?? null
    }

    const lineItems = items ?? []

    // ── Compute totals from the restaurant's configured GST slab ───────────────
    const subtotal = order.subtotal != null && Number(order.subtotal) > 0
      ? Number(order.subtotal)
      : lineItems.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0)

    const slab     = Number(restaurant?.gst_slab ?? 5)
    const gstAmt   = subtotal * (slab / 100)
    const cgst     = gstAmt / 2
    const sgst     = gstAmt / 2
    const grand    = subtotal + gstAmt
    const hsnCode  = restaurant?.hsn_code ?? '996331'

    // ── Build the PDF ──────────────────────────────────────────────────────────
    const pdf  = await PDFDocument.create()
    const page = pdf.addPage([595.28, 841.89]) // A4
    const font     = await pdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

    const W = 595.28
    const M = 50            // left/right margin
    const right = W - M
    const dark  = rgb(0.1, 0.1, 0.1)
    const gray  = rgb(0.45, 0.45, 0.45)
    const accent = rgb(1, 0.34, 0.13) // #FF5722
    let y = 800

    const text = (s: string, x: number, size: number, f = font, color = dark) =>
      page.drawText(s, { x, y, size, font: f, color })

    const textRight = (s: string, xRight: number, size: number, f = font, color = dark) => {
      const w = f.widthOfTextAtSize(s, size)
      page.drawText(s, { x: xRight - w, y, size, font: f, color })
    }

    const hr = (color = rgb(0.85, 0.85, 0.85)) => {
      page.drawLine({ start: { x: M, y }, end: { x: right, y }, thickness: 1, color })
    }

    // ── Logo (optional) ────────────────────────────────────────────────────────
    let headerX = M
    if (restaurant?.logo_url) {
      try {
        const res = await fetch(restaurant.logo_url)
        if (res.ok) {
          const bytes = new Uint8Array(await res.arrayBuffer())
          const ct = res.headers.get('content-type') ?? ''
          const img = ct.includes('png') || restaurant.logo_url.toLowerCase().endsWith('.png')
            ? await pdf.embedPng(bytes)
            : await pdf.embedJpg(bytes)
          const dim = img.scaleToFit(48, 48)
          page.drawImage(img, { x: M, y: y - 48 + 12, width: dim.width, height: dim.height })
          headerX = M + 60
        }
      } catch { /* bad/unreachable logo — skip silently */ }
    }

    // ── Header: restaurant name + details ──────────────────────────────────────
    text(restaurant?.name ?? 'Restaurant', headerX, 20, fontBold)
    y -= 18
    if (restaurant?.address) { text(restaurant.address, headerX, 9, font, gray); y -= 12 }
    if (restaurant?.phone)   { text(`Phone: ${restaurant.phone}`, headerX, 9, font, gray); y -= 12 }
    if (restaurant?.gstin)   { text(`GSTIN: ${restaurant.gstin}`, headerX, 9, font, gray); y -= 12 }

    y -= 8
    // "TAX INVOICE" banner
    page.drawRectangle({ x: M, y: y - 4, width: right - M, height: 22, color: rgb(0.96, 0.96, 0.96) })
    text('TAX INVOICE', M + 8, 12, fontBold, accent)
    y -= 28

    // ── Bill meta: number, date, table ─────────────────────────────────────────
    const dateStr = new Date(order.created_at ?? Date.now()).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    text(`Bill No: ${order.token_number != null ? '#' + order.token_number : order.id.slice(0, 8)}`, M, 10, fontBold)
    textRight(dateStr, right, 10, font, gray)
    y -= 14
    text(tableNumber ? `Table: ${tableNumber}` : 'Takeaway', M, 10, font, gray)
    y -= 18

    // ── Items table header ─────────────────────────────────────────────────────
    const xQty = 330, xUnit = 440, xTot = right
    hr(rgb(0.8, 0.8, 0.8))
    y -= 16
    text('Item', M, 10, fontBold)
    textRight('Qty', xQty, 10, fontBold)
    textRight('Unit', xUnit, 10, fontBold)
    textRight('Amount', xTot, 10, fontBold)
    y -= 8
    hr()
    y -= 16

    for (const it of lineItems) {
      let name = dishNameOf(it)
      if (name.length > 42) name = name.slice(0, 41) + '…'
      const qty  = Number(it.quantity)
      const unit = Number(it.price)
      text(name, M, 10)
      textRight(String(qty), xQty, 10)
      textRight(money(unit), xUnit, 10)
      textRight(money(unit * qty), xTot, 10)
      y -= 16
      if (y < 120) { y = 800; pdf.addPage([595.28, 841.89]) } // simple overflow guard
    }

    y -= 4
    hr()
    y -= 18

    // ── Totals block (right-aligned) ───────────────────────────────────────────
    const labelX = 360
    const totalsRow = (label: string, value: string, bold = false) => {
      const f = bold ? fontBold : font
      text(label, labelX, bold ? 12 : 10, f, bold ? dark : gray)
      textRight(value, right, bold ? 12 : 10, f)
      y -= bold ? 20 : 15
    }
    totalsRow('Subtotal', money(subtotal))
    totalsRow(`CGST (${slab / 2}%)`, money(cgst))
    totalsRow(`SGST (${slab / 2}%)`, money(sgst))
    y -= 2
    hr(rgb(0.8, 0.8, 0.8))
    y -= 18
    totalsRow('Grand Total', money(grand), true)

    y -= 6
    text(`HSN/SAC: ${hsnCode}`, M, 9, font, gray)

    // ── Footer ─────────────────────────────────────────────────────────────────
    y = 90
    page.drawLine({ start: { x: M, y }, end: { x: right, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) })
    y -= 20
    const thanks = 'Thank you for dining with us'
    page.drawText(thanks, { x: (W - fontBold.widthOfTextAtSize(thanks, 12)) / 2, y, size: 12, font: fontBold, color: dark })
    y -= 28
    const brand = 'Powered by 3DM'
    page.drawText(brand, { x: (W - font.widthOfTextAtSize(brand, 9)) / 2, y, size: 9, font, color: gray })

    // ── Serialize → base64 ─────────────────────────────────────────────────────
    const pdfBytes = await pdf.save()
    const base64 = encodeBase64(pdfBytes)
    const filename = `bill-${order.token_number ?? order.id.slice(0, 8)}.pdf`

    return json({ pdf_base64: base64, filename })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: msg }, 500)
  }
})
