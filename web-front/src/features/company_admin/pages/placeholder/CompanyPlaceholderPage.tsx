import { Card, Typography } from 'antd'

type Props = {
  title: string
  description?: string
}

export function CompanyPlaceholderPage({ title, description }: Props) {
  return (
    <Card>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {description ??
          'This company admin section will be connected to backend endpoints next.'}
      </Typography.Paragraph>
    </Card>
  )
}
