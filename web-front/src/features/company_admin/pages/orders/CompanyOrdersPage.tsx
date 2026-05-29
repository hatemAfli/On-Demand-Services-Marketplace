import { useState } from 'react'
import {
  FaArrowUp,
  FaChartLine,
  FaChevronLeft,
  FaChevronRight,
  FaCircleExclamation,
  FaClipboardList,
  FaCoins,
  FaDownload,
  FaEllipsisVertical,
  FaGears,
  FaLocationDot,
  FaMagnifyingGlass,
  FaPlus,
  FaPrint,
  FaRotate,
  FaShareNodes,
  FaSliders,
  FaTriangleExclamation,
  FaXmark,
} from 'react-icons/fa6'
import { FaRegCalendar, FaRegClock, FaCheck } from 'react-icons/fa'
import './CompanyOrdersPage.css'

type OrderStatus = 'active' | 'pending' | 'completed' | 'dispute' | 'cancelled'

type Order = {
  id: string
  date: string
  time: string
  customer: { name: string; initials?: string; avatar?: string; color: string }
  service: string
  serviceDetail?: string
  provider: { name: string; avatar?: string } | null
  status: OrderStatus
  amount: number
  highlight?: 'red' | 'purple'
}

const ORDERS: Order[] = [
  {
    id: 'ORD-2489',
    date: 'Oct 24, 2024',
    time: '10:00 AM',
    customer: { name: 'John Doe', initials: 'JD', color: '#bfdbfe|#2563eb' },
    service: 'Deep Cleaning',
    provider: { name: 'Sarah M.', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg' },
    status: 'active',
    amount: 250,
  },
  {
    id: 'ORD-2488',
    date: 'Oct 24, 2024',
    time: '09:00 AM',
    customer: { name: 'Emma Wilson', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg', color: '' },
    service: 'AC Maintenance',
    serviceDetail: 'Maintenance • 1 hr',
    provider: null,
    status: 'pending',
    amount: 180,
    highlight: 'red',
  },
  {
    id: 'ORD-2487',
    date: 'Oct 23, 2024',
    time: '02:00 PM',
    customer: { name: 'Ahmed Khan', initials: 'AK', color: '#e9d5ff|#9333ea' },
    service: 'Sofa Shampooing',
    serviceDetail: 'Cleaning • 2 hrs',
    provider: { name: 'David Chen', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg' },
    status: 'completed',
    amount: 350,
  },
  {
    id: 'ORD-2486',
    date: 'Oct 23, 2024',
    time: '11:00 AM',
    customer: { name: 'Lisa Wong', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg', color: '' },
    service: 'Relaxing Massage',
    serviceDetail: 'Beauty & Spa • 1 hr',
    provider: { name: 'Elena Rodriguez', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg' },
    status: 'dispute',
    amount: 300,
    highlight: 'purple',
  },
  {
    id: 'ORD-2485',
    date: 'Oct 22, 2024',
    time: '09:00 AM',
    customer: { name: 'Mark Roberts', initials: 'MR', color: '#bbf7d0|#16a34a' },
    service: 'Deep Home Cleaning',
    serviceDetail: 'Residential • 2 hrs',
    provider: { name: 'Sarah Mitchell', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg' },
    status: 'cancelled',
    amount: 250,
  },
]

const STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string }> = {
  active:    { label: 'Active',     cls: 'co-status-active'    },
  pending:   { label: 'Pending',    cls: 'co-status-pending'   },
  completed: { label: 'Completed',  cls: 'co-status-completed' },
  dispute:   { label: 'Dispute',    cls: 'co-status-dispute'   },
  cancelled: { label: 'Cancelled',  cls: 'co-status-cancelled' },
}

export function CompanyOrdersPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reassignOpen, setReassignOpen] = useState(false)

  const selectedOrder = ORDERS.find((o) => o.id === selectedId) ?? null

  return (
    <div className="co-root">
      {/* Stats */}
      <div className="co-stats-grid">
        <article className="co-stat-card co-hover-purple">
          <div>
            <p>Today's Orders</p>
            <h3>45</h3>
            <span className="co-trend-green"><FaArrowUp /> 12% vs yesterday</span>
          </div>
          <div className="co-stat-icon purple"><FaClipboardList /></div>
        </article>

        <article className="co-stat-card co-hover-yellow">
          <div>
            <p>Pending Assignment</p>
            <h3>8</h3>
            <span className="co-trend-yellow">Requires attention</span>
          </div>
          <div className="co-stat-icon yellow"><FaRegClock /></div>
        </article>

        <article className="co-stat-card co-hover-blue">
          <div>
            <p>In Progress</p>
            <h3>12</h3>
            <span className="co-trend-blue"><FaRotate /> Active now</span>
          </div>
          <div className="co-stat-icon blue"><FaGears /></div>
        </article>

        <article className="co-stat-card co-hover-green">
          <div>
            <p>Revenue (Today)</p>
            <h3>AED 8,450</h3>
            <span className="co-trend-green"><FaChartLine /> On target</span>
          </div>
          <div className="co-stat-icon green"><FaCoins /></div>
        </article>
      </div>

      {/* Table card */}
      <div className="co-table-card">
        {/* Filters */}
        <div className="co-filters">
          <div className="co-filters-left">
            <div className="co-search-wrap">
              <FaMagnifyingGlass className="co-search-icon" />
              <input type="text" placeholder="Search orders..." />
            </div>
            <div className="co-selects">
              {['All Statuses', 'All Providers', 'All Services', 'Dubai HQ'].map((placeholder) => (
                <select key={placeholder}>
                  <option>{placeholder}</option>
                </select>
              ))}
            </div>
          </div>
          <div className="co-filters-right">
            <button title="Export"><FaDownload /></button>
            <button title="Columns"><FaSliders /></button>
          </div>
        </div>

        {/* Table */}
        <div className="co-table-scroll">
          <table className="co-table">
            <thead>
              <tr>
                <th className="co-th-check"><input type="checkbox" /></th>
                <th>Order ID</th>
                <th>Date &amp; Time</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Provider</th>
                <th>Status</th>
                <th className="right">Amount</th>
                <th className="co-th-action"></th>
              </tr>
            </thead>
            <tbody>
              {ORDERS.map((order) => {
                const { label, cls } = STATUS_CONFIG[order.status]
                const [bgColor, textColor] = order.customer.color.split('|')
                return (
                  <tr
                    key={order.id}
                    className={`co-tr${order.highlight ? ` hl-${order.highlight}` : ''}`}
                    onClick={() => setSelectedId(order.id)}
                  >
                    <td className="co-td-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" />
                    </td>

                    <td className="co-td-id">#{order.id}</td>

                    <td className="co-td-date">
                      <div>{order.date}</div>
                      <small>{order.time}</small>
                    </td>

                    <td>
                      <div className="co-customer">
                        {order.customer.avatar ? (
                          <img src={order.customer.avatar} alt={order.customer.name} />
                        ) : (
                          <span
                            className="co-initials"
                            style={{ background: bgColor, color: textColor }}
                          >
                            {order.customer.initials}
                          </span>
                        )}
                        <span>{order.customer.name}</span>
                      </div>
                    </td>

                    <td className="co-td-service">
                      <div>{order.service}</div>
                      {order.serviceDetail ? <small>{order.serviceDetail}</small> : null}
                    </td>

                    <td>
                      {order.provider ? (
                        <div className="co-provider">
                          <img src={order.provider.avatar} alt={order.provider.name} />
                          <span>{order.provider.name}</span>
                        </div>
                      ) : (
                        <div className="co-unassigned">
                          <span className="co-unknown-dot">?</span>
                          <span>Unassigned</span>
                        </div>
                      )}
                    </td>

                    <td>
                      <span className={`co-status-pill ${cls}`}>
                        {order.status !== 'active' ? <span className="co-pill-dot" /> : null}
                        {label}
                      </span>
                    </td>

                    <td className="co-td-amount right">AED {order.amount}</td>

                    <td className="co-td-menu" onClick={(e) => e.stopPropagation()}>
                      <FaEllipsisVertical />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="co-pagination">
          <span>Showing <strong>1–5</strong> of <strong>45</strong> orders</span>
          <div className="co-page-btns">
            <button disabled><FaChevronLeft /></button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <span>…</span>
            <button>9</button>
            <button><FaChevronRight /></button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="co-footer">
        <span>© 2024 HireWise Inc. All rights reserved.</span>
        <div>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Help Center</a>
        </div>
      </footer>

      {/* Order Details Drawer */}
      {selectedId ? (
        <>
          <div className="co-drawer-backdrop" onClick={() => setSelectedId(null)} />
          <aside className="co-drawer">
            {/* Header */}
            <div className="co-drawer-header">
              <div>
                <div className="co-drawer-title-row">
                  <h2>#{selectedId}</h2>
                  {selectedOrder ? (
                    <span className={`co-status-pill ${STATUS_CONFIG[selectedOrder.status].cls}`}>
                      <span className="co-pill-dot" />
                      {STATUS_CONFIG[selectedOrder.status].label}
                    </span>
                  ) : null}
                </div>
                <div className="co-drawer-meta">
                  <span><FaRegCalendar /> Oct 23, 2024</span>
                  <span><FaRegClock /> 11:00 AM – 12:00 PM</span>
                  <span><FaLocationDot /> Business Bay, Dubai</span>
                </div>
              </div>
              <div className="co-drawer-head-actions">
                <button title="Print"><FaPrint /></button>
                <button title="Share"><FaShareNodes /></button>
                <div className="co-divider" />
                <button onClick={() => setSelectedId(null)}><FaXmark /></button>
              </div>
            </div>

            {/* Body */}
            <div className="co-drawer-body">
              {/* Customer + Provider */}
              <div className="co-info-grid">
                <div className="co-info-card">
                  <small>Customer</small>
                  <div className="co-info-person">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg" alt="Lisa Wong" />
                    <div>
                      <strong>Lisa Wong</strong>
                      <span>+971 50 123 4567</span>
                    </div>
                  </div>
                  <div className="co-info-actions">
                    <button>Message</button>
                    <button>Profile</button>
                  </div>
                </div>

                <div className="co-info-card co-provider-card">
                  <div className="co-provider-deco" />
                  <small>Provider</small>
                  <div className="co-info-person">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" alt="Elena Rodriguez" />
                    <div>
                      <strong>Elena Rodriguez</strong>
                      <span className="online"><span className="co-online-dot" /> Online</span>
                    </div>
                  </div>
                  <button
                    className="co-reassign-btn"
                    onClick={() => setReassignOpen(true)}
                  >
                    Reassign Provider
                  </button>
                </div>
              </div>

              {/* Service Details */}
              <div className="co-service-card">
                <div className="co-service-card-head">
                  <span>Service Details</span>
                  <span>Total: AED 300</span>
                </div>
                <div className="co-service-card-body">
                  <div className="co-service-row">
                    <div>
                      <strong>Relaxing Massage</strong>
                      <small>60 mins • Standard</small>
                    </div>
                    <span>AED 300</span>
                  </div>
                  <div className="co-payment-row">
                    <span>Payment Method</span>
                    <span>Visa ending 4242</span>
                  </div>
                </div>
              </div>

              {/* Dispute */}
              <div className="co-dispute-card">
                <div className="co-dispute-title">
                  <FaCircleExclamation className="co-dispute-icon" />
                  <h3>Dispute Raised</h3>
                </div>
                <p>
                  Customer reported provider arrived 30 minutes late and service was rushed.
                  Requesting partial refund.
                </p>
                <div className="co-dispute-actions">
                  <button className="co-dispute-refund">Process Refund</button>
                  <button className="co-dispute-contact">Contact Customer</button>
                </div>
              </div>

              {/* Timeline */}
              <div className="co-timeline-section">
                <h3>Order Timeline</h3>
                <div className="co-timeline">
                  {[
                    { icon: '!', cls: 'purple', time: 'Oct 23, 12:30 PM', title: 'Dispute Opened', note: 'Customer initiated dispute: "Provider late"', noteBox: true },
                    { icon: <FaCheck />, cls: 'green', time: 'Oct 23, 12:00 PM', title: 'Service Completed', note: 'Provider marked service as complete.' },
                    { icon: '▶', cls: 'blue', time: 'Oct 23, 11:30 AM', title: 'Service Started', note: 'Provider arrived at location.' },
                    { icon: '📄', cls: 'gray', time: 'Oct 22, 09:15 AM', title: 'Order Created', note: 'Order placed via Mobile App.', last: true },
                  ].map((item, i) => (
                    <div key={i} className={`co-tl-item${item.last ? ' last' : ''}`}>
                      <div className={`co-tl-dot ${item.cls}`}>
                        {typeof item.icon === 'string' ? item.icon : item.icon}
                      </div>
                      {!item.last ? <div className="co-tl-line" /> : null}
                      <div className="co-tl-content">
                        <time>{item.time}</time>
                        <strong>{item.title}</strong>
                        {item.noteBox ? (
                          <div className="co-tl-note-box">{item.note}</div>
                        ) : (
                          <p>{item.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="co-notes-section">
                <h3>Internal Notes</h3>
                <textarea placeholder="Add internal notes about this order..." />
                <div className="co-notes-footer">
                  <button>Save Note</button>
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}

      {/* Reassign Modal */}
      {reassignOpen ? (
        <div className="co-modal-overlay" onClick={() => setReassignOpen(false)}>
          <div className="co-modal" onClick={(e) => e.stopPropagation()}>
            <div className="co-modal-header">
              <h3>Reassign Provider</h3>
              <button onClick={() => setReassignOpen(false)}><FaXmark /></button>
            </div>
            <div className="co-modal-body">
              <div className="co-warning-banner">
                <FaTriangleExclamation className="co-warning-icon" />
                <div>
                  <strong>Schedule Conflict Warning</strong>
                  <p>Changing provider less than 2 hours before service may result in cancellation fees.</p>
                </div>
              </div>
              <div className="co-form-group">
                <label>Select New Provider</label>
                <div className="co-provider-list">
                  {[
                    { name: 'David Chen', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg', available: true },
                    { name: 'Sarah Mitchell', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg', available: false },
                  ].map((p) => (
                    <div key={p.name} className={`co-provider-option${p.available ? '' : ' unavailable'}`}>
                      <div className="co-prov-left">
                        <img src={p.avatar} alt={p.name} className={p.available ? '' : 'grayscale'} />
                        <div>
                          <span>{p.name}</span>
                          <small className={p.available ? 'avail' : 'busy'}>
                            {p.available ? 'Available' : 'Busy (Another Job)'}
                          </small>
                        </div>
                      </div>
                      {p.available ? (
                        <button className="co-select-btn">Select</button>
                      ) : (
                        <span className="co-unavail-label">Unavailable</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="co-modal-footer">
              <button className="co-btn-ghost" onClick={() => setReassignOpen(false)}>Cancel</button>
              <button className="co-btn-primary">Confirm Reassignment</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
