import { useState } from 'react'
import {
  FaArrowTrendUp,
  FaCheck,
  FaCircleInfo,
  FaClock,
  FaEllipsisVertical,
  FaFire,
  FaFilter,
  FaLayerGroup,
  FaMagnifyingGlass,
  FaPenToSquare,
  FaPlus,
  FaTag,
  FaTrashCan,
  FaTriangleExclamation,
  FaUsers,
  FaUsersGear,
  FaXmark,
} from 'react-icons/fa6'
import { FaRegClock, FaEyeSlash } from 'react-icons/fa'
import './CompanyServicesPage.css'

type ServiceCard = {
  id: number
  name: string
  description: string
  price: number
  category: string
  categoryColor: string
  image: string
  capacity: string
  capacityStatus: 'available' | 'full'
  addons: string
  duration: string
  providers: string[]
  extraProviders?: number
  inactive?: boolean
  layout?: 'horizontal' | 'vertical'
}

const SERVICES: ServiceCard[] = [
  {
    id: 1,
    name: 'Deep Home Cleaning',
    description: 'Comprehensive sanitization for apartments and villas.',
    price: 250,
    category: 'Cleaning',
    categoryColor: 'purple',
    image: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/33d2ff2b89-20f776849c35cef7691e.png',
    capacity: '10/day',
    capacityStatus: 'available',
    addons: '2 active',
    duration: '240 min',
    providers: [
      'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg',
      'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg',
    ],
    extraProviders: 8,
    layout: 'horizontal',
  },
  {
    id: 2,
    name: 'AC Duct Cleaning',
    description: 'Professional air quality improvement.',
    price: 180,
    category: 'Maintenance',
    categoryColor: 'blue',
    image: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/bb6bbfb827-88fb46c6f3497494c80e.png',
    capacity: '5/day',
    capacityStatus: 'full',
    addons: 'None',
    duration: '120 min',
    providers: [
      'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-4.jpg',
    ],
    extraProviders: 4,
    layout: 'horizontal',
  },
  {
    id: 3,
    name: 'Sofa Shampooing',
    description: 'Deep shampoo cleaning for fabric sofas to remove stains and odors.',
    price: 120,
    category: 'Cleaning',
    categoryColor: 'purple',
    image: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    capacity: '–',
    capacityStatus: 'available',
    addons: '–',
    duration: '1.5h',
    providers: [
      'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg',
      'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg',
    ],
    extraProviders: 5,
    layout: 'vertical',
  },
  {
    id: 4,
    name: 'Relaxing Massage',
    description: '60-minute full body relaxation massage with essential oils.',
    price: 300,
    category: 'Beauty & Spa',
    categoryColor: 'pink',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    capacity: '–',
    capacityStatus: 'available',
    addons: '–',
    duration: '1h',
    providers: [
      'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg',
      'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg',
    ],
    extraProviders: 3,
    layout: 'vertical',
  },
  {
    id: 5,
    name: 'Premium Car Wash',
    description: 'Interior and exterior premium wash with wax polishing.',
    price: 85,
    category: 'Automotive',
    categoryColor: 'gray',
    image: 'https://images.unsplash.com/photo-1595429035839-c99c298ffdde?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    capacity: '–',
    capacityStatus: 'available',
    addons: '–',
    duration: '1h',
    providers: [],
    inactive: true,
    layout: 'vertical',
  },
]

const CATEGORIES = ['All Services', 'Cleaning', 'Maintenance', 'Beauty & Spa', 'Automotive']

export function CompanyServicesPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [serviceActive, setServiceActive] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All Services')

  return (
    <div className="cs-root">
      {/* Stats */}
      <div className="cs-stats-grid">
        <article className="cs-stat-card cs-hover-purple">
          <div>
            <p>Active Services</p>
            <h3>24</h3>
            <span className="cs-trend-green"><FaCheck /> 100% Operational</span>
          </div>
          <div className="cs-stat-icon purple"><FaLayerGroup /></div>
        </article>

        <article className="cs-stat-card cs-hover-green">
          <div>
            <p>Most Popular</p>
            <h3>Deep Clean</h3>
            <span className="cs-sub-text">42% of total bookings</span>
          </div>
          <div className="cs-stat-icon green"><FaFire /></div>
        </article>

        <article className="cs-stat-card cs-hover-blue">
          <div>
            <p>Avg. Service Price</p>
            <h3>AED 185</h3>
            <span className="cs-trend-blue"><FaArrowTrendUp /> +12% vs last month</span>
          </div>
          <div className="cs-stat-icon blue"><FaTag /></div>
        </article>

        <article className="cs-stat-card cs-hover-yellow">
          <div>
            <p>Unassigned Services</p>
            <h3>2</h3>
            <span className="cs-link-text">Assign providers now</span>
          </div>
          <div className="cs-stat-icon yellow"><FaTriangleExclamation /></div>
        </article>
      </div>

      {/* Toolbar */}
      <div className="cs-toolbar">
        <div className="cs-toolbar-left">
          <div className="cs-search-wrap">
            <FaMagnifyingGlass className="cs-search-icon" />
            <input type="text" placeholder="Search services, categories..." />
          </div>
          <button className="cs-btn-ghost"><FaFilter /> Filters</button>
        </div>
        <div className="cs-toolbar-right">
          <button className="cs-btn-primary" onClick={() => setDrawerOpen(true)}>
            <FaPlus /> Create New Service
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="cs-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`cs-tab${activeCategory === cat ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Services grid */}
      <div className="cs-grid">
        {SERVICES.map((s) =>
          s.layout === 'horizontal' ? (
            <HorizontalCard key={s.id} service={s} onEdit={() => setDrawerOpen(true)} />
          ) : (
            <VerticalCard key={s.id} service={s} onEdit={() => setDrawerOpen(true)} />
          ),
        )}

        {/* Add new card */}
        <div className="cs-add-card" onClick={() => setDrawerOpen(true)}>
          <div className="cs-add-icon"><FaPlus /></div>
          <h3>Add New Service</h3>
          <p>Create a new service offering and assign providers</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="cs-footer">
        <span>© 2024 HireWise Inc. All rights reserved.</span>
        <div>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Help Center</a>
        </div>
      </footer>

      {/* Manage Service Drawer */}
      {drawerOpen ? (
        <>
          <div className="cs-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="cs-drawer">
            <div className="cs-drawer-header">
              <div>
                <h2>Manage Service</h2>
                <p>Configure details, pricing, and rules.</p>
              </div>
              <div className="cs-drawer-head-right">
                <span className="cs-status-label">Status:</span>
                <button
                  role="switch"
                  aria-checked={serviceActive}
                  className={`cs-toggle${serviceActive ? ' on' : ''}`}
                  onClick={() => setServiceActive((v) => !v)}
                >
                  <span className="cs-toggle-thumb" />
                </button>
                <div className="cs-divider" />
                <button className="cs-close-btn" onClick={() => setDrawerOpen(false)}>
                  <FaXmark />
                </button>
              </div>
            </div>

            <div className="cs-drawer-body">
              {/* Basic Info */}
              <section className="cs-drawer-section">
                <h3><FaCircleInfo className="cs-section-icon" /> Basic Information</h3>
                <div className="cs-form-group">
                  <label>Service Name</label>
                  <input type="text" defaultValue="Deep Home Cleaning" />
                </div>
                <div className="cs-form-grid-2">
                  <div className="cs-form-group">
                    <label>Category</label>
                    <select>
                      <option>Cleaning</option>
                      <option>Maintenance</option>
                      <option>Beauty</option>
                    </select>
                  </div>
                  <div className="cs-form-group">
                    <label>Sub-Category</label>
                    <select>
                      <option>Residential</option>
                      <option>Commercial</option>
                    </select>
                  </div>
                </div>
                <div className="cs-form-group">
                  <label>Description</label>
                  <textarea
                    defaultValue="Comprehensive deep cleaning service for apartments and villas including sanitization."
                  />
                </div>
              </section>

              {/* Pricing & Rules */}
              <section className="cs-drawer-section">
                <h3><FaTag className="cs-section-icon" /> Pricing &amp; Rules</h3>
                <div className="cs-pricing-box">
                  <div className="cs-form-grid-2">
                    <div className="cs-form-group">
                      <label>Base Price (AED)</label>
                      <div className="cs-input-prefix">
                        <span>AED</span>
                        <input type="number" defaultValue="250" />
                      </div>
                    </div>
                    <div className="cs-form-group">
                      <label>Duration (Minutes)</label>
                      <div className="cs-input-prefix">
                        <FaRegClock />
                        <input type="number" defaultValue="240" />
                      </div>
                    </div>
                  </div>

                  <div className="cs-form-group">
                    <label>Pricing Model</label>
                    <div className="cs-radio-group">
                      {['Fixed Price', 'Hourly Rate', 'Variable'].map((m, i) => (
                        <label key={m} className="cs-radio-option">
                          <input type="radio" name="pricing_model" defaultChecked={i === 0} />
                          <span>{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="cs-form-group">
                    <div className="cs-label-row">
                      <label>Add-ons &amp; Options</label>
                      <button className="cs-link-btn">+ Add Option</button>
                    </div>
                    {[
                      { name: 'Eco-friendly Products', price: 50 },
                      { name: 'Balcony Cleaning', price: 30 },
                    ].map((addon) => (
                      <div key={addon.name} className="cs-addon-row">
                        <input type="text" defaultValue={addon.name} />
                        <div className="cs-addon-price">
                          <span>AED</span>
                          <input type="number" defaultValue={addon.price} />
                        </div>
                        <button className="cs-trash-btn"><FaTrashCan /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Capacity & Assignment */}
              <section className="cs-drawer-section">
                <h3><FaUsersGear className="cs-section-icon" /> Capacity &amp; Assignment</h3>
                <div className="cs-form-grid-2">
                  <div className="cs-form-group">
                    <label>Staff Required</label>
                    <input type="number" defaultValue="2" />
                  </div>
                  <div className="cs-form-group">
                    <label>Max Daily Bookings</label>
                    <input type="number" defaultValue="10" />
                  </div>
                </div>

                <div className="cs-form-group">
                  <label>Branch Availability</label>
                  <div className="cs-branch-checks">
                    {[
                      { label: 'Dubai HQ', checked: true },
                      { label: 'Abu Dhabi Branch', checked: false },
                      { label: 'Sharjah Branch', checked: false },
                    ].map((b) => (
                      <label key={b.label} className={`cs-branch-chip${b.checked ? ' checked' : ''}`}>
                        <input type="checkbox" defaultChecked={b.checked} />
                        {b.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="cs-form-group">
                  <div className="cs-label-row">
                    <label>Assigned Providers</label>
                    <span className="cs-count-badge">10 selected</span>
                  </div>
                  <div className="cs-providers-list">
                    {[
                      { name: 'Sarah Mitchell', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg', checked: true },
                      { name: 'David Chen', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg', checked: true },
                      { name: 'Elena Rodriguez', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg', checked: false },
                    ].map((p) => (
                      <div key={p.name} className="cs-provider-item">
                        <div className="cs-prov-info">
                          <img src={p.avatar} alt={p.name} />
                          <span>{p.name}</span>
                        </div>
                        <input type="checkbox" defaultChecked={p.checked} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <div className="cs-drawer-footer">
              <button className="cs-btn-ghost" onClick={() => setDrawerOpen(false)}>Cancel</button>
              <button className="cs-btn-primary">Save Changes</button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}

/* ── Sub-components ───────────────────────────────────────── */
function HorizontalCard({ service: s, onEdit }: { service: ServiceCard; onEdit: () => void }) {
  return (
    <div className="cs-card-h">
      <div className="cs-card-h-img">
        <img src={s.image} alt={s.name} />
        <span className={`cs-cat-badge top-left ${s.categoryColor}`}>{s.category}</span>
      </div>
      <div className="cs-card-h-body">
        <div className="cs-card-title-row">
          <div>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
          </div>
          <div className="cs-price-col">
            <span className="cs-price">AED {s.price}</span>
            <small>Base Price</small>
          </div>
        </div>

        <div className="cs-mini-grid">
          <div className="cs-mini-cell">
            <small>Capacity</small>
            <span>
              {s.capacity}{' '}
              <em className={s.capacityStatus === 'full' ? 'red' : 'green'}>
                {s.capacityStatus === 'full' ? 'Full' : 'Available'}
              </em>
            </span>
          </div>
          <div className="cs-mini-cell">
            <small>Add-ons</small>
            <span>{s.addons}</span>
          </div>
          <div className="cs-mini-cell">
            <small>Duration</small>
            <span>{s.duration}</span>
          </div>
        </div>

        <div className="cs-card-footer">
          <AvatarStack providers={s.providers} extra={s.extraProviders} />
          <div className="cs-card-actions">
            <button className="cs-icon-btn" onClick={onEdit}><FaPenToSquare /></button>
            <button className="cs-quick-assign-btn">Quick Assign</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function VerticalCard({ service: s, onEdit }: { service: ServiceCard; onEdit: () => void }) {
  return (
    <div className={`cs-card-v${s.inactive ? ' inactive' : ''}`} onClick={onEdit}>
      <button className="cs-more-btn" onClick={(e) => { e.stopPropagation() }}>
        <FaEllipsisVertical />
      </button>
      {s.inactive ? (
        <div className="cs-inactive-badge"><FaEyeSlash /> Inactive</div>
      ) : null}
      <div className="cs-card-v-img">
        <img src={s.image} alt={s.name} className={s.inactive ? 'grayscale' : ''} />
        <span className={`cs-cat-badge bottom-left ${s.categoryColor}`}>{s.category}</span>
      </div>
      <div className="cs-card-v-body">
        <div className="cs-card-title-row">
          <h3 className={s.inactive ? 'muted' : ''}>{s.name}</h3>
          <div className="cs-price-inline">
            <span className="cs-currency">AED</span>
            <span className={`cs-price-val${s.inactive ? ' muted' : ''}`}>{s.price}</span>
          </div>
        </div>
        <p>{s.description}</p>
        <div className="cs-card-v-footer">
          <div className="cs-tags">
            <span><FaRegClock /> {s.duration}</span>
            {s.inactive ? null : <span><FaUsers /> 1 Staff</span>}
          </div>
          {s.inactive ? (
            <span className="cs-no-providers">No Providers</span>
          ) : (
            <AvatarStack providers={s.providers} extra={s.extraProviders} small />
          )}
        </div>
      </div>
    </div>
  )
}

function AvatarStack({
  providers,
  extra,
  small,
}: {
  providers: string[]
  extra?: number
  small?: boolean
}) {
  const size = small ? 'cs-avatar-sm' : 'cs-avatar'
  return (
    <div className="cs-avatar-stack">
      {providers.map((src) => (
        <img key={src} src={src} alt="" className={size} />
      ))}
      {extra ? (
        <div className={`${size} cs-avatar-extra`}>+{extra}</div>
      ) : null}
    </div>
  )
}
