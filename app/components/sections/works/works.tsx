import Image from 'next/image';
import styles from './works.module.scss';
import pegasushk from '../../../../public/images/pegasushk.jpg';
import hikee from '../../../../public/images/hikee.png';
import bubbleShooter from '../../../../public/images/bubble-shooter.png';
import multipleChoiceMarker from '../../../../public/images/multiple-choice-marker.png';
import scrabble from '../../../../public/images/scrabble.png';
import elegantMaterial from '../../../../public/images/elegant-material.png';
import touroll from '../../../../public/images/touroll.png';
import eDonor from '../../../../public/images/e-donor.png';
import movie from '../../../../public/images/movie.png';
import wordle from '../../../../public/images/wordle.jpeg';
import appointmentSystem from '../../../../public/images/booking.jpeg';
import firebaseChat from '../../../../public/images/firebase-chat.jpeg';
import osp from '../../../../public/images/osp.jpg';
import flixhk from '../../../../public/images/flixhk.jpeg';
import React from 'react';

export default function Works() {
    const projects = [
        {
            id: 10,
            title: "Movie Showtimes Platform",
            description: "Experimental Hong Kong movie showtimes platform using Gemini LLM to group schedules from local cinemas",
            image: flixhk,
            link: "https://flixhk.com",
            github: null,
            demo: "https://flixhk.com",
            technologies: ["Next.js", "Supabase", "LLM", "Cloudflare Worker", "GitHub Actions"],
            category: "Full-stack",
            featured: true,
            year: "2026"
        },
        {
            id: 0,
            title: "Online Survey Platform",
            description: "AI-powered survey generation and management platform",
            image: osp,
            link: "https://osp.tomlaw.dev/",
            github: "https://github.com/tomlaws/OSP_backend",
            demo: "https://osp.tomlaw.dev/",
            technologies: ["Go", "MongoDB", "Redis", "GitHub Models API"],
            category: "Full-Stack",
            featured: true,
            year: "2026"
        },
        {
            id: 1,
            title: "Multiplayer Wordle Game",
            description: "A real-time, multiplayer Wordle game built with Go, featuring queue-based matchmaking and a WebSocket protocol.",
            image: wordle,
            link: "https://github.com/tomlaws/wordle",
            github: "https://github.com/tomlaws/wordle",
            demo: "https://wordle.tomlaw.dev/",
            technologies: ["Go", "WebSocket", "JavaScript", "Svelte"],
            category: "Web Game",
            featured: true,
            year: "2025"
        },
        {
            id: 2,
            title: "Appointment System",
            description: "Full-stack appointment booking and management system with modern web technologies",
            image: appointmentSystem,
            link: "https://github.com/tomlaws/appointment-system",
            github: "https://github.com/tomlaws/appointment-system",
            demo: "https://booking.tomlaw.dev/",
            technologies: ["Next.js", "TypeScript", "PostgreSQL", "Prisma", "Redis"],
            category: "Full-Stack",
            featured: true,
            year: "2025"
        },
        // {
        //     id: 3,
        //     title: "Firebase Chat",
        //     description: "Real-time chat application with Firebase backend",
        //     image: firebaseChat,
        //     link: "https://fir-chat-4ba55.web.app/",
        //     github: "https://github.com/tomlaws/firebase-chat",
        //     demo: "https://fir-chat-4ba55.web.app/",
        //     technologies: ["SvelteKit", "TypeScript", "Firebase", "Tailwind CSS"],
        //     category: "Full-Stack",
        //     featured: true,
        //     year: "2025"
        // },
        {
            id: 4,
            title: "Pegasus E-Commerce",
            description: "Full-stack e-commerce platform with modern PWA features",
            image: pegasushk,
            link: "https://web.archive.org/web/20200427043644/https://shop.pegasus.hk/",
            github: null,
            demo: "https://web.archive.org/web/20200427043644/https://shop.pegasus.hk/",
            technologies: ["Nuxt.js", "GraphQL", "Node.js", "Express", "Apollo"],
            category: "Full-Stack",
            featured: true,
            year: "2019-2020"
        },
        {
            id: 5,
            title: "Hikee",
            description: "Final Year Project (FYP): Social hiking platform connecting outdoor enthusiasts",
            image: hikee,
            link: "https://github.com/tomlaws/hikee",
            github: "https://github.com/tomlaws/hikee",
            technologies: ["Flutter", "NestJS", "PostgreSQL", "Serverless", "AWS Lambda"],
            category: "Mobile App",
            featured: true,
            year: "2021-2022"
        },
        {
            id: 6,
            title: "Bubble Shooter Game",
            description: "C++ course project: Classic bubble shooter game with modern implementation",
            image: bubbleShooter,
            link: "https://github.com/tomlaws/BubbleShooter",
            github: "https://github.com/tomlaws/BubbleShooter",
            technologies: ["C++", "Qt", "Windows"],
            category: "Desktop Game",
            featured: false,
            year: "2019"
        },
        // {
        //     id: 6,
        //     title: "Mov!e",
        //     description: "Android movie database and recommendation app",
        //     image: movie,
        //     link: "https://github.com/tomlaws/Mov-e",
        //     github: "https://github.com/tomlaws/Mov-e",
        //     technologies: ["Android", "Java", "MySQL"],
        //     category: "Mobile App",
        //     featured: false
        // },
        // {
        //     id: 7,
        //     title: "E-Donor",
        //     description: "Blood donation management system",
        //     image: eDonor,
        //     link: "https://github.com/tomlaws/EDonor",
        //     github: "https://github.com/tomlaws/EDonor",
        //     technologies: ["PHP", "CodeIgniter", "JavaScript"],
        //     category: "Web App",
        //     featured: false
        // },
        // {
        //     id: 8,
        //     title: "Touroll",
        //     description: "Travel planning and social discovery app",
        //     image: touroll,
        //     link: "https://github.com/tomlaws/touroll",
        //     github: "https://github.com/tomlaws/touroll",
        //     technologies: ["Flutter", "Firebase", "Serverless", "AWS Lambda"],
        //     category: "Mobile App",
        //     featured: false
        // },
        {
            id: 7,
            title: "Scrabble Game",
            description: "Object-Oriented Programming (OOP) course project: Classic word game implementation",
            image: scrabble,
            link: "https://github.com/tomlaws/ScrabbleGame",
            github: "https://github.com/tomlaws/ScrabbleGame",
            technologies: ["C++", "Windows"],
            category: "Desktop Game",
            featured: false,
            year: "2017-18"
        },
        {
            id: 8,
            title: "Multiple Choice Marker",
            description: "Automated grading system developed as a School Based Assessment (SBA) for HKDSE ICT",
            image: multipleChoiceMarker,
            link: "https://github.com/tomlaws/MultipleChoiceMarker",
            github: "https://github.com/tomlaws/MultipleChoiceMarker",
            technologies: ["C#", "Windows"],
            category: "Desktop Tool",
            featured: false,
            year: "2015"
        }
    ];

    return (
        <div className={styles.worksContainer}>
            <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-16">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl lg:text-7xl font-bold mb-6 text-black">
                        My Work
                    </h1>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                        A showcase of my journey through code, from mobile apps to web platforms,
                        each project representing a unique challenge and learning experience.
                    </p>
                </div>

                {/* All Projects - Unified Grid */}
                <div className={styles.unifiedProjectsGrid}>
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            className={styles.unifiedCard}
                        >
                            <div className={styles.cardContent}>
                                <div className="flex justify-between items-center w-full">
                                    <div className={styles.categoryBadge}>
                                        {project.category}
                                    </div>
                                    <div className={styles.projectYear}>
                                        {project.year}
                                    </div>
                                </div>

                                <h3 className={styles.projectTitle}>{project.title}</h3>
                                <p className={styles.projectDescription}>{project.description}</p>

                                <div className={styles.techStack}>
                                    {project.technologies.map((tech, techIndex) => (
                                        <span key={techIndex} className={styles.techBadge}>
                                            {tech}
                                        </span>
                                    ))}
                                </div>

                                <div className={styles.cardActions}>
                                    {project.demo && (
                                        <a href={project.demo} target="_blank" rel="noopener noreferrer" className={styles.demoButton}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            <span className="hidden sm:inline">Live Demo</span>
                                            <span className="sm:hidden">Demo</span>
                                        </a>
                                    )}
                                    {project.github && (
                                        <a href={project.github} target="_blank" rel="noopener noreferrer" className={styles.githubButton}>
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                            </svg>
                                            <span className="hidden sm:inline">View on GitHub</span>
                                            <span className="sm:hidden">GitHub</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}