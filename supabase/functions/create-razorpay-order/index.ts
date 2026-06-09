// Supabase Edge Function: create-razorpay-order
//
// Creates a Razorpay order server-side so the secret key never reaches the
// browser. The guest app calls this via supabase.functions.invoke(...).
//
// Deploy:   supabase functions deploy create-razorpay-order
// Secrets:  supabase secrets set RAZORPAY_KEY_ID=rzp_xxx RAZORPAY_KEY_SECRET=yyy
//
// Request body:  { amount: number (paise), currency?: string, receipt?: string, notes?: object }
// Response:      { razorpay_order_id, amount, currency }

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

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const { amount, currency = 'INR', receipt, notes } = await req.json()

    // Razorpay requires an integer amount in the smallest currency unit (paise).
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 100) {
      return json({ error: 'Invalid amount (must be paise, >= 100)' }, 400)
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!keyId || !keySecret) {
      return json({ error: 'Razorpay is not configured on the server' }, 500)
    }

    const auth = btoa(`${keyId}:${keySecret}`)
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount),
        currency,
        receipt,
        notes,
      }),
    })

    const data = await rzpRes.json()
    if (!rzpRes.ok) {
      const msg = data?.error?.description ?? 'Razorpay order creation failed'
      return json({ error: msg }, rzpRes.status)
    }

    return json({
      razorpay_order_id: data.id,
      amount: data.amount,
      currency: data.currency,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: msg }, 500)
  }
})
