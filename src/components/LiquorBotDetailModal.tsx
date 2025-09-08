import React from 'react';


interface LiquorBotDetailModalProps {
  onClose: () => void;
  detailType: 'mobile' | 'hardware' | 'firmware' | null;
}

const getDetailContent = (type: 'mobile' | 'hardware' | 'firmware' | null) => {
  switch (type) {
    case 'mobile':
      return {
        title: 'Mobile App',
        description: 'React Native app for recipe selection and customization. Control the robot, select recipes, and monitor status from your phone.'
      };
    case 'hardware':
      return {
        title: 'Hardware',
        description: 'Custom PCBs with stepper motor control systems. Precision dispensing, ingredient recognition, and robust mechanical design.'
      };
    case 'firmware':
      return {
        title: 'Firmware',
        description: 'ESP32 firmware for solenoid control, IoT Core connectivity, and app integration. Handles communication between hardware and mobile app.'
      };
    default:
      return {
        title: 'LiquorBot Details',
        description: '(Details about LiquorBot will go here.)'
      };
  }
};

const LiquorBotDetailModal: React.FC<LiquorBotDetailModalProps> = ({ onClose, detailType }) => {
  const { title, description } = getDetailContent(detailType);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-xl shadow-2xl p-8 max-w-lg w-full z-10 flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-4 text-foreground">{title}</h2>
        <p className="text-muted-foreground mb-6">{description}</p>
        <button
          className="mt-4 px-4 py-2 bg-minimal-accent text-white rounded-lg hover:bg-minimal-accent/80 transition-colors"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default LiquorBotDetailModal;
