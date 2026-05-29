import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  FaArrowRight,
  FaArrowTrendUp,
  FaBoxesStacked,
  FaCircleExclamation,
  FaCircleInfo,
  FaClipboardCheck,
  FaCoins,
  FaEllipsisVertical,
  FaEnvelope,
  FaFileExport,
  FaFilter,
  FaMedal,
  FaPlus,
  FaSackDollar,
  FaStar,
  FaTriangleExclamation,
  FaUserGroup,
} from 'react-icons/fa6'
import './CompanyDashboardPage.css'

const revenueData = [
  { day: 'Mon', value: 8500 },
  { day: 'Tue', value: 9200 },
  { day: 'Wed', value: 8800 },
  { day: 'Thu', value: 10500 },
  { day: 'Fri', value: 11200 },
  { day: 'Sat', value: 12450 },
  { day: 'Sun', value: 9800 },
]

const liveOrders = [
  {
    id: '#ORD-8291',
    time: '10:42 AM',
    service: 'Deep Cleaning',
    customer: 'Sarah Connor',
    zone: 'Jumeirah 1',
    provider: 'Maria S.',
    providerPhoto: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg',
    status: 'In Progress',
    statusTone: 'blue',
    action: 'More',
  },
  {
    id: '#ORD-8292',
    time: '11:15 AM',
    service: 'AC Maintenance',
    customer: 'Ahmed Al-Sayed',
    zone: 'Downtown',
    provider: 'Unassigned',
    providerPhoto: null,
    status: 'Pending',
    statusTone: 'yellow',
    action: 'Assign',
  },
  {
    id: '#ORD-8289',
    time: '09:30 AM',
    service: 'Beauty Service',
    customer: 'Lisa Wong',
    zone: 'Marina',
    provider: 'Elena R.',
    providerPhoto: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg',
    status: 'Completed',
    statusTone: 'green',
    action: 'More',
  },
  {
    id: '#ORD-8285',
    time: '08:15 AM',
    service: 'Moving Help',
    customer: 'James Doe',
    zone: 'Business Bay',
    provider: 'Mike T.',
    providerPhoto: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg',
    status: 'Dispute',
    statusTone: 'red',
    action: 'Review',
  },
]

const topProviders = [
  {
    name: 'Sarah M.',
    jobs: 42,
    rating: 4.9,
    earned: 'AED 4.2k',
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg',
    champion: true,
  },
  {
    name: 'John D.',
    jobs: 38,
    rating: 4.8,
    earned: 'AED 3.8k',
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg',
  },
  {
    name: 'Mike R.',
    jobs: 31,
    rating: 4.7,
    earned: 'AED 2.9k',
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg',
  },
]

export function CompanyDashboardPage() {
  return (
    <div className="company-dashboard">
      <div className="company-info-banner">
        <div className="company-info-left">
          <div className="company-info-icon">
            <FaCircleInfo />
          </div>
          <div>
            <h4>System Update: New Scheduling Features</h4>
            <p>
              We updated the calendar view to support drag-and-drop rescheduling.{' '}
              <a href="#">Learn more</a>
            </p>
          </div>
        </div>
      </div>

      <section className="company-kpi-grid">
        <article className="company-kpi-card">
          <div className="company-kpi-bg-icon">
            <FaClipboardCheck />
          </div>
          <div className="company-kpi-head">
            <div className="company-kpi-icon purple">
              <FaBoxesStacked />
            </div>
            <span className="company-kpi-trend up">
              <FaArrowTrendUp /> +12%
            </span>
          </div>
          <h3>Today&apos;s Orders</h3>
          <div className="company-kpi-value-wrap">
            <strong>142</strong>
            <span>vs 126 yesterday</span>
          </div>
          <div className="company-kpi-progress">
            <span style={{ width: '75%' }} />
          </div>
          <div className="company-kpi-foot">
            <span>Pending: 12</span>
            <span>Completed: 85</span>
          </div>
        </article>

        <article className="company-kpi-card">
          <div className="company-kpi-bg-icon">
            <FaUserGroup />
          </div>
          <div className="company-kpi-head">
            <div className="company-kpi-icon blue">
              <FaUserGroup />
            </div>
            <span className="company-kpi-cap">45/50 Cap</span>
          </div>
          <h3>Active Providers</h3>
          <div className="company-kpi-value-wrap">
            <strong>38</strong>
            <span>Online now</span>
          </div>
          <div className="company-avatar-stack">
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" alt="" />
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" alt="" />
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-4.jpg" alt="" />
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" alt="" />
            <span>+34</span>
          </div>
        </article>

        <article className="company-kpi-card">
          <div className="company-kpi-bg-icon">
            <FaCoins />
          </div>
          <div className="company-kpi-head">
            <div className="company-kpi-icon green">
              <FaSackDollar />
            </div>
            <span className="company-kpi-trend up">
              <FaArrowTrendUp /> +8.4%
            </span>
          </div>
          <h3>Total Revenue (Today)</h3>
          <div className="company-kpi-value-wrap">
            <strong>AED 12,450</strong>
          </div>
          <div className="company-kpi-mini-grid">
            <div>
              <small>Services</small>
              <span>9,200</span>
            </div>
            <div>
              <small>Products</small>
              <span>3,250</span>
            </div>
          </div>
        </article>
      </section>

      <section className="company-quick-actions">
        <button>
          <span className="quick-icon purple">
            <FaPlus />
          </span>
          <h4>Create Service</h4>
          <p>Add new offering</p>
        </button>
        <button>
          <span className="quick-icon blue">
            <FaEnvelope />
          </span>
          <h4>Invite Provider</h4>
          <p>Send email invite</p>
        </button>
        <button>
          <span className="quick-icon orange">
            <FaTriangleExclamation />
          </span>
          <h4>Review Disputes</h4>
          <p>3 pending reviews</p>
        </button>
        <button>
          <span className="quick-icon green">
            <FaFileExport />
          </span>
          <h4>Export Report</h4>
          <p>Download CSV</p>
        </button>
      </section>

      <section className="company-main-grid">
        <div className="company-left-column">
          <article className="company-card">
            <div className="company-card-head">
              <div>
                <h3>Live Orders</h3>
                <p>Real-time status of ongoing services</p>
              </div>
              <div className="company-card-actions">
                <button>
                  <FaFilter /> Filter
                </button>
                <button className="purple-soft">View All</button>
              </div>
            </div>

            <div className="company-orders-table-wrap">
              <table className="company-orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Service & Customer</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {liveOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div className="order-id">{o.id}</div>
                        <div className="order-time">{o.time}</div>
                      </td>
                      <td>
                        <div className="service-cell">
                          <div className="service-icon">
                            <FaClipboardCheck />
                          </div>
                          <div>
                            <div className="service-name">{o.service}</div>
                            <div className="service-meta">
                              {o.customer} • {o.zone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {o.providerPhoto ? (
                          <div className="provider-cell">
                            <img src={o.providerPhoto} alt={o.provider} />
                            <span>{o.provider}</span>
                          </div>
                        ) : (
                          <div className="provider-cell">
                            <span className="provider-fallback">UN</span>
                            <span className="provider-empty">Unassigned</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${o.statusTone.toLowerCase()}`}>{o.status}</span>
                      </td>
                      <td className="right">
                        {o.action === 'More' ? (
                          <button className="icon-btn">
                            <FaEllipsisVertical />
                          </button>
                        ) : (
                          <button className="assign-btn">{o.action}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="company-card-footer">
              <button>
                View all 142 orders <FaArrowRight />
              </button>
            </div>
          </article>

          <article className="company-card chart-card">
            <div className="company-card-head">
              <div>
                <h3>Revenue Trends</h3>
                <p>Daily earnings over the last 7 days</p>
              </div>
            </div>
            <div className="company-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7621C2" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#7621C2" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `AED ${v}`}
                  />
                  <Tooltip formatter={(v) => [`AED ${String(v ?? 0)}`, 'Revenue']} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#7621C2"
                    strokeWidth={3}
                    fill="url(#revenueFill)"
                    dot={{ r: 4, fill: '#7621C2', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  >
                    {revenueData.map((entry) => (
                      <Cell key={entry.day} />
                    ))}
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>

        <div className="company-right-column">
          <article className="company-card">
            <div className="company-card-head compact">
              <h3>Top Providers</h3>
              <button className="link-btn">View All</button>
            </div>
            <div className="provider-ranking-list">
              {topProviders.map((p) => (
                <div key={p.name} className="provider-ranking-item">
                  <div className="provider-main">
                    <div className="provider-avatar-wrap">
                      <img src={p.avatar} alt={p.name} />
                      {p.champion ? (
                        <span className="medal-dot">
                          <FaMedal />
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <div className="provider-name">{p.name}</div>
                      <div className="provider-meta">
                        {p.jobs} Jobs • {p.rating} <FaStar />
                      </div>
                    </div>
                  </div>
                  <div className="provider-earnings">
                    <strong>{p.earned}</strong>
                    <small>Earned</small>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="company-card">
            <div className="company-card-head compact">
              <h3>Notifications</h3>
              <button className="link-btn">Mark all read</button>
            </div>
            <div className="notice-list">
              <div className="notice-item active">
                <span className="notice-dot red" />
                <div>
                  <h4>Urgent: Dispute Raised</h4>
                  <p>Customer filed a complaint for order #ORD-8285 regarding service quality.</p>
                  <small>10 mins ago</small>
                </div>
              </div>
              <div className="notice-item">
                <span className="notice-dot blue" />
                <div>
                  <h4>New Provider Application</h4>
                  <p>Ahmed K. has completed onboarding.</p>
                  <small>2 hours ago</small>
                </div>
              </div>
              <div className="notice-item">
                <span className="notice-dot gray" />
                <div>
                  <h4>Weekly Summary Ready</h4>
                  <p>Your performance report for last week is available.</p>
                  <small>Yesterday</small>
                </div>
              </div>
            </div>
          </article>

          <article className="company-upgrade-card">
            <div className="upgrade-watermark">
              <FaCircleExclamation />
            </div>
            <span className="upgrade-pill">Growth Plan</span>
            <h3>Upgrade to Pro</h3>
            <p>Unlock advanced analytics and unlimited provider seats.</p>
            <button>View Plans</button>
          </article>
        </div>
      </section>

      <footer className="company-dashboard-footer">
        <span>© 2024 HireWise Inc. All rights reserved.</span>
        <div>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Help Center</a>
        </div>
      </footer>
    </div>
  )
}
