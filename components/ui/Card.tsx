import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    children: React.ReactNode;
    className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        <motion.div
            className={`bg-white border border-gray-200 rounded-3xl shadow-sm ${className}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            {...props}
        >
            {children}
        </motion.div>
    );
};
