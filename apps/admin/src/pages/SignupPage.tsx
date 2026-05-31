import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

// ─── icons ───────────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
      <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function generateSubdomain(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || 'restaurant'
}

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder-gray-400',
    'outline-none transition-colors focus:border-[#FF5722]',
    hasError
      ? 'border-red-400 bg-red-50'
      : 'border-gray-200 bg-gray-50 focus:bg-white',
  ].join(' ')
}

// ─── small form-field wrapper ─────────────────────────────────────────────────

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}

function Field({ label, required, error, hint, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500"> *</span>}
      </label>
      {children}
      {error  && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

// ─── types ────────────────────────────────────────────────────────────────────

interface FormErrors {
  restaurantName?: string
  ownerName?: string
  email?: string
  password?: string
  phone?: string
  general?: string
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const navigate = useNavigate()

  const [restaurantName, setRestaurantName] = useState('')
  const [ownerName,      setOwnerName]      = useState('')
  const [email,          setEmail]          = useState('')
  const [password,       setPassword]       = useState('')
  const [showPassword,   setShowPassword]   = useState(false)
  const [phone,          setPhone]          = useState('')
  const [gstin,          setGstin]          = useState('')

  const [isLoading,   setIsLoading]   = useState(false)
  const [errors,      setErrors]      = useState<FormErrors>({})
  const [emailSent,   setEmailSent]   = useState(false)

  function clearFieldError(field: keyof FormErrors) {
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!restaurantName.trim())    e.restaurantName = 'Restaurant name is required'
    if (!ownerName.trim())         e.ownerName      = 'Owner name is required'
    if (!email.trim())             e.email          = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address'
    if (!password)                 e.password       = 'Password is required'
    else if (password.length < 6)  e.password       = 'Password must be at least 6 characters'
    if (!phone.trim())             e.phone          = 'Phone number is required'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setIsLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { owner_name: ownerName.trim() } },
      })

      if (authError) {
        setErrors({ general: authError.message })
        return
      }

      const user = authData.user
      if (!user) {
        setErrors({ general: 'Signup failed — please try again.' })
        return
      }

      // Build the restaurant payload regardless of session state
      const subdomain = generateSubdomain(restaurantName)

      if (!authData.session) {
        // Email confirmation is required — no session yet, so RLS would block
        // the insert. Persist the form data and let useRestaurant insert it
        // on the user's first authenticated load (after they confirm + log in).
        localStorage.setItem(
          `pending_restaurant_${user.id}`,
          JSON.stringify({
            name:     restaurantName.trim(),
            subdomain,
            phone:    phone.trim(),
            gstin:    gstin.trim() || null,
          }),
        )
        setEmailSent(true)
        return
      }

      // Session is available — insert immediately
      const { error: insertError } = await supabase
        .from('restaurants')
        .insert({
          name:     restaurantName.trim(),
          subdomain,
          owner_id: user.id,
          phone:    phone.trim(),
          gstin:    gstin.trim() || null,
        })

      if (insertError) {
        if (insertError.code === '23505') {
          // Subdomain collision — append a short random suffix and retry
          const fallback = `${subdomain}-${Math.random().toString(36).slice(2, 6)}`
          const { error: retryError } = await supabase
            .from('restaurants')
            .insert({
              name:     restaurantName.trim(),
              subdomain: fallback,
              owner_id: user.id,
              phone:    phone.trim(),
              gstin:    gstin.trim() || null,
            })
          if (retryError) {
            setErrors({ general: retryError.message })
            return
          }
        } else {
          setErrors({ general: insertError.message })
          return
        }
      }

      navigate('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  // ── email-sent confirmation screen ──────────────────────────────────────────

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-5xl">📧</div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">Check your email</h2>
          <p className="mb-6 text-sm text-gray-500">
            We sent a confirmation link to{' '}
            <span className="font-semibold text-gray-700">{email}</span>.
            Click the link to activate your account, then{' '}
            <Link to="/login" className="font-semibold text-[#FF5722] hover:underline">
              sign in
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  // ── main signup form ─────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo / wordmark */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF5722] shadow-lg shadow-orange-200">
            <span className="text-xl font-black text-white">3DM</span>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">Create your account</p>
            <p className="text-sm text-gray-500">Get your restaurant online in minutes</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
        >
          {errors.general && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {errors.general}
            </div>
          )}

          <Field label="Restaurant Name" required error={errors.restaurantName}>
            <input
              type="text"
              value={restaurantName}
              onChange={e => { setRestaurantName(e.target.value); clearFieldError('restaurantName') }}
              placeholder="e.g. Spice Garden"
              className={inputCls(!!errors.restaurantName)}
            />
          </Field>

          <Field label="Owner Name" required error={errors.ownerName}>
            <input
              type="text"
              value={ownerName}
              onChange={e => { setOwnerName(e.target.value); clearFieldError('ownerName') }}
              placeholder="Your full name"
              className={inputCls(!!errors.ownerName)}
            />
          </Field>

          <Field label="Email" required error={errors.email}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); clearFieldError('email') }}
              placeholder="owner@yourrestaurant.com"
              autoComplete="email"
              className={inputCls(!!errors.email)}
            />
          </Field>

          <Field label="Password" required error={errors.password}>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                className={[inputCls(!!errors.password), 'pr-11'].join(' ')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </Field>

          <Field label="Phone Number" required error={errors.phone}>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); clearFieldError('phone') }}
              placeholder="+91 98765 43210"
              className={inputCls(!!errors.phone)}
            />
          </Field>

          <Field
            label="GSTIN"
            hint="You can add this later"
          >
            <input
              type="text"
              value={gstin}
              onChange={e => setGstin(e.target.value)}
              placeholder="22AAAAA0000A1Z5"
              className={inputCls(false)}
            />
          </Field>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5722] py-3.5 text-sm font-bold text-white transition-opacity disabled:opacity-70 active:opacity-90"
          >
            {isLoading && <Spinner />}
            {isLoading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#FF5722] hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
