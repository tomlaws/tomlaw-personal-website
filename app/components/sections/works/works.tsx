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
import React from 'react';

export default function Works() {
    const projects = [
        {
            id: 1,
            title: "Pegasus E-Commerce",
            description: "Full-stack e-commerce platform with modern PWA features",
            longDescription: "A comprehensive e-commerce solution built with Nuxt.js, featuring GraphQL API, real-time inventory management, and automated deployment pipelines.",
            image: pegasushk,
            link: "https://shop.pegasus.hk/",
            github: null,
            technologies: ["Nuxt.js", "GraphQL", "Node.js", "Express", "Apollo"],
            category: "Full-Stack",
            featured: true
        },
        {
            id: 2,
            title: "Hikee",
            description: "Social hiking platform connecting outdoor enthusiasts",
            longDescription: "A mobile-first social platform for hikers, featuring trail discovery, community features, and real-time location sharing with serverless architecture.",
            image: hikee,
            link: "https://github.com/tomlaws/hikee",
            github: "https://github.com/tomlaws/hikee",
            technologies: ["Flutter", "NestJS", "PostgreSQL", "Serverless", "AWS Lambda"],
            category: "Mobile App",
            featured: true
        },
        {
            id: 3,
            title: "Bubble Shooter Game",
            description: "Classic bubble shooter game with modern C++ implementation",
            longDescription: "A faithful recreation of the classic bubble shooter game, built with C++ and Qt framework, featuring smooth animations and engaging gameplay mechanics.",
            image: bubbleShooter,
            link: "https://github.com/tomlaws/BubbleShooter",
            github: "https://github.com/tomlaws/BubbleShooter",
            technologies: ["C++", "Qt", "Windows"],
            category: "Desktop Game",
            featured: false
        },
        {
            id: 4,
            title: "Mov!e",
            description: "Android movie database and recommendation app",
            longDescription: "A comprehensive movie database application for Android, featuring user reviews, ratings, and personalized recommendations with local database storage.",
            image: movie,
            link: "https://github.com/tomlaws/Mov-e",
            github: "https://github.com/tomlaws/Mov-e",
            technologies: ["Android", "Java", "MySQL"],
            category: "Mobile App",
            featured: false
        },
        {
            id: 5,
            title: "E-Donor",
            description: "Blood donation management system",
            longDescription: "A web-based platform for managing blood donation campaigns, donor registration, and inventory tracking built with PHP and CodeIgniter framework.",
            image: eDonor,
            link: "https://github.com/tomlaws/EDonor",
            github: "https://github.com/tomlaws/EDonor",
            technologies: ["PHP", "CodeIgniter", "JavaScript"],
            category: "Web App",
            featured: false
        },
        {
            id: 6,
            title: "Touroll",
            description: "Travel planning and social discovery app",
            longDescription: "A travel companion app that helps users discover destinations, create itineraries, and connect with fellow travelers using modern serverless architecture.",
            image: touroll,
            link: "https://github.com/tomlaws/touroll",
            github: "https://github.com/tomlaws/touroll",
            technologies: ["Flutter", "Firebase", "Serverless", "AWS Lambda"],
            category: "Mobile App",
            featured: false
        },
        {
            id: 7,
            title: "Scrabble Game",
            description: "Classic word game implementation",
            longDescription: "A digital version of the classic Scrabble board game, featuring AI opponents, score tracking, and an intuitive user interface built with C++.",
            image: scrabble,
            link: "https://github.com/tomlaws/ScrabbleGame",
            github: "https://github.com/tomlaws/ScrabbleGame",
            technologies: ["C++", "Windows"],
            category: "Desktop Game",
            featured: false
        },
        {
            id: 8,
            title: "Multiple Choice Marker",
            description: "Automated grading system for multiple choice exams",
            longDescription: "A desktop application for automatically grading multiple choice examinations, featuring optical character recognition and detailed reporting capabilities.",
            image: multipleChoiceMarker,
            link: "https://github.com/tomlaws/MultipleChoiceMarker",
            github: "https://github.com/tomlaws/MultipleChoiceMarker",
            technologies: ["C#", "Windows"],
            category: "Desktop Tool",
            featured: false
        }
    ];

    const featuredProjects = projects.filter(p => p.featured);
    const otherProjects = projects.filter(p => !p.featured);

    return (
        <div className={styles.worksContainer}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        My Work
                    </h1>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                        A showcase of my journey through code, from mobile apps to web platforms,
                        each project representing a unique challenge and learning experience.
                    </p>
                </div>

                {/* All Projects - Unified Grid */}
                <div className={styles.unifiedProjectsGrid}>
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            className={`${styles.unifiedCard} ${project.featured ? styles.featuredProject : styles.regularProject}`}
                        >
                            <div className={styles.cardImage}>
                                <Image
                                    src={project.image}
                                    alt={project.title}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                />
                            </div>

                            <div className={styles.cardContent}>
                                <div className={styles.categoryBadge}>
                                    {project.category}
                                </div>

                                <h3 className={styles.projectTitle}>{project.title}</h3>
                                <p className={styles.projectDescription}>{project.description}</p>

                                <div className={styles.techStack}>
                                    {project.technologies.slice(0, 4).map((tech, techIndex) => (
                                        <span key={techIndex} className={styles.techBadge}>
                                            {tech}
                                        </span>
                                    ))}
                                    {project.technologies.length > 4 && (
                                        <span className={styles.techBadge}>+{project.technologies.length - 4}</span>
                                    )}
                                </div>

                                <div className={styles.cardActions}>
                                    {project.github && (
                                        <a href={project.github} target="_blank" rel="noopener noreferrer" className={styles.githubButton}>
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                            </svg>
                                            View on GitHub
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