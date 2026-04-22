import { Card, Typography } from 'antd'

type Props = {
  title: string
  description?: string
}

export function PlaceholderPage({ title, description }: Props) {
  return (
    <Card>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {description ??
          'This section will be wired to the backend in a follow-up iteration.'}
      </Typography.Paragraph>
    </Card>
  )
}
