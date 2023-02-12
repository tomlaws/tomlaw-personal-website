import clsx from 'clsx';
import React from 'react';
import styles from './about.module.scss';

export default function About() {
    return (
        <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-auto lg:flex-1 flex items-center justify-center">
                <div className={styles.syntax}>
                    &lt;Me/&gt;
                </div>
            </div>
            <div className="flex-1 flex flex-col gap-3">
                <p>
                    I am a recent university graduate with a passion for software development. Throughout my academic years, I have worked on various projects that have helped me to develop my skills and gain hands-on experience. My goal is to continue to grow as a developer and make meaningful contributions to the industry.
                </p>
                <p>
                    On this portfolio website, you'll find a selection of my previous projects and a little bit about my background. If you have any questions, don't hesitate to get in touch.
                </p>
            </div>
        </div>
    );
}