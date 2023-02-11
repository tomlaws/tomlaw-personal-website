import { useFullPage } from '@/app/hooks/full-page';
import clsx from 'clsx';
import React from 'react';
import styles from './home.module.scss';

export default function Home() {
    const { api } = useFullPage();
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
                I'm a software engineer based in HK 😀.
            </p>
            <button
                onClick={() => {
                    api.moveSectionDown();
                }}
            >
                MORE
            </button>
        </div>
    )
}