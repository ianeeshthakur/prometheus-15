import React from 'react';
import './StatusBadge.css';

/**
 * Status resolution mapping: maps status strings to color variant & pulse behavior
 */
function resolveStatusConfig(rawStatus) {
  if (!rawStatus) {
    return { variant: 'gray', shouldPulse: false, defaultLabel: 'Unknown' };
  }

  const normalized = String(rawStatus).trim().toLowerCase();

  switch (normalized) {
    // Online / Active States: Green with gentle pulse
    case 'online':
    case 'active':
    case 'operational':
    case 'healthy':
    case 'live':
    case 'connected':
      return {
        variant: 'green',
        shouldPulse: true,
        defaultLabel: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      };

    // Offline / Inactive States: Gray, static (no pulse)
    case 'offline':
    case 'inactive':
    case 'disconnected':
    case 'disabled':
    case 'terminated':
    case 'stopped':
      return {
        variant: 'gray',
        shouldPulse: false,
        defaultLabel: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      };

    // Maintenance / Degraded States: Amber, static (no pulse)
    case 'maintenance':
    case 'degraded':
    case 'warning':
    case 'standby':
    case 'pending':
    case 'investigating':
      return {
        variant: 'amber',
        shouldPulse: false,
        defaultLabel: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      };

    // Alert / Critical / Error States: Red, static (no pulse)
    case 'alert':
    case 'critical':
    case 'error':
    case 'failed':
    case 'danger':
      return {
        variant: 'red',
        shouldPulse: false,
        defaultLabel: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      };

    // Informational / Info: Blue, static
    case 'info':
    case 'normal':
    case 'idle':
      return {
        variant: 'blue',
        shouldPulse: false,
        defaultLabel: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      };

    default:
      return {
        variant: 'gray',
        shouldPulse: false,
        defaultLabel: String(rawStatus),
      };
  }
}

/**
 * StatusBadge Component
 * Small pill-shaped status indicator with gentle pulse for online/active states
 *
 * @param {string} status - Status value (e.g. "Online", "Offline", "Maintenance", "Active", "Degraded", "Inactive")
 * @param {string} [label] - Optional custom display label
 * @param {'sm'|'md'|'lg'} [size='md'] - Size variant
 * @param {'green'|'gray'|'amber'|'red'|'blue'} [variant] - Explicit color override
 * @param {boolean} [pulse] - Explicit pulse override
 * @param {boolean} [showDot=true] - Whether to show the indicator dot
 * @param {string} [className] - Optional custom CSS class
 */
function StatusBadge({
  status,
  label,
  size = 'md',
  variant,
  pulse,
  showDot = true,
  className = '',
  ...restProps
}) {
  const resolved = resolveStatusConfig(status);

  const effectiveVariant = variant || resolved.variant;
  const effectivePulse = typeof pulse === 'boolean' ? pulse : resolved.shouldPulse;
  const displayText = label !== undefined ? label : resolved.defaultLabel;

  return (
    <span
      className={`status-badge status-badge-${size} status-badge-${effectiveVariant} ${className}`}
      {...restProps}
    >
      {showDot && (
        <span
          className={`status-badge-dot ${effectivePulse ? 'pulse' : ''}`}
          aria-hidden="true"
        />
      )}
      <span className="status-badge-text">{displayText}</span>
    </span>
  );
}

export default StatusBadge;
