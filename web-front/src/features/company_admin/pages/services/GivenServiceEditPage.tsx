import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FaArrowLeft,
  FaCheck,
  FaImage,
  FaSpinner,
  FaXmark,
} from 'react-icons/fa6'
import { FaStar } from 'react-icons/fa'
import { companyApi } from '../../../../services/companyApi'
import type { GivenServiceFull } from '../../../../types/company'
import './GivenServiceEditPage.css'

/* ── types ────────────────────────────────────────────────── */
type PricingType = 'FIXED' | 'HOURLY'

interface FormState {
  pricingType: PricingType
  price: string
  minimumHours: string
  estimatedDurationMinutes: string
  description: string
  whatIsIncluded: string
  whatIsNotIncluded: string
  toolsProvidedByProvider: boolean
  serviceAreaNotes: string
  advanceBookingRequiredHours: string
  serviceRadiusKm: string
  isAvailableImmediately: boolean
  clientMustProvide: string
  active: boolean
  paymentMethodsAccepted: string[]
}

const PAYMENT_OPTIONS = ['Cash', 'Card', 'Bank Transfer', 'Online']

type GalleryRow = { id: string; imageUrl: string }

type PendingGalleryAdd = {
  id: string
  file: File
  previewUrl: string
}

function toForm(gs: GivenServiceFull): FormState {
  return {
    pricingType: gs.pricingType as PricingType,
    price: String(Number(gs.price) || ''),
    minimumHours: gs.minimumHours != null ? String(Number(gs.minimumHours)) : '',
    estimatedDurationMinutes:
      gs.estimatedDurationMinutes != null ? String(Number(gs.estimatedDurationMinutes)) : '',
    description: gs.description ?? '',
    whatIsIncluded: gs.whatIsIncluded ?? '',
    whatIsNotIncluded: gs.whatIsNotIncluded ?? '',
    toolsProvidedByProvider: gs.toolsProvidedByProvider ?? false,
    serviceAreaNotes: gs.serviceAreaNotes ?? '',
    advanceBookingRequiredHours:
      gs.advanceBookingRequiredHours != null ? String(Number(gs.advanceBookingRequiredHours)) : '',
    serviceRadiusKm: gs.serviceRadiusKm != null ? String(Number(gs.serviceRadiusKm)) : '',
    isAvailableImmediately: gs.isAvailableImmediately ?? false,
    clientMustProvide: gs.clientMustProvide ?? '',
    active: gs.active,
    paymentMethodsAccepted: gs.provider.paymentMethodsAccepted ?? [],
  }
}

function diff(
  orig: FormState,
  cur: FormState,
): Partial<Record<keyof FormState, unknown>> {
  const out: Partial<Record<keyof FormState, unknown>> = {}
  ;(Object.keys(cur) as (keyof FormState)[]).forEach((k) => {
    const a = orig[k]
    const b = cur[k]
    if (Array.isArray(a) && Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = b
    } else if (a !== b) {
      out[k] = b
    }
  })
  return out
}

function numOrNull(s: string) {
  const n = parseFloat(s)
  return s.trim() === '' || isNaN(n) ? null : n
}

function intOrNull(s: string) {
  const n = parseInt(s, 10)
  return s.trim() === '' || isNaN(n) ? null : n
}

function coerce(key: keyof FormState, val: unknown) {
  if (
    [
      'price',
      'serviceRadiusKm',
      'advanceBookingRequiredHours',
      'estimatedDurationMinutes',
      'minimumHours',
    ].includes(key)
  ) {
    return ['serviceRadiusKm'].includes(key)
      ? numOrNull(val as string)
      : intOrNull(val as string)
  }
  return val
}

/* ── helpers ─────────────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

/* ── component ────────────────────────────────────────────── */
export function GivenServiceEditPage() {
  const { givenServiceId = '' } = useParams<{ givenServiceId: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<GivenServiceFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const origRef = useRef<FormState | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const galleryFileRef = useRef<HTMLInputElement>(null)
  const pendingAddsRef = useRef<PendingGalleryAdd[]>([])
  const [savedGalleries, setSavedGalleries] = useState<GalleryRow[]>([])
  const [pendingGalleryAdds, setPendingGalleryAdds] = useState<PendingGalleryAdd[]>([])
  const [pendingGalleryRemoveIds, setPendingGalleryRemoveIds] = useState<Set<string>>(
    () => new Set(),
  )

  /* load */
  useEffect(() => {
    setLoading(true)
    companyApi
      .getGivenServiceForEdit(givenServiceId)
      .then((gs) => {
        setData(gs)
        const f = toForm(gs)
        setForm(f)
        origRef.current = { ...f }
        setSavedGalleries(gs.galleries)
        setPendingGalleryAdds([])
        setPendingGalleryRemoveIds(new Set())
      })
      .catch(() => showToast('Failed to load service.', 'error'))
      .finally(() => setLoading(false))
  }, [givenServiceId])

  useEffect(() => {
    pendingAddsRef.current = pendingGalleryAdds
  }, [pendingGalleryAdds])

  useEffect(() => {
    return () => {
      pendingAddsRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
  }, [])

  const displayGalleries = useMemo<GalleryRow[]>(
    () => [
      ...savedGalleries.filter((g) => !pendingGalleryRemoveIds.has(g.id)),
      ...pendingGalleryAdds.map((p) => ({
        id: p.id,
        imageUrl: p.previewUrl,
      })),
    ],
    [savedGalleries, pendingGalleryAdds, pendingGalleryRemoveIds],
  )

  /* dirty tracking */
  useEffect(() => {
    if (!form || !origRef.current) return
    const formChanged = Object.keys(diff(origRef.current, form)).length > 0
    const galleryChanged =
      pendingGalleryAdds.length > 0 || pendingGalleryRemoveIds.size > 0
    setIsDirty(formChanged || galleryChanged)
  }, [form, pendingGalleryAdds, pendingGalleryRemoveIds])

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  /* field helpers */
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  const handleSave = useCallback(async () => {
    if (!form || !origRef.current || !isDirty) return
    setSaving(true)
    try {
      const changed = diff(origRef.current, form)
      const payload: Record<string, unknown> = {}
      ;(Object.keys(changed) as (keyof FormState)[]).forEach((k) => {
        payload[k] = coerce(k, changed[k])
      })
      if (Object.keys(payload).length > 0) {
        await companyApi.updateGivenService(
          givenServiceId,
          payload as Parameters<typeof companyApi.updateGivenService>[1],
        )
        origRef.current = { ...form }
      }

      for (const galleryId of pendingGalleryRemoveIds) {
        await companyApi.removeGalleryImage(galleryId)
      }

      const uploaded: GalleryRow[] = []
      for (const pending of pendingGalleryAdds) {
        const row = await companyApi.uploadGalleryImage(
          givenServiceId,
          pending.file,
        )
        uploaded.push(row)
        URL.revokeObjectURL(pending.previewUrl)
      }

      if (pendingGalleryRemoveIds.size > 0 || pendingGalleryAdds.length > 0) {
        setSavedGalleries((prev) => {
          const kept = prev.filter((g) => !pendingGalleryRemoveIds.has(g.id))
          return [...kept, ...uploaded]
        })
        setPendingGalleryAdds([])
        setPendingGalleryRemoveIds(new Set())
      }

      setIsDirty(false)
      showToast('Changes saved', 'success')
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save changes.'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }, [
    form,
    isDirty,
    givenServiceId,
    pendingGalleryAdds,
    pendingGalleryRemoveIds,
  ])

  const handleToggleActive = useCallback(async () => {
    if (!form) return
    const next = !form.active
    set('active', next)
    try {
      await companyApi.toggleGivenServiceActive(givenServiceId, next)
    } catch {
      set('active', !next)
      showToast('Failed to update status.', 'error')
    }
  }, [form, givenServiceId])

  const handleGalleryFiles = useCallback((fileList: FileList | null) => {
    if (!fileList?.length) return
    const next: PendingGalleryAdd[] = Array.from(fileList).map((file) => ({
      id: `pending-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setPendingGalleryAdds((prev) => [...prev, ...next])
    if (galleryFileRef.current) galleryFileRef.current.value = ''
  }, [])

  const handleRemoveGallery = useCallback((galleryId: string) => {
    if (galleryId.startsWith('pending-')) {
      setPendingGalleryAdds((prev) => {
        const item = prev.find((p) => p.id === galleryId)
        if (item) URL.revokeObjectURL(item.previewUrl)
        return prev.filter((p) => p.id !== galleryId)
      })
      return
    }
    setPendingGalleryRemoveIds((prev) => new Set(prev).add(galleryId))
  }, [])

  const handleBack = () => {
    navigate(-1)
  }

  /* ── derived ─────────────────────────────────────────── */
  const serviceName = data
    ? (data.service.translations.find((t) => t.locale === 'en')?.name ??
      data.service.translations[0]?.name ??
      'Service')
    : ''
  const categoryName = data
    ? (data.service.category.translations.find((t) => t.locale === 'en')?.name ??
      data.service.category.translations[0]?.name ??
      '')
    : ''
  const providerName = data
    ? `${data.provider.user.firstName} ${data.provider.user.lastName}`
    : ''

  /* ── render ───────────────────────────────────────────── */
  if (loading || !form || !data) {
    return (
      <div className="gse-root">
        <SkeletonForm />
      </div>
    )
  }

  return (
    <div className="gse-root">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="gse-header">
        <div className="gse-header-left">
          <button className="gse-back-btn" onClick={handleBack}>
            <FaArrowLeft />
          </button>
          <div>
            <h1 className="gse-title">{serviceName}</h1>
            <span className="gse-cat-badge">{categoryName}</span>
          </div>
        </div>
        <div className="gse-header-right">
          <div className="gse-active-row">
            <span className="gse-active-label">Service active</span>
            <button
              role="switch"
              aria-checked={form.active}
              className={`gse-toggle${form.active ? ' on' : ''}`}
              onClick={() => void handleToggleActive()}
            >
              <span className="gse-toggle-thumb" />
            </button>
          </div>
          <button
            className="gse-save-btn"
            disabled={!isDirty || saving}
            onClick={() => void handleSave()}
          >
            {saving ? <FaSpinner className="gse-spin" /> : <FaCheck />}
            Save changes
          </button>
        </div>
      </div>

      {/* ── Provider identity card ───────────────────────── */}
      <div className="gse-provider-card">
        <div className="gse-prov-left">
          {data.provider.photoUrl ? (
            <img src={data.provider.photoUrl} alt={providerName} className="gse-prov-photo" />
          ) : (
            <div className="gse-prov-ini">{initials(providerName)}</div>
          )}
          <div>
            <div className="gse-prov-name">{providerName}</div>
            <div className="gse-prov-email">{data.provider.user.email}</div>
            <span className={`gse-status-badge ${data.provider.user.status.toLowerCase()}`}>
              {data.provider.user.status}
            </span>
          </div>
        </div>
        <div className="gse-prov-stats">
          <div className="gse-prov-stat">
            <FaStar className="gse-star" />
            <span>{Number(data.averageRating) > 0 ? Number(data.averageRating).toFixed(1) : '—'}</span>
          </div>
          <div className="gse-prov-stat">
            <span className="gse-stat-label">{data.totalReviews} reviews</span>
          </div>
          <div className="gse-prov-stat">
            <span className="gse-stat-label">{data.totalCompletedJobs} jobs done</span>
          </div>
        </div>
      </div>

      {/* ── Sections ─────────────────────────────────────── */}
      <div className="gse-sections">

        {/* SECTION 1 – Pricing */}
        <section className="gse-section">
          <h2 className="gse-section-title">Pricing</h2>

          {/* segmented control */}
          <div className="gse-form-group">
            <label className="gse-label">Pricing type</label>
            <div className="gse-seg">
              {(['FIXED', 'HOURLY'] as PricingType[]).map((v) => (
                <button
                  key={v}
                  className={`gse-seg-btn${form.pricingType === v ? ' active' : ''}`}
                  onClick={() => set('pricingType', v)}
                  type="button"
                >
                  {v === 'FIXED' ? 'Fixed price' : 'Hourly rate'}
                </button>
              ))}
            </div>
          </div>

          <div className="gse-form-row">
            <div className="gse-form-group">
              <label className="gse-label">
                {form.pricingType === 'HOURLY' ? 'Hourly rate (TND/hr)' : 'Fixed price (TND)'}
              </label>
              <div className="gse-input-suffix">
                <input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                />
                <span>TND</span>
              </div>
            </div>

            {form.pricingType === 'HOURLY' && (
              <div className="gse-form-group">
                <label className="gse-label">Minimum booking hours</label>
                <div className="gse-input-suffix">
                  <input
                    type="number"
                    min={1}
                    value={form.minimumHours}
                    onChange={(e) => set('minimumHours', e.target.value)}
                  />
                  <span>hrs</span>
                </div>
              </div>
            )}
          </div>

          <div className="gse-form-group">
            <label className="gse-label">Payment methods</label>
            <div className="gse-checkbox-group">
              {PAYMENT_OPTIONS.map((opt) => (
                <label key={opt} className="gse-checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.paymentMethodsAccepted.includes(opt)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.paymentMethodsAccepted, opt]
                        : form.paymentMethodsAccepted.filter((x) => x !== opt)
                      set('paymentMethodsAccepted', next)
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 2 – Service details */}
        <section className="gse-section">
          <h2 className="gse-section-title">Service details</h2>

          <div className="gse-form-row">
            <div className="gse-form-group">
              <label className="gse-label">Estimated duration</label>
              <div className="gse-input-suffix">
                <input
                  type="number"
                  min={1}
                  value={form.estimatedDurationMinutes}
                  onChange={(e) => set('estimatedDurationMinutes', e.target.value)}
                />
                <span>min</span>
              </div>
            </div>
            <div className="gse-form-group">
              <label className="gse-label">Advance booking required</label>
              <div className="gse-input-suffix">
                <input
                  type="number"
                  min={0}
                  value={form.advanceBookingRequiredHours}
                  onChange={(e) => set('advanceBookingRequiredHours', e.target.value)}
                />
                <span>hrs before</span>
              </div>
            </div>
          </div>

          <div className="gse-form-row">
            <div className="gse-form-group">
              <label className="gse-label">Service radius</label>
              <div className="gse-input-suffix">
                <input
                  type="number"
                  min={0}
                  value={form.serviceRadiusKm}
                  onChange={(e) => set('serviceRadiusKm', e.target.value)}
                />
                <span>km</span>
              </div>
            </div>
            <div className="gse-form-group gse-form-group-center">
              <label className="gse-label">Available immediately</label>
              <button
                role="switch"
                aria-checked={form.isAvailableImmediately}
                className={`gse-toggle${form.isAvailableImmediately ? ' on' : ''}`}
                onClick={() => set('isAvailableImmediately', !form.isAvailableImmediately)}
                type="button"
              >
                <span className="gse-toggle-thumb" />
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 3 – Description */}
        <section className="gse-section">
          <h2 className="gse-section-title">Description &amp; inclusions</h2>

          <Textarea
            label="Description"
            value={form.description}
            onChange={(v) => set('description', v)}
            maxLength={2000}
            rows={4}
          />
          <Textarea
            label="What's included"
            value={form.whatIsIncluded}
            onChange={(v) => set('whatIsIncluded', v)}
            maxLength={2000}
            rows={3}
            hint="List items separated by commas or new lines"
          />
          <Textarea
            label="What's not included"
            value={form.whatIsNotIncluded}
            onChange={(v) => set('whatIsNotIncluded', v)}
            maxLength={2000}
            rows={3}
          />

          <div className="gse-form-row">
            <div className="gse-form-group gse-form-group-center">
              <label className="gse-label">Tools provided by provider</label>
              <button
                role="switch"
                aria-checked={form.toolsProvidedByProvider}
                className={`gse-toggle${form.toolsProvidedByProvider ? ' on' : ''}`}
                onClick={() => set('toolsProvidedByProvider', !form.toolsProvidedByProvider)}
                type="button"
              >
                <span className="gse-toggle-thumb" />
              </button>
            </div>
          </div>

          <div className="gse-form-group">
            <label className="gse-label">Client must provide</label>
            <input
              type="text"
              className="gse-input"
              maxLength={500}
              value={form.clientMustProvide}
              onChange={(e) => set('clientMustProvide', e.target.value)}
            />
          </div>
          <div className="gse-form-group">
            <label className="gse-label">Service area notes</label>
            <input
              type="text"
              className="gse-input"
              maxLength={500}
              value={form.serviceAreaNotes}
              onChange={(e) => set('serviceAreaNotes', e.target.value)}
            />
          </div>
        </section>

        {/* SECTION 4 – Gallery */}
        <section className="gse-section">
          <h2 className="gse-section-title">Service gallery</h2>

          <p className="gse-gallery-hint">
            Select photos from your device (JPEG, PNG, WebP, GIF — max 8 MB each).
            Additions and removals apply when you click Save changes.
          </p>
          <input
            ref={galleryFileRef}
            type="file"
            className="gse-gallery-file-input"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => handleGalleryFiles(e.target.files)}
          />
          <div className="gse-gallery-grid">
            {displayGalleries.map((g) => {
              const isPending = g.id.startsWith('pending-')
              return (
                <div
                  key={g.id}
                  className={`gse-gallery-item${isPending ? ' pending' : ''}`}
                >
                  <img src={g.imageUrl} alt="" />
                  {isPending ? (
                    <span className="gse-gallery-pending-badge">New</span>
                  ) : null}
                  <button
                    type="button"
                    className="gse-gallery-del"
                    onClick={() => handleRemoveGallery(g.id)}
                    title="Remove"
                    disabled={saving}
                  >
                    <FaXmark />
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              className="gse-gallery-add"
              disabled={saving}
              onClick={() => galleryFileRef.current?.click()}
            >
              <FaImage />
              <span>Add photos</span>
            </button>
          </div>
        </section>
      </div>

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div className={`gse-toast ${toast.type}`}>
          {toast.type === 'success' ? <FaCheck /> : <FaXmark />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

/* ── sub-components ───────────────────────────────────────── */
function Textarea({
  label,
  value,
  onChange,
  maxLength,
  rows = 3,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  maxLength: number
  rows?: number
  hint?: string
}) {
  return (
    <div className="gse-form-group">
      <div className="gse-label-row">
        <label className="gse-label">{label}</label>
        <span className="gse-char-count">{value.length}/{maxLength}</span>
      </div>
      {hint && <p className="gse-hint">{hint}</p>}
      <textarea
        className="gse-textarea"
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function SkeletonForm() {
  return (
    <div className="gse-skeleton">
      <div className="gse-skel gse-skel-header" />
      <div className="gse-skel gse-skel-card" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="gse-skel-section">
          <div className="gse-skel gse-skel-title" />
          <div className="gse-skel gse-skel-field" />
          <div className="gse-skel gse-skel-field short" />
          <div className="gse-skel gse-skel-textarea" />
        </div>
      ))}
    </div>
  )
}
