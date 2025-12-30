'use client';

import React, { useCallback, useEffect, useImperativeHandle, useRef, forwardRef, useMemo, useState } from "react";
import { gsap, Sine } from "gsap";
import styles from "./deco.module.scss";
import { useLayoutEffect } from "@/app/hooks/use-layout-effect";

const Deco = forwardRef(function Deco(props, ref) {
    const layer = useRef<HTMLDivElement>(null);

    const pos = useMemo(() => [
        ['$', '50vw', '79vh', -20],
        ['`', '39vw', '5vh', -9],
        ['?', '56vw', '28vh', -15],
        ['=', '14vw', '21vh', 15],
        ['!', '28vw', '36vh', 7],
        ['*', '80vw', '83vh', 9],
        ['"', '92vw', '19vh', 12],
        ['<', '70vw', '11vh', -12],
        [';', '9vw', '65vh', -15],
        ['}', '86vw', '57vh', -8],
        ['/', '67vw', '54vh', 4],
        ['[', '33vw', '63vh', 18]
    ], []);

    const focus = useRef(true);

    const animateNext = useCallback((el: Element, x: boolean, amt: number, duration: number, mul: number = 1) => {
        gsap.to(el, {
            x: x ? () => "+=" + amt * mul + "vw" : undefined,
            y: !x ? () => "+=" + (amt * mul) + "vh" : undefined,
            ease: Sine.easeInOut,
            duration: duration,
            onComplete: animateNext,
            onCompleteParams: [el, x, amt, duration, mul * -1],
        })
    }, [focus]);

    const startAnimate = useCallback(() => {
        if (layer.current == null) return;
        gsap.set(layer.current, {
            'background': `radial-gradient(circle at 50% -50%,
                rgb(42, 42, 85),
                rgb(21, 21, 24)`
        });
        for (const [i, el] of Array.from(layer.current.children).entries()) {
            // Set initial position without animation
            gsap.set(el, {
                x: pos[i][1],
                y: pos[i][2],
                rotation: pos[i][3],
                opacity: 0,
            });
            // Fade in the symbol
            gsap.to(el, {
                opacity: focus.current ? .25 : 0,
                duration: 2,
                delay: i * 0.1, // Stagger the fade-in
                ease: Sine.easeInOut,
                onComplete: () => {
                    // Start the floating animations
                    animateNext(el, true, gsap.utils.random(-2, 2), gsap.utils.random(3, 5));
                    animateNext(el, false, gsap.utils.random(-2, 2), gsap.utils.random(3, 5));
                }
            });
        }
    }, [pos]);

    useLayoutEffect(() => {
        startAnimate();
    }, []);

    useImperativeHandle(ref, () => {
        return {
            focus() {
                focus.current = true;
                if (layer.current == null) return;
                gsap.to(Array.from(layer.current.children), {
                    top: '0vh',
                    opacity: .25,
                    duration: 2,
                });
                gsap.to(layer.current, {
                    duration: 2,
                    'background': `radial-gradient(circle at 50% -50%,
                        rgb(42, 42, 85),
                        rgb(21, 21, 24)`
                });
            },
            unfocus(idx: number) {
                focus.current = false;
                if (layer.current == null) return;
                gsap.to(Array.from(layer.current.children), {
                    top: '-20vh',
                    opacity: 0,
                    duration: 2,
                });
                if (idx == 1) {
                    gsap.to(layer.current, {
                        duration: 2,
                        'background': `radial-gradient(circle at 50% -50%,
                            rgb(21, 21, 24),
                            rgb(21, 21, 24)`
                    });
                }
            },
        };
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
});

export default Deco;