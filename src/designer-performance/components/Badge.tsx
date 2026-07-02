import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  score: number;
}

export const Badge: React.FC<BadgeProps> = ({ score }) => {
  let colorClass = '';
  let label = '';
  let dotColor = '';

  if (score >= 90) {
    colorClass = 'bg-green-100 text-green-800 border-green-200';
    dotColor = 'bg-green-500';
    label = 'Excellent';
  } else if (score >= 70) {
    colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    dotColor = 'bg-yellow-500';
    label = 'Acceptable';
  } else {
    colorClass = 'bg-red-100 text-red-800 border-red-200';
    dotColor = 'bg-red-500';
    label = 'Critical';
  }

  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', colorClass)}>
      <span className={clsx('w-2 h-2 mr-1.5 rounded-full', dotColor)}></span>
      {label}
    </span>
  );
};
