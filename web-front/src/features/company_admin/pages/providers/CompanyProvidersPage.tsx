import { useState } from "react";
import {
  FaArrowTrendUp,
  FaAward,
  FaBan,
  FaBars,
  FaBriefcase,
  FaCalendar,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaCircleQuestion,
  FaEllipsisVertical,
  FaEnvelope,
  FaFilter,
  FaLayerGroup,
  FaLocationDot,
  FaMagnifyingGlass,
  FaPhone,
  FaPlus,
  FaStar,
  FaUserClock,
  FaUsers,
  FaXmark,
} from "react-icons/fa6";
import "./CompanyProvidersPage.css";

type ProviderRow = {
  id: string;
  name: string;
  branch: string;
  avatar: string;
  statusTone: "green" | "blue" | "gray" | "yellow" | "red";
  statusLabel: string;
  services: string[];
  extraServices?: number;
  rating: number;
  reviews: string;
  suspended?: boolean;
};

const PROVIDERS: ProviderRow[] = [
  {
    id: "#PRV-8832",
    name: "Sarah Mitchell",
    branch: "Dubai Branch",
    avatar:
      "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg",
    statusTone: "green",
    statusLabel: "Active",
    services: ["Deep Cleaning", "Sanitization"],
    extraServices: 2,
    rating: 4.9,
    reviews: "124 reviews",
  },
  {
    id: "#PRV-8845",
    name: "David Chen",
    branch: "Downtown Branch",
    avatar:
      "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg",
    statusTone: "blue",
    statusLabel: "Active",
    services: ["AC Repair", "Maintenance"],
    rating: 4.7,
    reviews: "89 reviews",
  },
  {
    id: "#PRV-8721",
    name: "Marcus Johnson",
    branch: "Jumeirah Branch",
    avatar:
      "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-4.jpg",
    statusTone: "gray",
    statusLabel: "Active",
    services: ["Plumbing"],
    rating: 4.5,
    reviews: "42 reviews",
  },
  {
    id: "#PRV-8901",
    name: "Elena Rodriguez",
    branch: "Marina Branch",
    avatar:
      "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg",
    statusTone: "yellow",
    statusLabel: "Active",
    services: ["Beauty", "Hair"],
    extraServices: 1,
    rating: 5.0,
    reviews: "15 reviews",
  },
  {
    id: "#PRV-9012",
    name: "James Wilson",
    branch: "Dubai Branch",
    avatar:
      "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg",
    statusTone: "red",
    statusLabel: "Suspended",
    services: ["Moving"],
    rating: 2.1,
    reviews: "Disputes",

    suspended: true,
  },
];

export function CompanyProvidersPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="cp-root">
      {/* Stats row */}
      <div className="cp-stats-grid">
        <article className="cp-stat-card cp-stat-hover-blue">
          <div>
            <p>Total Providers</p>
            <h3>52</h3>
            <span className="cp-trend-up">
              <FaArrowTrendUp /> +4 this month
            </span>
          </div>
          <div className="cp-stat-icon blue">
            <FaUsers />
          </div>
        </article>

        <article className="cp-stat-card cp-stat-hover-green">
          <div>
            <p>Currently Active</p>
            <h3>38</h3>
            <span className="cp-sub-text">73% utilization rate</span>
          </div>
          <div className="cp-stat-icon green">
            <FaBriefcase />
          </div>
        </article>

        <article className="cp-stat-card cp-stat-hover-yellow">
          <div>
            <p>Avg. Rating</p>
            <h3>4.8</h3>
            <span className="cp-trend-yellow">
              <FaStar /> Top tier quality
            </span>
          </div>
          <div className="cp-stat-icon yellow">
            <FaAward />
          </div>
        </article>

        <article className="cp-stat-card cp-stat-hover-purple">
          <div>
            <p>Pending Invitations</p>
            <h3>3</h3>
            <span className="cp-link-text">Review invitations</span>
          </div>
          <div className="cp-stat-icon purple">
            <FaUserClock />
          </div>
        </article>
      </div>

      {/* Toolbar */}
      <div className="cp-toolbar">
        <div className="cp-toolbar-left">
          <div className="cp-search-wrap">
            <FaMagnifyingGlass className="cp-search-icon" />
            <input
              type="text"
              placeholder="Search by name, ID, or service..."
            />
          </div>
          <button className="cp-btn-ghost">
            <FaFilter /> Filters
          </button>
        </div>
        <div className="cp-toolbar-right">
          <button className="cp-btn-primary" onClick={() => setModalOpen(true)}>
            <FaPlus /> Invite Provider
          </button>
        </div>
      </div>

      {/* Active filters */}
      <div className="cp-filters-row">
        <span className="cp-filters-label">Active Filters:</span>
        <span className="cp-filter-tag purple">
          Status: Active{" "}
          <button>
            <FaXmark />
          </button>
        </span>
        <span className="cp-filter-tag gray">
          City: Sousse{" "}
          <button>
            <FaXmark />
          </button>
        </span>
        <button className="cp-clear-filters">Clear all</button>
      </div>

      {/* Table */}
      <div className="cp-table-card">
        <div className="cp-table-scroll">
          <table className="cp-table">
            <thead>
              <tr>
                <th className="cp-th-check">
                  <input type="checkbox" />
                </th>
                <th>Provider Details</th>
                <th>Status</th>
                <th>Assigned Services</th>
                <th>Rating</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p) => (
                <tr
                  key={p.id}
                  className={`cp-tr ${p.suspended ? "suspended" : ""}`}
                  onClick={() => setDrawerOpen(true)}
                >
                  <td
                    className="cp-td-check"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input type="checkbox" />
                  </td>

                  <td>
                    <div className="cp-provider-cell">
                      <div className="cp-avatar-wrap">
                        <img
                          src={p.avatar}
                          alt={p.name}
                          className={p.suspended ? "grayscale" : ""}
                        />
                        <span className={`cp-online-dot ${p.statusTone}`} />
                      </div>
                      <div>
                        <div
                          className={`cp-provider-name ${p.suspended ? "muted" : ""}`}
                        >
                          {p.name}
                        </div>
                        {p.suspended ? (
                          <div className="cp-provider-sub red">Suspended</div>
                        ) : (
                          <div className="cp-provider-sub">
                            {p.id} • {p.branch}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className={`cp-status-pill ${p.statusTone}`}>
                      {p.statusTone === "red" ? (
                        <FaBan className="cp-pill-icon" />
                      ) : (
                        <span className={`cp-dot ${p.statusTone}`} />
                      )}
                      {p.statusLabel}
                    </span>
                  </td>

                  <td>
                    <div className="cp-services-cell">
                      {p.services.map((s) => (
                        <span
                          key={s}
                          className={`cp-service-tag ${p.suspended ? "struck" : ""}`}
                        >
                          {s}
                        </span>
                      ))}
                      {p.extraServices ? (
                        <span className="cp-service-tag extra">
                          +{p.extraServices}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td>
                    <div className="cp-rating-cell">
                      <FaStar className={p.suspended ? "star-muted" : "star"} />
                      <span
                        className={`cp-rating-val ${p.suspended ? "muted" : ""}`}
                      >
                        {p.rating}
                      </span>
                      <span className="cp-rating-sub">({p.reviews})</span>
                    </div>
                  </td>

                  <td className="right" onClick={(e) => e.stopPropagation()}>
                    {p.suspended ? (
                      ""
                    ) : (
                      <div className="cp-row-actions">
                        <button title="View Schedule">
                          <FaCalendar />
                        </button>
                        <button title="More">
                          <FaEllipsisVertical />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="cp-pagination">
          <span>
            Showing <strong>1–5</strong> of <strong>52</strong> providers
          </span>
          <div className="cp-page-btns">
            <button disabled>
              <FaChevronLeft />
            </button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <span>…</span>
            <button>12</button>
            <button>
              <FaChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="cp-footer">
        <span>© 2026 ServeMe Inc. All rights reserved.</span>
        <div>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Help Center</a>
        </div>
      </footer>

      {/* Provider Details Drawer */}
      {drawerOpen ? (
        <>
          <div
            className="cp-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="cp-drawer">
            <div className="cp-drawer-header">
              <h2>Provider Details</h2>
              <div className="cp-drawer-head-actions">
                <button title="Edit">
                  <FaBars />
                </button>
                <button onClick={() => setDrawerOpen(false)} title="Close">
                  <FaXmark />
                </button>
              </div>
            </div>

            <div className="cp-drawer-body">
              <div className="cp-drawer-profile">
                <div className="cp-drawer-avatar-wrap">
                  <img
                    src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg"
                    alt="Sarah Mitchell"
                  />
                  <span className="cp-drawer-online">
                    <FaCheck />
                  </span>
                </div>
                <div>
                  <h3>Sarah Mitchell</h3>
                  <p>ID: #PRV-8832</p>
                  <div className="cp-drawer-tags">
                    <span className="cp-drawer-tag green">Active</span>
                    <span className="cp-drawer-tag gray">
                      <FaLocationDot /> Dubai HQ
                    </span>
                  </div>
                </div>
              </div>

              <div className="cp-drawer-quick-stats">
                <div>
                  <small>Rating</small>
                  <strong>
                    4.9 <FaStar className="star-yellow" />
                  </strong>
                </div>
                <div>
                  <small>Jobs Done</small>
                  <strong>124</strong>
                </div>
                <div>
                  <small>Joined</small>
                  <strong>Oct '23</strong>
                </div>
              </div>

              <div className="cp-drawer-section">
                <h4>Contact Information</h4>
                <div className="cp-contact-item">
                  <span className="cp-contact-icon">
                    <FaPhone />
                  </span>
                  <div>
                    <small>Phone Number</small>
                    <span>+971 50 123 4567</span>
                  </div>
                  <button className="cp-contact-action">Call</button>
                </div>
                <div className="cp-contact-item">
                  <span className="cp-contact-icon">
                    <FaEnvelope />
                  </span>
                  <div>
                    <small>Email Address</small>
                    <span>sarah.m@hirewise.com</span>
                  </div>
                  <button className="cp-contact-action">Email</button>
                </div>
              </div>

              <div className="cp-drawer-section">
                <div className="cp-section-head">
                  <h4>Assigned Services</h4>
                  <button className="cp-contact-action">Edit</button>
                </div>
                <div className="cp-service-pills">
                  <span>
                    <span className="dot purple" />
                    Deep Cleaning
                  </span>
                  <span>
                    <span className="dot blue" />
                    Sanitization
                  </span>
                  <span>
                    <span className="dot green" />
                    Upholstery
                  </span>
                </div>
              </div>

              <div className="cp-drawer-section">
                <h4>Recent Activity</h4>
                <div className="cp-timeline">
                  <div className="cp-timeline-item">
                    <span className="cp-timeline-dot green" />
                    <div>
                      <p>Completed Order #ORD-8291</p>
                      <small>Deep Cleaning • Jumeirah 1</small>
                      <time>Today, 10:42 AM</time>
                    </div>
                  </div>
                  <div className="cp-timeline-item">
                    <span className="cp-timeline-dot blue" />
                    <div>
                      <p>Clocked In</p>
                      <small>Mobile App • Location Verified</small>
                      <time>Today, 08:00 AM</time>
                    </div>
                  </div>
                  <div className="cp-timeline-item">
                    <span className="cp-timeline-dot gray" />
                    <div>
                      <p>Updated Availability</p>
                      <small>Set to "Available" for next week</small>
                      <time>Yesterday, 06:30 PM</time>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="cp-drawer-footer">
              <button className="cp-btn-suspend">Withdraw Provider</button>
              <button className="cp-btn-primary">View Full Profile</button>
            </div>
          </aside>
        </>
      ) : null}

      {/* Invite Provider Modal */}
      {modalOpen ? (
        <div className="cp-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-header">
              <h3>Invite New Provider</h3>
              <button onClick={() => setModalOpen(false)}>
                <FaXmark />
              </button>
            </div>
            <div className="cp-modal-body">
              <div className="cp-form-group">
                <label>Email Address</label>
                <input type="email" placeholder="john.doe@example.com" />
              </div>
            </div>
            <div className="cp-modal-footer">
              <button
                className="cp-btn-ghost"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button className="cp-btn-primary">Send Invitation</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
