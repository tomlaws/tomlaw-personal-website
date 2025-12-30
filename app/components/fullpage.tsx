'use client';

import { useEffect } from "react";
import styles from './fullpage.module.scss';
import Home from "./sections/home/home";
import About from "./sections/about/about";
import Timeline from "./sections/timeline/timeline";
import Works from "./sections/works/works";
import Contact from "./sections/contact/contact";
import clsx from "clsx";

export default function Fullpage() {
    useEffect(() => {
        document.getElementsByTagName('body')[0].classList.add('loaded');
    }, []);
    return (
        <>
            <div className={clsx([styles['spinner'], 'spinner'])}></div>
            <div className={styles.deco}></div>
            <div>
                <div id="home" className="section">
                    <div className={styles['section-content']}>
                        <Home />
                    </div>
                </div>
                <div id="about" className="section">
                    <div className={styles['section-content']}>
                        <About />
                    </div>
                </div>
                <div id="timeline" className="section mb-8">
                    <div className={clsx([styles['section-content'], 'w-screen'])}>
                        <Timeline />
                    </div>
                </div>
                <div id="works" className="section">
                    <div className={clsx([styles['section-content'], 'w-screen', 'h-screen'])}>
                        <Works />
                    </div>
                </div>
                <div id="contact" className="section">
                    <div className={clsx([styles['section-content'], 'w-screen'])}>
                        <Contact />
                    </div>
                </div>
            </div>
        </>
    )
}