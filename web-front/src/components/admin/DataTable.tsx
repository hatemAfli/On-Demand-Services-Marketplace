import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import './admin-components.css'

export type DataTableColumn<T> = {
  key: string
  label: string
  width?: string
  render?: (row: T) => ReactNode
}

export type DataTableProps<T extends { id?: string }> = {
  columns: DataTableColumn<T>[]
  data: T[]
  loading: boolean
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T) => string | undefined
  emptyMessage?: string
}

function SkeletonRows({ colCount }: { colCount: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i} className="admin-data-table__skeleton">
          {Array.from({ length: colCount }).map((_, j) => (
            <td key={j}>
              <div className="admin-data-table__skeleton-bar" style={{ width: j === 0 ? '70%' : '50%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  loading,
  onRowClick,
  getRowClassName,
  emptyMessage = 'No records found',
}: DataTableProps<T>) {
  const clickable = Boolean(onRowClick)

  return (
    <div className="admin-data-table-wrap">
      <table className="admin-data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows colCount={columns.length} />
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="admin-data-table__empty">
                  <div className="admin-data-table__empty-icon" aria-hidden>
                    <Inbox size={32} />
                  </div>
                  <p>{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const rowExtra = getRowClassName?.(row)
              const rowClass = [
                clickable ? 'admin-data-table__row--clickable' : '',
                rowExtra ?? '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
              <tr
                key={row.id ?? index}
                className={rowClass || undefined}
                onClick={clickable ? () => onRowClick?.(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            )})
          )}
        </tbody>
      </table>
    </div>
  )
}
