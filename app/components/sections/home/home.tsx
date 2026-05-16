import clsx from 'clsx';
import React from 'react';
import styles from './home.module.scss';

export default function Home() {
    return (
        <div className="flex flex-col gap-8 items-start">
            <div className={clsx(['flex flex-wrap flex-col gap-8 md:flex-row md:gap-0', styles.name])}>
                <div>
                    TOM
                    <span>&nbsp;</span>
                </div>
                <div>
                    LAW
                </div>
            </div>
            <p>
                I'm a backend developer based in HK 😀.
            </p>
            <button
                className="mt-4 px-10 py-3 border border-black text-black bg-white hover:bg-black hover:text-white transition-colors duration-200 text-xs font-bold tracking-[4px] uppercase"
                onClick={() => {
                    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
                }}
            >
                MORE
            </button>
        </div>
    )
}