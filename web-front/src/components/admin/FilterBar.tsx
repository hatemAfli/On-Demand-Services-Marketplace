import './admin-components.css'

export type FilterBarFilter = {
  key: string
  label: string
  type: 'select' | 'date' | 'search'
  options?: { value: string; label: string }[]
}

export type FilterBarProps = {
  filters: FilterBarFilter[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onReset: () => void
}

export function FilterBar({ filters, values, onChange, onReset }: FilterBarProps) {
  return (
    <div className="admin-filter-bar">
      {filters.map((filter) => (
        <div key={filter.key} className="admin-filter-field">
          <label htmlFor={`filter-${filter.key}`}>{filter.label}</label>
          {filter.type === 'select' ? (
            <select
              id={`filter-${filter.key}`}
              value={values[filter.key] ?? ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
            >
              {filter.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : filter.type === 'date' ? (
            <input
              id={`filter-${filter.key}`}
              type="date"
              value={values[filter.key] ?? ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
            />
          ) : (
            <input
              id={`filter-${filter.key}`}
              type="search"
              placeholder="Search…"
              value={values[filter.key] ?? ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
            />
          )}
        </div>
      ))}
      <button type="button" className="admin-filter-reset" onClick={onReset}>
        Reset filters
      </button>
    </div>
  )
}

