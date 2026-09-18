import React, { useEffect, useState } from 'react';

export default function AnimatedTab({ children, tabKey }) {
  const [visibleKey, setVisibleKey] = useState(tabKey);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (tabKey !== visibleKey) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setVisibleKey(tabKey);
        setAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [tabKey, visibleKey]);

  return (
    <div
      className={`transition-all duration-200 ease-out transform ${
        animating
          ? 'opacity-0 translate-y-2 scale-[0.99]'
          : 'opacity-100 translate-y-0 scale-100'
      } h-full w-full`}
    >
      {children}
    </div>
  );
}
