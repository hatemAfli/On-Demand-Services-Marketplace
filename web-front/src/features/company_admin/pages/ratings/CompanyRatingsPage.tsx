import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  FaArrowTrendUp,
  FaBroom,
  FaCircleQuestion,
  FaCommentDots,
  FaFilter,
  FaHandHoldingDollar,
  FaHeart,
  FaMagnifyingGlass,
  FaMedal,
  FaPaperPlane,
  FaRotateLeft,
  FaStar,
  FaTriangleExclamation,
} from 'react-icons/fa6'
import { FaRegClock, FaRegCalendar, FaRegStar } from 'react-icons/fa'
import './CompanyRatingsPage.css'

const trendData = [
  { week: 'Week 1', rating: 4.2 },
  { week: 'Week 2', rating: 4.3 },
  { week: 'Week 3', rating: 4.5 },
  { week: 'Week 4', rating: 4.4 },
  { week: 'Week 5', rating: 4.7 },
  { week: 'Week 6', rating: 4.8 },
]

const serviceData = [
  { service: 'Cleaning',   rating: 4.8, color: '#10B981' },
  { service: 'Plumbing',   rating: 4.5, color: '#7621C2' },
  { service: 'Electrical', rating: 4.2, color: '#3B82F6' },
  { service: 'Moving',     rating: 4.6, color: '#F59E0B' },
  { service: 'Painting',   rating: 3.9, color: '#EF4444' },
]

const sentimentTags = [
  { icon: <FaMedal className="rr-icon yellow" />, label: 'Professionalism', pct: 92, color: '#FACC15' },
  { icon: <FaRegClock className="rr-icon blue" />, label: 'Punctuality',     pct: 88, color: '#3B82F6' },
  { icon: <FaBroom className="rr-icon green" />,  label: 'Service Quality', pct: 95, color: '#22C55E' },
  { icon: <FaHandHoldingDollar className="rr-icon purple" />, label: 'Value for Money', pct: 78, color: '#A855F7' },
]

type Review = {
  id: string
  initials: string
  name: string
  ago: string
  order: string
  stars: number
  text: string
  tags: string[]
  providerAvatar?: string
  providerName?: string
  negative?: boolean
  unassigned?: boolean
  bgColor: string
  textColor: string
}

const REVIEWS: Review[] = [
  {
    id: 'r1', initials: 'SJ', name: 'Sarah Jenkins',       ago: '2 hours ago',  order: '#ORD-9921',
    stars: 5,
    text: '"Absolutely fantastic service! The technician arrived exactly on time and fixed the issue within 30 minutes. Very professional and clean work."',
    tags: ['Punctuality', 'Professionalism'],
    providerAvatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg',
    providerName: 'David Chen',
    bgColor: '#dbeafe', textColor: '#2563eb',
  },
  {
    id: 'r2', initials: 'MK', name: 'Mohammed Khalil',    ago: 'Yesterday',    order: '#ORD-8823',
    stars: 4,
    text: '"Good cleaning overall but missed a few spots in the kitchen. The team was polite though."',
    tags: ['Quality'],
    providerAvatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg',
    providerName: 'Emma Wilson',
    bgColor: '#dcfce7', textColor: '#16a34a',
  },
  {
    id: 'r3', initials: 'AL', name: 'Amanda Lee',         ago: '2 days ago',   order: '#ORD-7712',
    stars: 1,
    text: '"Provider arrived 45 minutes late without calling. This is unacceptable for a premium service."',
    tags: ['Punctuality Issue'],
    negative: true, unassigned: true,
    bgColor: '#fee2e2', textColor: '#dc2626',
  },
  {
    id: 'r4', initials: 'RA', name: 'Rashed Al-Maktoum', ago: '3 days ago',   order: '#ORD-6621',
    stars: 5,
    text: '"Excellent job fixing the AC unit. Very knowledgeable technician."',
    tags: ['Expertise'],
    providerAvatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg',
    providerName: 'Ahmed Khan',
    bgColor: '#f3e8ff', textColor: '#7621c2',
  },
]

const TOP_PROVIDERS = [
  { name: 'David Chen',   id: '#PRV-8821', service: 'Plumbing',    rating: 5.0, jobs: 42, badge: 'Top Rated',   badgeCls: 'green',  avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg' },
  { name: 'Emma Wilson',  id: '#PRV-5543', service: 'Cleaning',    rating: 4.9, jobs: 65, badge: 'Consistent',  badgeCls: 'blue',   avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg' },
  { name: 'Ahmed Khan',   id: '#PRV-7721', service: 'Electrical',  rating: 4.8, jobs: 38, badge: 'Rising Star', badgeCls: 'purple', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg' },
]

function StarRow({ count, total = 5, color = '#FACC15' }: { count: number; total?: number; color?: string }) {
  return (
    <div className="rr-stars">
      {Array.from({ length: total }).map((_, i) => (
        i < count
          ? <FaStar key={i} style={{ color }} />
          : <FaRegStar key={i} style={{ color: '#d1d5db' }} />
      ))}
    </div>
  )
}

export function CompanyRatingsPage() {
  const [selectedService, setSelectedService] = useState('all')
  const [drilldownActive, setDrilldownActive] = useState(false)

  const handleBarClick = (data: { activePayload?: { payload: { service: string } }[] }) => {
    if (data?.activePayload?.[0]) {
      setSelectedService(data.activePayload[0].payload.service.toLowerCase())
      setDrilldownActive(true)
    }
  }

  const resetDrilldown = () => { setSelectedService('all'); setDrilldownActive(false) }

  return (
    <div className="rr-root">
      {/* KPI cards */}
      <div className="rr-kpi-grid">
        {/* Overall rating */}
        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <div>
              <p>Overall Rating</p>
              <div className="rr-kpi-val-row">
                <h3>4.8</h3>
                <span className="rr-kpi-sub">/ 5.0</span>
              </div>
            </div>
            <div className="rr-kpi-icon yellow"><FaStar /></div>
          </div>
          <StarRow count={5} />
          <div className="rr-kpi-trend">
            <span className="rr-badge green"><FaArrowTrendUp /> +0.2</span>
            <span className="rr-muted">vs last month</span>
          </div>
        </div>

        {/* NPS */}
        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <div>
              <p>Net Promoter Score</p>
              <h3>72</h3>
            </div>
            <div className="rr-kpi-icon purple"><FaHeart /></div>
          </div>
          <div className="rr-nps-bar-track">
            <div className="rr-nps-bar-fill" style={{ width: '72%' }} />
          </div>
          <div className="rr-kpi-trend">
            <span className="rr-badge green"><FaArrowTrendUp /> +5 pts</span>
            <span className="rr-muted">Excellent range</span>
          </div>
        </div>

        {/* Response rate */}
        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <div>
              <p>Response Rate</p>
              <h3>94%</h3>
            </div>
            <div className="rr-kpi-icon blue"><FaCommentDots /></div>
          </div>
          <div className="rr-avatar-row">
            {[
              'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg',
              'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg',
              'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg',
            ].map((src) => <img key={src} src={src} alt="" />)}
            <span>Support team active</span>
          </div>
          <p className="rr-response-time">Avg. time: <strong>2h 15m</strong></p>
        </div>

        {/* Critical issues */}
        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <div>
              <p>Critical Issues</p>
              <h3>3</h3>
            </div>
            <div className="rr-kpi-icon red"><FaTriangleExclamation /></div>
          </div>
          <div className="rr-issues-list">
            <div><span>Unresolved</span><strong className="red">2</strong></div>
            <div><span>Escalated</span><strong className="orange">1</strong></div>
          </div>
          <button className="rr-view-alerts-btn">View Alerts</button>
        </div>
      </div>

      {/* Main grid */}
      <div className="rr-main-grid">
        {/* Left column */}
        <div className="rr-left-col">
          {/* Trend chart */}
          <div className="rr-chart-card">
            <div className="rr-chart-head">
              <div>
                <h3>Rating Trends</h3>
                <p>Average customer rating over time</p>
              </div>
              <div className="rr-toggle-group">
                <button className="active">Weekly</button>
                <button>Monthly</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[3.5, 5]} ticks={[3.5, 4.0, 4.5, 5.0]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={(v: number) => [v.toFixed(1), 'Avg Rating']}
                />
                <Line
                  type="monotone"
                  dataKey="rating"
                  stroke="#7621C2"
                  strokeWidth={3}
                  dot={{ fill: '#fff', stroke: '#7621C2', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sentiment + Drill-down */}
          <div className="rr-mid-grid">
            {/* Sentiment */}
            <div className="rr-panel">
              <h3>Sentiment Analysis</h3>
              <p>Breakdown of customer feedback tags</p>
              <div className="rr-sentiment-list">
                {sentimentTags.map((t) => (
                  <div key={t.label} className="rr-sentiment-item">
                    <div className="rr-sentiment-head">
                      <span>{t.icon} {t.label}</span>
                      <span>{t.pct}% Positive</span>
                    </div>
                    <div className="rr-bar-track">
                      <div className="rr-bar-fill" style={{ width: `${t.pct}%`, background: t.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drill-down bar chart */}
            <div className="rr-panel">
              <div className="rr-panel-head">
                <div>
                  <h3>Quality Drill-Down</h3>
                  <p>Click bars to filter by category</p>
                </div>
                {drilldownActive ? (
                  <button className="rr-reset-btn" onClick={resetDrilldown}>
                    <FaRotateLeft /> Reset
                  </button>
                ) : null}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={serviceData}
                  margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
                  barCategoryGap="40%"
                  onClick={handleBarClick}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="service" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 11 }}
                    formatter={(v: number) => [v.toFixed(1), 'Rating']}
                    cursor={{ fill: 'rgba(118,33,194,0.04)' }}
                  />
                  <Bar dataKey="rating" radius={[6, 6, 0, 0]} cursor="pointer">
                    {serviceData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.color}
                        opacity={drilldownActive && entry.service.toLowerCase() !== selectedService ? 0.35 : 0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Providers table */}
          <div className="rr-table-card">
            <div className="rr-table-head">
              <div>
                <h3>Top Providers</h3>
                <p>Highest rated staff this month</p>
              </div>
              <button className="rr-view-all-btn">View All Providers</button>
            </div>
            <div className="rr-table-scroll">
              <table className="rr-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Service</th>
                    <th>Rating</th>
                    <th className="right">Jobs</th>
                    <th className="right">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {TOP_PROVIDERS.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="rr-prov-cell">
                          <img src={p.avatar} alt={p.name} />
                          <div>
                            <strong>{p.name}</strong>
                            <small>{p.id}</small>
                          </div>
                        </div>
                      </td>
                      <td className="rr-service-col">{p.service}</td>
                      <td>
                        <span className="rr-rating-cell">
                          <FaStar className="rr-star-yellow" /> {p.rating.toFixed(1)}
                        </span>
                      </td>
                      <td className="right rr-jobs-col">{p.jobs}</td>
                      <td className="right">
                        <span className={`rr-perf-badge ${p.badgeCls}`}>{p.badge}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: Live Feedback */}
        <div className="rr-feedback-card">
          <div className="rr-feedback-head">
            <div>
              <h3>Live Feedback</h3>
              <p>Real-time customer reviews</p>
            </div>
            <button className="rr-filter-btn"><FaFilter /></button>
          </div>

          <div className="rr-feedback-list">
            {REVIEWS.map((r) => (
              <div key={r.id} className={`rr-review-item${r.negative ? ' negative' : ''}`}>
                <div className="rr-review-top">
                  <div className="rr-reviewer">
                    <span className="rr-initials" style={{ background: r.bgColor, color: r.textColor }}>{r.initials}</span>
                    <div>
                      <strong>{r.name}</strong>
                      <small>{r.ago} • Order {r.order}</small>
                    </div>
                  </div>
                  <StarRow count={r.stars} color={r.negative ? '#ef4444' : '#FACC15'} />
                </div>

                <p className="rr-review-text">{r.text}</p>

                <div className="rr-tags">
                  {r.tags.map((t) => (
                    <span key={t} className={`rr-tag${r.negative ? ' red' : ''}`}>{t}</span>
                  ))}
                </div>

                <div className="rr-review-footer">
                  <div className="rr-prov-row">
                    {r.unassigned ? (
                      <>
                        <span className="rr-unknown-dot"><FaCircleQuestion /></span>
                        <span>Unassigned</span>
                      </>
                    ) : (
                      <>
                        <img src={r.providerAvatar} alt={r.providerName} />
                        <span>Service by {r.providerName}</span>
                      </>
                    )}
                  </div>
                  {r.negative ? (
                    <div className="rr-neg-actions">
                      <button className="rr-details-btn">Details</button>
                      <button className="rr-escalate-btn">Escalate</button>
                    </div>
                  ) : (
                    <button className="rr-respond-btn">Respond</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rr-feedback-footer">
            <button>View All Reviews →</button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="rr-footer">
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
