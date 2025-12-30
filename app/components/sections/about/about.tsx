import styles from './about.module.scss';

export default function About() {
    return (
        <div className="flex flex-col lg:flex-row gap-8 w-full">
            <div className="flex-auto lg:flex-1 flex items-center justify-center">
                <div className={styles.syntax}>
                    &lt;Me/&gt;
                </div>
            </div>
            <div className="flex-1 flex flex-col gap-3 justify-center">
                <p>
                    I am a backend developer with several years of experience in software development. I specialize in building robust server-side applications and have worked extensively with various technology stacks including Java and Node.js for backend development, and Flutter and React Native for mobile applications.
                </p>
                <p>
                    For side projects, I've explored additional technologies like Golang and Svelte, always looking to expand my skills and stay current with industry trends. My goal is to continue delivering high-quality solutions and meaningful contributions to the software development community.
                </p>
                <p>
                    On this portfolio website, you'll find a selection of my previous projects and insights into my professional background. If you have any questions or opportunities to collaborate, don't hesitate to get in touch.
                </p>
            </div>
        </div>
    );
}