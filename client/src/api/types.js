/**
 * G-VISTA Type Definitions and Constants
 * Aligned with backend schemas across Pipelines 1 to 5
 */

export const ProtocolType = {
  RTSP: 'RTSP',
  HLS: 'HLS',
  ONVIF: 'ONVIF',
  VENDOR_SDK: 'VENDOR_SDK',
};

export const CameraStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DEGRADED: 'DEGRADED',
  OFFLINE: 'OFFLINE',
};

export const EntityType = {
  PERSON: 'PERSON',
  VEHICLE: 'VEHICLE',
  LICENSE_PLATE: 'LICENSE_PLATE',
  OBJECT: 'OBJECT',
  CAMERA: 'CAMERA',
  LOCATION: 'LOCATION',
  EVENT: 'EVENT',
};

export const OperationalStatus = {
  CANDIDATE: 'Candidate',
  NEEDS_REVIEW: 'Needs Review',
  UNDER_REVIEW: 'Under Review',
  ACKNOWLEDGED: 'Acknowledged',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

export const AlertPriority = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export const GUJARAT_DISTRICTS = [
  'Ahmedabad',
  'Surat',
  'Vadodara',
  'Rajkot',
  'Gandhinagar',
  'Bhavnagar',
  'Jamnagar',
  'Junagadh',
  'Kutch',
];

export const DEPARTMENTS = [
  'Police',
  'Traffic',
  'Municipal',
  'Food Safety',
  'Civil Supplies',
  'Health',
];
