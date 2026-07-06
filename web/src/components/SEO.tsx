import { Helmet } from 'react-helmet-async'
import { SITE } from '../data/site'

interface Props {
  title: string
  description: string
  ogImage?: string
  type?: 'website' | 'article'
  jsonLd?: object[]
}

export default function SEO({ title, description, ogImage = SITE.ogDefault, type = 'website', jsonLd = [] }: Props) {
  const canonical = `${SITE.url}${location.pathname}`
  const ogImageAbs = `${SITE.url}${ogImage}`

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:image" content={ogImageAbs} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${SITE.name} — open-source coding agent CLI`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImageAbs} />

      {jsonLd.map((block, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(block)}</script>
      ))}
    </Helmet>
  )
}
