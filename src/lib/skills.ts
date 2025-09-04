import React from 'react';
import SkillDetailModal, { SkillDetail } from '../components/SkillDetailModal';

const skills: SkillDetail[] = [
  {
    name: 'Embedded Systems',
    description: 'Designing and programming microcontroller-based systems for real-world applications, including IoT devices and robotics.',
    source: 'North Carolina State University, SolarPack, Personal Projects'
  },
  {
    name: 'Mobile App Development',
    description: 'Building cross-platform mobile applications using React Native and integrating hardware features.',
    source: 'North Carolina State University, Personal Projects'
  },
  {
    name: 'Power Electronics',
    description: 'Design and analysis of circuits for power conversion, including battery management and motor drivers.',
    source: 'North Carolina State University, SolarPack'
  },
  {
    name: 'Mechatronics',
    description: 'Integration of mechanical, electrical, and software systems for automation and robotics.',
    source: 'North Carolina State University, SolarPack'
  },
  {
    name: 'Product Development',
    description: 'End-to-end product design, prototyping, and deployment, including hardware and software integration.',
    source: 'North Carolina State University, Personal Projects'
  },
  // ...add more skills as needed
];

export default skills;
