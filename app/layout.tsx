import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      {/*
        <head /> will contain the components returned by the nearest parent
        head.tsx. Find out more at https://beta.nextjs.org/docs/api-reference/file-conventions/head
      */}
      <head>
        <title>Tom Law</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta name="description" content="I'm a backend developer based in HK 😀." />
        <meta property="og:title" content="Tom Law" />
        <meta property="og:url" content="https://tomlaw.me/" />
        <meta property="og:image" content="https://avatars.githubusercontent.com/u/47745140?v=5" />
        <meta property="og:description" content="I'm a backend developer based in HK 😀." />
        <meta property="og:type" content="profile" />
        <meta property="og:profile:first_name" content="Tom" />
        <meta property="og:profile:last_name" content="Law" />
        <meta property="og:profile:username" content="tomlaw" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  )
}
