'use client';

import ReactFullpage from "@fullpage/react-fullpage";
import { useRef, useState } from "react";
import styles from './fullpage.module.scss';
import Deco from "./decos/deco";
import Home from "./sections/home/home";
import About from "./sections/about/about";
import { FullPageProvider } from "../hooks/full-page";
import Works from "./sections/works/works";
import Contact from "./sections/contact/contact";
import clsx from "clsx";

export default function Fullpage() {
    const decoRef = useRef<any>(null);
    return (
        <>
            <Deco ref={decoRef} />
            <div className={clsx([styles['spinner'], 'spinner'])}></div>
            <ReactFullpage
                licenseKey="gplv3-license"
                scrollBar={true}
                onLeave={(origin, destination, direction) => {
                    if (destination.isFirst) {
                        decoRef.current?.focus();
                    } else {
                        decoRef.current?.unfocus(destination.index);
                    }
                }}
                afterRender={() => {
                    document.getElementsByTagName('body')[0].classList.add('loaded');
                }}
                render={({ state, fullpageApi }) => {
                    return (
                        <FullPageProvider api={fullpageApi}>
                            <ReactFullpage.Wrapper>
                                <div className="section">
                                    <div className={styles['section-content']}>
                                        <Home />
                                    </div>
                                </div>
                                <div className="section">
                                    <div className={styles['section-content']}>
                                        <About />
                                    </div>
                                </div>
                                <div className="section">
                                    <div className={clsx([styles['section-content'], 'w-screen', 'h-screen'])}>
                                        <Works />
                                    </div>
                                </div>
                                <div className="section">
                                    <div className={clsx([styles['section-content'], 'w-screen'])}>
                                        <Contact />
                                    </div>
                                </div>
                            </ReactFullpage.Wrapper>
                        </FullPageProvider>
                    );
                }}
            />
        </>
    )
}