import React, { useMemo } from 'react';
import { renderMathToHtml } from '../utils/mathUtils';

interface MathViewProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export const MathView: React.FC<MathViewProps> = ({
  latex,
  displayMode = false,
  className = '',
}) => {
  const html = useMemo(() => {
    return renderMathToHtml(latex, displayMode);
  }, [latex, displayMode]);

  if (!html) {
    return (
      <code
        className={`font-mono text-xs px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-amber-700 dark:text-amber-300 ${className}`}
      >
        {latex}
      </code>
    );
  }

  return (
    <span
      className={`katex-math inline-block select-text ${
        displayMode ? 'w-full my-2 text-center overflow-x-auto' : 'align-baseline mx-0.5'
      } ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
