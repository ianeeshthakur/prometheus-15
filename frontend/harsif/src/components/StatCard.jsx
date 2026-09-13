import React, { useState, useEffect, useRef } from 'react';
import './StatCard.css';

/**
 * Helper to parse numeric values from numbers or strings (e.g. 1428, "1,428", 99.8, "99.8%")
 */
function parseTargetNumber(rawVal) {
  if (typeof rawVal === 'number') {
    const isDecimal = !Number.isInteger(rawVal);
    const decimals = isDecimal ? rawVal.toString().split('.')[1]?.length || 1 : 0;
    return { target: rawVal, isDecimal, decimals, isNumeric: true };
  }

  if (typeof rawVal === 'string') {
    const cleaned = rawVal.replace(/,/g, '').trim();
    const match = cleaned.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (match) {
      const parsed = parseFloat(match[0]);
      if (!isNaN(parsed)) {
        const isDecimal = match[0].includes('.');
        const decimals = isDecimal ? match[0].split('.')[1]?.length || 1 : 0;
        return { target: parsed, isDecimal, decimals, isNumeric: true };
      }
    }
  }

  return { target: null, isDecimal: false, decimals: 0, isNumeric: false };
}

/**
 * StatCard Component
 * Government CCTV / GIS Platform Stat Tile
 *
 * @param {React.ReactNode} icon - SVG or React node for card icon
 * @param {string} label - Title or description of the metric
 * @param {number|string} value - Big number value to display and count up to
 * @param {'green'|'blue'|'red'|'amber'} [statusAccent='blue'] - Colored status accent
 * @param {string} [accent] - Alias for statusAccent
 * @param {string} [prefix] - Prefix before number (e.g. "$", "#")
 * @param {string} [suffix] - Suffix after number (e.g. "%", "ms", "+")
 * @param {string} [subtext] - Secondary description at the footer
 * @param {string} [trendText] - Trend percentage or text (e.g. "+12% this week")
 * @param {boolean} [isPositive] - Trend direction styling
 * @param {number} [duration=900] - Duration in ms for number count-up animation
 * @param {string} [className] - Optional custom CSS class
 * @param {Function} [onClick] - Optional click handler
 */
function StatCard({
  icon,
  label,
  value,
  statusAccent = 'blue',
  accent,
  prefix,
  suffix,
  subtext,
  trendText,
  isPositive,
  duration = 900,
  className = '',
  onClick,
}) {
  const effectiveAccent = (accent || statusAccent || 'blue').toLowerCase();
  const cardRef = useRef(null);
  const [hasAppeared, setHasAppeared] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  const { target, isDecimal, decimals, isNumeric } = parseTargetNumber(value);

  // Trigger count-up when card first appears in viewport
  useEffect(() => {
    if (!cardRef.current) return;

    if (!('IntersectionObserver' in window)) {
      setHasAppeared(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAppeared(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // Smooth quadratic ease-out count-up animation from 0
  useEffect(() => {
    if (!hasAppeared || !isNumeric || target === null) return;

    let startTimestamp = null;
    let animationFrameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Quadratic ease-out: subtle & professional, no bouncy easing
      const ease = 1 - (1 - progress) * (1 - progress);
      const current = ease * target;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(target);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [hasAppeared, isNumeric, target, duration]);

  // Format displayed number
  const formattedNumber = isNumeric
    ? isDecimal
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString()
    : value;

  // Determine accent class (fallback to blue)
  const accentClass = ['blue', 'green', 'red', 'amber'].includes(effectiveAccent)
    ? `stat-card-${effectiveAccent}`
    : 'stat-card-blue';

  return (
    <div
      ref={cardRef}
      className={`stat-card ${accentClass} ${onClick ? 'is-clickable' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Top Accent Stripe */}
      <div className="stat-card-accent-bar" />

      {/* Header: Label & Icon */}
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {icon && <div className="stat-card-icon-wrapper">{icon}</div>}
      </div>

      {/* Value: Number with optional Prefix/Suffix */}
      <div className="stat-card-value-row">
        {prefix && <span className="stat-card-prefix">{prefix}</span>}
        <span className="stat-card-number">{formattedNumber}</span>
        {suffix && <span className="stat-card-suffix">{suffix}</span>}
      </div>

      {/* Footer: Trend or Subtext */}
      {(subtext || trendText) && (
        <div className="stat-card-footer">
          {subtext && <span className="stat-card-subtext">{subtext}</span>}
          {trendText && (
            <span
              className={`stat-card-trend ${
                isPositive === true
                  ? 'trend-positive'
                  : isPositive === false
                  ? 'trend-negative'
                  : 'trend-neutral'
              }`}
            >
              {isPositive === true ? '↑ ' : isPositive === false ? '↓ ' : ''}
              {trendText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default StatCard;
