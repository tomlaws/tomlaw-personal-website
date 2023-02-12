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
import clsx from 'clsx';
import React from 'react';

export default function Works() {
    const works = [
        {
            desc: "Mov!e",
            link: "https://github.com/tomlaws/Mov-e",
            image: <Image
                fill
                src={movie}
                alt="Mov!e"
                style={{ objectFit: 'cover' }}
            />,
            className: "lg:order-1 col-span-1",
            badges: [
                { name: 'Android', color: '3DDC84', logo: 'android' },
                { name: 'Java', color: 'F89820', logo: 'java' },
                { name: 'MySQL', color: '4479A1', logo: 'mysql' },
            ]
        },
        {
            desc: "Pegasus",
            link: "https://shop.pegasus.hk/",
            image: <Image
                fill
                src={pegasushk}
                alt="Pegasushk"
                style={{ objectFit: 'cover' }}
            />,
            className: "lg:order-2 col-span-2 lg:col-span-2",
            badges: [
                { name: 'GraphQL', color: 'E10098', logo: 'graphql' },
                { name: 'Nuxt.js', color: '00C58E', logo: 'nuxt.js' },
                { name: 'Node.js', color: '339933', logo: 'node.js' },
                { name: 'Express', color: '000000', logo: 'express' },
                { name: 'Apollo', color: '311C87', logo: 'apollographql' },
            ],
        },
        {
            desc: 'Hikee',
            link: "https://github.com/tomlaws/hikee",
            image: <Image
                fill
                src={hikee}
                alt="FYP"
                style={{ objectFit: 'cover' }}
            />,
            className: "order-3 lg:order-3 col-span-2 row-span-2",
            badges: [
                { name: 'Flutter', color: '02569B', logo: 'flutter' },
                { name: 'NestJS', color: 'E0234E', logo: 'nestjs' },
                { name: 'PostgreSQL', color: '4169E1', logo: 'postgresql' },
                { name: 'Serverless', color: 'FD5750', logo: 'serverless' },
                { name: 'AWS Lamda', color: 'FF9900', logo: 'awslambda' },
            ],
        },
        {
            desc: "Elegant Material",
            link: "https://elegantmaterial.com/",
            image: <Image
                fill
                src={elegantMaterial}
                alt="Elegant Material"
                style={{ objectFit: 'cover' }}
            />,
            className: "order-4 lg:order-4 col-span-1 row-span-1",
            badges: [
                { name: 'React', color: '61DAFB', logo: 'react' },
                { name: 'Firebase', color: 'FFCA28', logo: 'firebase' },
                { name: 'NestJS', color: 'E0234E', logo: 'nestjs' },
                { name: 'MySQL', color: '4479A1', logo: 'mysql' },
                { name: 'Docker', color: '2496ED', logo: 'docker' },
            ],
        },
        {
            desc: "Bubble Shooter",
            link: "https://github.com/tomlaws/BubbleShooter",
            image: <Image
                fill
                src={bubbleShooter}
                alt="Bubble Shooter"
                style={{ objectFit: 'cover' }}
            />,
            className: "order-5 lg:order-5 col-span-1 lg:col-span-2 row-span-2",
            badges: [
                { name: 'Windows', color: '0078D6', logo: 'windows' },
                { name: 'C++', color: '00599C', logo: 'c%2B%2B' },
                { name: 'Qt', color: '41CD52', logo: 'qt' }
            ],
        },
        {
            desc: "E-Donor",
            link: "https://github.com/tomlaws/EDonor",
            image: <Image
                fill
                src={eDonor}
                alt="E-Donor"
                style={{ objectFit: 'cover' }}
            />,
            className: "order-6 lg:order-6 col-span-1 row-span-1",
            badges: [
                { name: 'PHP', color: '777BB4', logo: 'php' },
                { name: 'CodeIgniter', color: 'EF4223', logo: 'codeigniter' },
                { name: 'JavaScript', color: 'F7DF1E', logo: 'javascript' },
            ]
        },
        {
            desc: "Touroll",
            link: "https://github.com/tomlaws/touroll",
            image: <Image
                fill
                src={touroll}
                alt="Touroll"
                style={{ objectFit: 'cover' }}
            />,
            className: "order-last lg:order-7 col-span-1 row-span-1",
            badges: [
                { name: 'Flutter', color: '02569B', logo: 'flutter' },
                { name: 'Firebase', color: 'FFCA28', logo: 'firebase' },
                { name: 'Serverless', color: 'FD5750', logo: 'serverless' },
                { name: 'AWS Lamda', color: 'FF9900', logo: 'awslambda' },
            ],
        },
        {
            desc: "Scrabble",
            link: "https://github.com/tomlaws/ScrabbleGame",
            image: <Image
                fill
                src={scrabble}
                alt="Scrabble"
                style={{ objectFit: 'cover' }}
            />,
            className: "order-7 row-span-2 col-span-1 lg:row-span-1 lg:col-span-2",
            badges: [
                { name: 'Windows', color: '0078D6', logo: 'windows' },
                { name: 'C++', color: '00599C', logo: 'c%2B%2B' },
            ],
        },
        {
            desc: "Multiple Choice Marker",
            link: "https://github.com/tomlaws/MultipleChoiceMarker",
            image: <Image
                fill
                src={multipleChoiceMarker}
                alt="Multiple Choice Marker"
                style={{ objectFit: 'cover' }}
            />,
            className: "order-8 lg:order-8 col-span-1 lg:col-span-2 row-span-1",
            badges: [
                { name: 'Windows', color: '0078D6', logo: 'windows' },
                { name: 'C#', color: '239120', logo: 'c-sharp' }
            ],
        },
    ];
    const item = ({ image, className, desc, badges, link }: { image: any, className?: string, desc?: string, link?: string, badges?: { name: string, color: string, logo: string }[] }) => {
        return (
            <div className={clsx(['relative', className, styles.card])}>
                <a href={link} target="_blank" className={clsx([styles.content])}>
                    <div className="rounded-2xl overflow-hidden">
                        {image}
                    </div>
                    <div className="rounded-2xl overflow-hidden">
                        <div className="h-full flex flex-col items-center justify-center gap-6">
                            <div>
                                <h1 className="text-xl">{desc}</h1>
                            </div>
                            <div className="flex gap-2 flex-wrap items-center justify-center px-2">
                                {
                                    badges?.map((badge, index) =>
                                        <img
                                            className={styles.badge}
                                            key={index}
                                            alt={badge.name}
                                            src={`https://img.shields.io/badge/${encodeURIComponent(badge.name)}-${badge.color}?style=flat-square&logo=${badge.logo}&logoColor=fff`}
                                        />)
                                }
                            </div>
                        </div>
                    </div>
                </a>
            </div>
        );
    }
    return (
        <div className="w-screen h-screen grid gap-3 lg:gap-5 grid-cols-3 grid-rows-5 lg:grid-cols-6 lg:grid-rows-3 p-3 lg:p-5">
            {works.map((work, index) => {
                return (
                    <React.Fragment key={index}>
                        {item(work)}
                    </React.Fragment>
                );
            })}
        </div>
    );
}