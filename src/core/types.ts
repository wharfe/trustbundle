// All timestamps are ISO 8601 strings (RFC 3339)
export type IsoDatetime = string;

// Normalized event unit within a bundle.
// Each adapter converts source-specific formats into this type.
export interface BundleEvent {
  id: string; // UUIDv7 recommended
  source: BundleEventSource;
  type: BundleEventType;
  timestamp: IsoDatetime;
  payload: Record<string, unknown>; // Source-specific data (normalized)
  metadata?: Record<string, unknown>;
}

export type BundleEventSource =
  | 'agentbond'
  | 'agent-trust-telemetry'
  | 'jsonl'
  | `custom:${string}`;

export type BundleEventType =
  | 'authorization_decision' // from agentbond
  | 'budget_consumed' // from agentbond
  | 'risk_event' // from middleware
  | 'audit_record' // generic
  | 'custom';

// Top-level bundle container
export interface TrustBundle {
  bundle_id: string; // UUIDv7
  schema_version: '0.1';
  created_at: IsoDatetime;
  run_id?: string; // Target run ID (optional)
  description?: string; // Description of this bundle
  events: BundleEvent[];
  event_count: number; // Redundant field for verification (must equal events.length)
  digest: BundleDigest;
  // signature is deferred to v0.2+
}

export interface BundleDigest {
  algorithm: 'sha256';
  value: string; // "sha256:<hex>"
  covers: 'events'; // Explicitly states what the digest covers
  computed_at: IsoDatetime;
}

// CLI configuration file (.trustbundle/config.json)
export interface TrustBundleConfig {
  version: '0.1';
  output_dir: string; // Default: ".trustbundle/bundles"
  default_run_id?: string;
}

// Adapter interface
export interface BundleAdapter {
  source: BundleEventSource;
  parse(input: string): Promise<BundleEvent[]>;
  validate(raw: unknown): boolean;
}

// Verification result type
export interface VerifyResult {
  valid: boolean;
  bundle_id: string;
  event_count: number;
  digest_algorithm: string;
  verified_at: IsoDatetime;
  reason?: VerifyFailureReason;
}

export type VerifyFailureReason =
  | 'DIGEST_MISMATCH' // Digest does not match (tampering detected)
  | 'SCHEMA_INVALID' // Schema validation failed
  | 'EVENT_COUNT_MISMATCH' // event_count and events.length differ
  | 'UNSUPPORTED_SCHEMA_VERSION'; // Unsupported schema_version
