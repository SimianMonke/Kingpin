# Admin Panel Architecture Reference

> Reference material for designing a global admin panel for the Kingpin game ecosystem.

---

## 1. Architectural Foundations

### Application State Taxonomy

The admin panel must manage three distinct strata of configuration data:

| Setting Type | Examples | Storage & Propagation | Admin Panel Role |
|--------------|----------|----------------------|------------------|
| **Static Infrastructure** | Database strings, AWS/GCP keys | `.env` files or Secret Managers (AWS Secrets/Vault) | Rarely modifies directly; interfaces with secret rotation tools |
| **Dynamic Logic** | Global drop rates, transaction fees, session timeouts | Persistent RDBMS (PostgreSQL) or Distributed KV stores | Primary domain for toggling "Maintenance Mode" or "Disable Registration" |
| **Feature Toggles** | New content previews, Beta UI rollouts, load shedding | Feature flagging systems or in-memory caches (Redis) | UI for granular targeting (e.g., "Enable for 50% of users") |

### Write-Through Caching Pattern

To prevent the admin panel from becoming a bottleneck during high-load events:

1. **Persistence**: Admin API writes changes to PostgreSQL for durability and audit history
2. **Cache Update**: Simultaneously update Redis (e.g., `game:config:maintenance_mode`)
3. **Application Read**: Game servers check Redis for sub-millisecond latency, ensuring instant global propagation

---

## 2. Security Architecture

### Zero Trust Network Access (ZTNA)

Replace traditional VPNs with identity-centric security:

- **Identity-Centric Authentication**: Access based on identity (SSO/MFA), not IP address
- **Device Posture Check**: Verify admin device health (OS patched, disk encrypted) before granting access
- **Micro-Segmentation**: Panel hidden from public internet, only accessible via ZTNA proxy

### Break Glass Emergency Protocol

For SSO provider outages (Okta, Azure AD):

- **Dedicated Account**: Maintain "Cloud-Only" accounts that bypass federation
- **Credential Hardening**: Use 25+ character randomly generated passwords; consider Shamir's Secret Sharing
- **Alarms**: Any login triggers immediate high-priority alerts to leadership

---

## 3. Governance Models

### Maker-Checker (Dual Control) Workflow

Required for high-stakes actions (currency rates, production config):

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Initiation │────▶│  PENDING_APPROVAL│────▶│   Review    │
│   (Maker)   │     │   Draft State    │     │  (Checker)  │
└─────────────┘     └─────────────────┘     └─────────────┘
```

1. **Initiation**: Operator proposes a change
2. **Draft State**: Change held as `PENDING_APPROVAL` in versioned table
3. **Review**: Different operator must approve the diff (Old vs New) before going live

### Cognitive Friction for Danger Zones

UX design as risk management:

- **Type-to-Confirm**: Force typing confirmation strings (e.g., `DELETE-PLAYER-DATA`)
- **Visual Warning States**: Red borders and warning icons for risky sections
- **Time-Delayed Execution**: "Cool Down" periods allowing cancellation for massive operations

---

## 4. Operational Resilience

### Circuit Breaker Management

The admin panel must provide:

| Breaker State | Meaning | Visual Indicator |
|---------------|---------|------------------|
| **Closed** | Healthy, requests flowing | 🟢 Green |
| **Open** | Failed, requests blocked | 🔴 Red |
| **Half-Open** | Testing recovery | 🟡 Yellow |

**Manual Override**: Allow admins to "Force Open" breakers when 3rd party providers (payment gateways) cause latency.

### Load Shedding Controls

For high-traffic events (launches, special events):

- **Feature Toggles**: Disable non-critical features (Friend Lists, Achievements) to preserve core gameplay
- **Dynamic Rate Limiting**: Adjust API request limits from dashboard to protect backend

---

## 5. Auditability

### Structured Audit Log Schema

Every action must produce an immutable, forensic-grade record:

```json
{
  "actor": {
    "user_id": "admin_12345",
    "ip_address": "192.168.1.100",
    "session_id": "sess_abc123"
  },
  "action": "UPDATE_ECONOMY_POLICY",
  "timestamp": "2024-01-15T14:30:00Z",
  "changes": {
    "field": "robbery_success_rate",
    "previous_value": 0.65,
    "new_value": 0.55
  },
  "metadata": {
    "approval_id": "approval_xyz",
    "reason": "Balancing adjustment per community feedback"
  }
}
```

### Immutability Requirements

- Use WORM (Write Once, Read Many) storage
- Ship logs in real-time to external services (Splunk, S3 with Object Lock)
- Maintain complete audit trail for compliance and forensics

---

## Implementation Priorities for Kingpin

### Phase 1: Core Admin Functions
- [ ] Player management (view, ban, adjust stats)
- [ ] Economy monitoring (currency in circulation, transaction logs)
- [ ] Basic feature toggles (maintenance mode, registration)

### Phase 2: Governance & Safety
- [ ] Role-based access control (RBAC)
- [ ] Maker-checker workflow for sensitive operations
- [ ] Confirmation dialogs for destructive actions

### Phase 3: Operational Tools
- [ ] Real-time metrics dashboard
- [ ] Circuit breaker visualization
- [ ] Load shedding controls

### Phase 4: Advanced Features
- [ ] Comprehensive audit logging
- [ ] Multi-platform analytics (Kick, Twitch, Stripe)
- [ ] Automated alerting system

---

## Key Design Principles

1. **Defense in Depth**: Multiple security layers, never rely on single control
2. **Principle of Least Privilege**: Grant minimum access necessary
3. **Audit Everything**: Every action creates an immutable record
4. **Graceful Degradation**: System remains functional under partial failure
5. **Human-Centered Safety**: UX prevents accidental destructive actions
