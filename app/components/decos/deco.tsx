'use client';

import React, { useCallback, useEffect, useRef } from "react";
import { gsap, Sine } from "gsap";
import styles from "./deco.module.scss";
import { useLayoutEffect } from "@/app/utils/use-layout-effect";

export default function Deco() {
    const layer = useRef<HTMLDivElement>(null);

    const pos = [
        ['$', '50vw', '84vh', -20],
        ['`', '39vw', '10vh', -9],
        ['?', '56vw', '33vh', -15],
        ['=', '14vw', '26vh', 15],
        ['!', '28vw', '41vh', 7],
        ['*', '80vw', '88vh', 9],
        ['"', '92vw', '24vh', 12],
        ['<', '70vw', '16vh', -12],
        [';', '9vw', '70vh', -15],
        ['}', '86vw', '62vh', -8],
        ['/', '67vw', '59vh', 4],
        ['[', '33vw', '68vh', 18],
    ];
    const animate = useCallback((el: Element, x: boolean, amt: number, duration: number, mul: number = 1) => {
        gsap.to(el, {
            x: x ? () => "+=" + amt * mul + "vw" : undefined,
            y: !x ? () => "+=" + amt * mul + "vh" : undefined,
            ease: Sine.easeInOut,
            duration: duration,
            onComplete: animate,
            onCompleteParams: [el, x, amt, duration, mul * -1],
        })
    }, []);
    useLayoutEffect(() => {
        if (layer.current == null) return;
        for (const [i, el] of Array.from(layer.current.children).entries()) {
            gsap.set(el, {
                x: pos[i][1],
                y: pos[i][2],
                rotation: pos[i][3] ?? gsap.utils.random(-30, 30),
                visibility: 'visible',
                onComplete: () => {
                    animate(el, true, gsap.utils.random(-2, 2), gsap.utils.random(3, 5));
                    animate(el, false, gsap.utils.random(-2, 2), gsap.utils.random(3, 5));
                },
            });
        }
    }, []);

    return (
        <>
            <div ref={layer} className={styles.deco}>
                {
                    pos.map((_, i) => <div key={i}>{pos[i][0]}</div>)
                }
            </div>
        </>
    );
}