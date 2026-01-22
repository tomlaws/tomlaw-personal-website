import React from 'react';
import styles from './timeline.module.scss';

export default function Timeline() {
    const experiences = [
        {
            year: "Aug 2025 - Dec 2025",
            title: "Backend Developer",
            company: "AS Watson · Full-time",
            description: "Focusing on bug fixing, performance optimization, and system maintenance for AS Watson Group's authentication infrastructure, utilizing modern Java frameworks and monitoring tools to ensure system reliability and efficiency.",
            technologies: ["Java", "Grafana", "Keycloak", "Quarkus", "GitHub"],
            icon: "🚀"
        },
        {
            year: "Jul 2023 - Aug 2025",
            title: "Programmer",
            company: "Mandatory Provident Fund Schemes Authority · Full-time",
            description: "Developed and maintained applications for the Mandatory Provident Fund Schemes Authority, implementing secure financial systems with comprehensive testing and security measures.",
            technologies: ["Java", "Flutter", "PL/SQL", "Spring", "React Native", "LoadRunner", "OWASP ZAP", "Git", "GitHub", "Node.js"],
            icon: "🏛️"
        },
        {
            year: "Jul 2022 - Dec 2022, May 2023 - Jul 2023",
            title: "Freelance Software Consultant (Remote)",
            company: "Sharp Point System · Freelance",
            description: "Focused on MVP Flutter app development, including bug fixing, rebuilding state management, and ensuring cross-platform compatibility across Windows, MacOS, iOS, iPadOS, Android, and Web. Implemented real-time chart rendering with various technical indicators using TA-Lib (Technical Analysis Library).",
            technologies: ["Flutter", "Dart", "TCP Socket", "WebSocket", "Cross-platform"],
            icon: "🧑‍💻"
        },
        {
            year: "Jul 2021 - Aug 2021",
            title: "Analyst Programmer",
            company: "Sharp Point System · Internship",
            description: "Developed an MVP trading app that provides real-time product price updates and account notifications by communicating with the server using TCP sockets and WebSockets.",
            technologies: ["Java", "React.js", "Flutter", "WebSocket", "JavaScript", "Git"],
            icon: "💻"
        },
        {
            year: "Jul 2019 - May 2020",
            title: "Freelance Web Developer",
            company: "Pegasus Computer Limited · Freelance",
            description: "Transformed a WordPress site with WooCommerce into a custom progressive web app using Nuxt.js. The project involved developing a comprehensive backend with user management, stock tracking, and order reporting capabilities. I designed and implemented the frontend using Vue.js and Bootstrap 5, creating an intuitive and responsive user experience. Additionally, I established a CI/CD pipeline on GitLab to streamline automated deployments to the client's private cloud infrastructure.",
            technologies: ["Nuxt.js", "Vue", "Node.js", "Bootstrap 5", "GitLab CI/CD"],
            icon: "⚡"
        },
        {
            year: "Jun 2018 - Jul 2018",
            title: "Web Developer",
            company: "DOOD LIMITED · Internship",
            description: "Developed WordPress websites with responsive web design, implemented fancy user interfaces and animations using CSS3 and HTML5, and created a request quote plugin with PHP for e-commerce websites.",
            technologies: ["HTML/CSS", "JavaScript", "PHP", "WordPress"],
            icon: "🌱"
        }
    ];

    return (
        <div className="flex flex-col w-full h-full py-12">
            <div className="max-w-6xl w-full md:px-8 mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-5xl lg:text-7xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        Career Journey
                    </h1>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                        A timeline of my professional growth and technological evolution
                    </p>
                </div>

                <div className={styles.timelineContainer}>
                    <div className={styles.timeline}>
                        {experiences.map((exp, index) => (
                            <div
                                key={index}
                                className={styles.timelineItem}
                            >
                                <div className={styles.timelineContent}>
                                    <div className={styles.yearBadge}>
                                        <span className={styles.year}>{exp.year}</span>
                                        <div className={styles.icon}>{exp.icon}</div>
                                    </div>

                                    <div className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <h3 className={styles.title}>{exp.title}</h3>
                                            <h4 className={styles.company}>{exp.company}</h4>
                                        </div>

                                        <div className={styles.cardBody}>
                                            <p className={styles.description}>{exp.description}</p>

                                            <div className={styles.technologies}>
                                                {exp.technologies.map((tech, techIndex) => (
                                                    <span key={techIndex} className={styles.tech}>
                                                        {tech}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className={styles.cardGlow}></div>
                                    </div>
                                </div>

                                <div className={styles.connector}>
                                    <div className={styles.dot}></div>
                                    <div className={styles.line}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}