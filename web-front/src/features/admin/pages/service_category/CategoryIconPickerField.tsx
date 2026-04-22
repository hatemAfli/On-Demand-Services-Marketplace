import { AppstoreOutlined } from '@ant-design/icons'
import { Button, Empty, Input, Modal, Space } from 'antd'
import { createElement, useMemo, useState } from 'react'
import {
  filterCategoryIcons,
  getCategoryFa5Icon,
} from './categoryFa5Icons'
import './CategoryIconPickerField.css'

type Props = {
  value?: string
  onChange?: (v: string | undefined) => void
}

export function CategoryIconPickerField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => filterCategoryIcons(search), [search])
  const SelectedIcon = value ? getCategoryFa5Icon(value) : null

  const closePicker = () => {
    setOpen(false)
    setSearch('')
  }

  return (
    <>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          size="large"
          placeholder="Font Awesome 5 name (e.g. home) or browse"
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange?.(v.trim() ? v.trim() : undefined)
          }}
          prefix={
            SelectedIcon
              ? createElement(SelectedIcon, {
                  className: 'svc-cat-icon-field-prefix',
                  'aria-hidden': true,
                })
              : undefined
          }
          allowClear
          maxLength={80}
        />
        <Button
          size="large"
          type="default"
          icon={<AppstoreOutlined />}
          onClick={() => setOpen(true)}
        >
          Browse
        </Button>
      </Space.Compact>

      <Modal
        title="Choose icon (Font Awesome 5)"
        open={open}
        onCancel={closePicker}
        footer={null}
        width={760}
        destroyOnClose
        className="svc-cat-icon-picker-modal"
      >
        <p className="svc-cat-icon-picker-hint">
          These match the mobile app&apos;s Expo{' '}
          <code>FontAwesome5</code> set. You can still type any other valid FA5
          name in the field.
        </p>
        <Input.Search
          placeholder="Search by icon name or label…"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="svc-cat-icon-picker-search"
        />
        {filtered.length === 0 ? (
          <Empty description="No icons match" className="svc-cat-icon-picker-empty" />
        ) : (
          <div className="svc-cat-icon-picker-grid">
            {filtered.map(({ key, label, Icon }) => {
              const selected =
                value?.trim().toLowerCase() === key.toLowerCase()
              return (
                <button
                  key={key}
                  type="button"
                  className={
                    selected
                      ? 'svc-cat-icon-picker-cell is-selected'
                      : 'svc-cat-icon-picker-cell'
                  }
                  onClick={() => {
                    onChange?.(key)
                    closePicker()
                  }}
                  title={`${label} — ${key}`}
                >
                  {createElement(Icon, {
                    className: 'svc-cat-icon-picker-glyph',
                    'aria-hidden': true,
                  })}
                  <span className="svc-cat-icon-picker-key">{key}</span>
                </button>
              )
            })}
          </div>
        )}
      </Modal>
    </>
  )
}
