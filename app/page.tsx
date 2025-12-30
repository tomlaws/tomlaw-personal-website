import { Lato } from "next/font/google"
import styles from './page.module.css'
import clsx from 'clsx'
import Fullpage from './components/fullpage'

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--lato-font',
});

export default function Home() {
  return (
    <main className={clsx([lato.className, styles.main, 'overflow-x-hidden'])}>
      <Fullpage/>
    </main>
  )
}
