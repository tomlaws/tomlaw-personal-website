import { Lato } from '@next/font/google'
import styles from './page.module.css'
import clsx from 'clsx'
import Intro from './components/sections/intro'
import Deco from './components/decos/deco'

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--lato-font',
})


export default function Home() {
  return (
    <main className={clsx([lato.className, styles.main])}>
      <Deco/>
      <Intro/>
    </main>
  )
}
