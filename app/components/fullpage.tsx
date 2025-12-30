'use client';

import { useEffect, useRef } from "react";
import styles from './fullpage.module.scss';
import Home from "./sections/home/home";
import About from "./sections/about/about";
import Timeline from "./sections/timeline/timeline";
import Works from "./sections/works/works";
import Contact from "./sections/contact/contact";
import Deco from "./decos/deco";
import clsx from "clsx";

export default function Fullpage() {
    const decoRef = useRef<any>(null);

    useEffect(() => {
        document.getElementsByTagName('body')[0].classList.add('loaded');
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const contactSection = document.getElementById('contact');
            if (contactSection && decoRef.current) {
                const rect = contactSection.getBoundingClientRect();
                const isInContactSection = rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2;
                
                if (isInContactSection) {
                    decoRef.current.unfocus(1);
                } else {
                    decoRef.current.focus();
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll(); // Check initial state

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <div className={clsx([styles['spinner'], 'spinner'])}></div>
            <div className={styles.deco}></div>
            <Deco ref={decoRef} />
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
                    <div className={clsx([styles['section-content'], 'w-screen'])}>
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