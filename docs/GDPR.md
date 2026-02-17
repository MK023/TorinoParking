# GDPR Compliance - Data Protection & Privacy

> **Stato attuale:** Questo documento e' una guida di compliance per quando
> verranno implementate funzionalita' utente. Attualmente l'API gestisce
> esclusivamente dati pubblici sui parcheggi (dati open data 5T/GTT) e
> **non raccoglie ne' tratta dati personali (PII)**.
>
> Non esistono ancora: tabelle utenti, autenticazione JWT, endpoint GDPR,
> encryption at rest con Fernet, o task Celery. Queste sono tutte
> funzionalita' pianificate descritte come riferimento.

Guida alla compliance GDPR per l'app Parking Torino.

## Principi GDPR Fondamentali

### 1. Data Minimization (Art. 5.1.c)

**Regola d'oro:** Raccogli SOLO ciò che è strettamente necessario.

```python
# ❌ BAD - Too much data
class User(BaseModel):
    full_name: str
    email: str
    phone: str
    address: str
    license_plate: str  # NON NECESSARIO!

# ✅ GOOD - Minimal data
class User(BaseModel):
    id: UUID  # Anonymous identifier
    created_at: datetime
    favorite_parkings: list[str]  # Anonymous preferences
```

**Per la tua app:**
- ✅ ID dispositivo anonimo (UUID)
- ✅ Parcheggi preferiti
- ✅ Preferenze notifiche
- ❌ NO targhe auto
- ❌ NO nome/cognome (a meno che necessario)
- ❌ NO email (a meno che notifiche richieste)

### 2. Lawful Basis (Art. 6)

Ogni dato deve avere una base legale:

| Dato | Base Legale | Quando |
|------|-------------|---------|
| Posizione GPS | Legitimate interest | Solo quando app attiva |
| Parcheggi preferiti | Legitimate interest | Funzionalità core |
| Email | Consent | Solo se utente vuole notifiche |
| Analytics anonimi | Legitimate interest | Miglioramento servizio |

### 3. Consent Management (Art. 7)

**Consenso VALIDO:**
```python
# Must be:
- ✅ Freely given (no pre-checked boxes)
- ✅ Specific (granular: marketing, analytics separate)
- ✅ Informed (clear language)
- ✅ Unambiguous (affirmative action)
- ✅ Withdrawable (easy opt-out)
```

**Implementazione:**
```python
class UserConsents(BaseModel):
    user_id: UUID
    
    # Granular consents
    marketing_emails: bool = False
    analytics: bool = False  
    push_notifications: bool = False
    
    # Metadata (GDPR requirement)
    consent_date: datetime
    consent_ip: str
    consent_text_shown: str  # What user saw when consenting
    
    # Withdrawal
    withdrawn_at: datetime | None = None

# Record consent
async def record_consent(user_id: UUID, consents: dict, request: Request):
    await db.execute(
        """
        INSERT INTO user_consents 
        (user_id, marketing_emails, analytics, push_notifications,
         consent_date, consent_ip, consent_text_shown)
        VALUES (:user_id, :marketing, :analytics, :push, NOW(), :ip, :text)
        """,
        {
            "user_id": user_id,
            "marketing": consents["marketing"],
            "ip": request.client.host,
            "text": "I agree to receive marketing emails..."
        }
    )
```

## User Rights Implementation

### Right to Access (Art. 15)

Utente può richiedere export di TUTTI i suoi dati.

```python
# app/api/v1/endpoints/gdpr.py
from fastapi import APIRouter

router = APIRouter(prefix="/gdpr", tags=["GDPR"])

@router.get("/export")
async def export_my_data(
    current_user: User = Depends(get_current_user)
):
    """
    Export all user data in machine-readable format
    Must respond within 30 days (GDPR requirement)
    """
    # Collect ALL user data
    data = {
        "user_info": {
            "id": current_user.id,
            "created_at": current_user.created_at.isoformat()
        },
        "favorites": await get_user_favorites(current_user.id),
        "notification_prefs": await get_notification_prefs(current_user.id),
        "consents": await get_user_consents(current_user.id),
        "activity_log": await get_user_activity(current_user.id),
    }
    
    # Log export request (audit trail)
    await log_gdpr_action(
        user_id=current_user.id,
        action="data_export",
        ip=request.client.host
    )
    
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "format": "JSON",
        "data": data
    }
```

### Right to Erasure (Art. 17) - "Right to be Forgotten"

```python
@router.delete("/delete-account")
async def request_deletion(
    current_user: User = Depends(get_current_user)
):
    """
    Request account deletion
    Grace period: 30 days (best practice)
    """
    # Soft delete with grace period
    await db.execute(
        """
        UPDATE users 
        SET deletion_requested_at = NOW()
        WHERE id = :user_id
        """,
        {"user_id": current_user.id}
    )
    
    # Send confirmation email
    await send_email(
        to=current_user.email,
        subject="Account Deletion Requested",
        body=f"""
        Your account deletion has been requested.
        
        Deletion will occur on: {deletion_date}
        
        To cancel, log in before this date.
        """
    )
    
    await log_gdpr_action(
        user_id=current_user.id,
        action="deletion_requested"
    )
    
    return {
        "message": "Deletion requested successfully",
        "deletion_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
        "grace_period_days": 30
    }

@router.post("/cancel-deletion")
async def cancel_deletion(current_user: User = Depends(get_current_user)):
    """Allow user to cancel deletion request"""
    await db.execute(
        """
        UPDATE users 
        SET deletion_requested_at = NULL
        WHERE id = :user_id
        """,
        {"user_id": current_user.id}
    )
    
    return {"message": "Deletion cancelled"}

# Scheduled task - Execute deletions (esempio, non implementato)
def execute_pending_deletions():
    """
    Run daily - permanently delete users past grace period
    """
    cutoff_date = datetime.utcnow() - timedelta(days=30)
    
    # Find users to delete
    users = db.execute(
        """
        SELECT id FROM users
        WHERE deletion_requested_at < :cutoff
          AND deleted_at IS NULL
        """,
        {"cutoff": cutoff_date}
    ).fetchall()
    
    for user in users:
        # Cascade delete all related data
        await permanently_delete_user(user.id)
        
        logger.info(f"Permanently deleted user {user.id}")
```

### Right to Rectification (Art. 16)

```python
@router.put("/update-data")
async def update_my_data(
    updates: UserDataUpdate,
    current_user: User = Depends(get_current_user)
):
    """Allow user to correct their data"""
    await db.execute(
        """
        UPDATE users 
        SET email = :email, 
            updated_at = NOW()
        WHERE id = :user_id
        """,
        {"email": updates.email, "user_id": current_user.id}
    )
    
    return {"message": "Data updated successfully"}
```

### Right to Data Portability (Art. 20)

```python
@router.get("/export-portable")
async def export_portable_format(
    current_user: User = Depends(get_current_user)
):
    """
    Export in common format that can be imported elsewhere
    CSV, JSON, or XML
    """
    data = await export_my_data(current_user)
    
    # Convert to CSV for portability
    import csv
    from io import StringIO
    
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=["type", "data"])
    writer.writeheader()
    
    for key, value in data["data"].items():
        writer.writerow({"type": key, "data": str(value)})
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=parking_data_{current_user.id}.csv"
        }
    )
```

## Database Schema GDPR-Compliant

```sql
-- Users table (minimal data)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Preferences (non-PII)
    favorite_parkings JSONB DEFAULT '[]',
    notification_prefs JSONB,
    
    -- GDPR tracking
    gdpr_consent_marketing BOOLEAN DEFAULT false,
    gdpr_consent_analytics BOOLEAN DEFAULT false,
    gdpr_consent_date TIMESTAMPTZ,
    
    -- Deletion tracking
    deletion_requested_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- Sensitive data (if absolutely necessary)
-- Separate table, encrypted
CREATE TABLE user_sensitive_data (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Always encrypted
    encrypted_email BYTEA,  -- AES-256-GCM
    
    -- Retention policy
    data_retention_until DATE NOT NULL,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed TIMESTAMPTZ
);

-- GDPR audit log (mandatory!)
CREATE TABLE gdpr_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,  -- 'access', 'export', 'delete', 'consent_update'
    performed_by VARCHAR(100),
    details JSONB,
    ip_address INET,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for compliance queries
CREATE INDEX idx_audit_user_action ON gdpr_audit_log(user_id, action, timestamp);
```

## Data Encryption

> **Non implementato.** Le sezioni seguenti sono riferimento per implementazione futura.

### Encryption at Rest (pianificato)

```python
from cryptography.fernet import Fernet

class DataProtection:
    """Encrypt/decrypt sensitive data"""
    
    def __init__(self):
        # Key from environment (NEVER in code!)
        self.cipher = Fernet(settings.ENCRYPTION_KEY.encode())
    
    def encrypt(self, plaintext: str) -> bytes:
        """Encrypt string to bytes"""
        return self.cipher.encrypt(plaintext.encode())
    
    def decrypt(self, ciphertext: bytes) -> str:
        """Decrypt bytes to string"""
        return self.cipher.decrypt(ciphertext).decode()

# Usage
dp = DataProtection()

# Save email encrypted
encrypted_email = dp.encrypt(user.email)
await db.execute(
    "INSERT INTO user_sensitive_data (user_id, encrypted_email) VALUES (:uid, :email)",
    {"uid": user.id, "email": encrypted_email}
)

# Retrieve and decrypt
row = await db.fetchone("SELECT encrypted_email FROM user_sensitive_data WHERE user_id = :uid")
email = dp.decrypt(row.encrypted_email)
```

### Hashing (One-Way)

```python
import hashlib

def hash_for_analytics(value: str) -> str:
    """
    Hash for analytics (non-reversible)
    Use when you need to count unique values but don't need original
    """
    return hashlib.sha256(
        (value + settings.HASH_SALT).encode()
    ).hexdigest()

# Example: count unique devices without storing device IDs
device_hash = hash_for_analytics(device_id)
# Store hash, not original device_id
```

## Privacy Policy Template

```markdown
# Privacy Policy - Parking Torino App

**Effective Date:** 2025-02-11
**Last Updated:** 2025-02-11

## 1. Data Controller
[Your Name/Company]
Email: privacy@parkingapp.com
Address: [Your Address]

## 2. Data We Collect

### 2.1 Data We DO NOT Collect
- ❌ License plates
- ❌ Full name
- ❌ Physical address
- ❌ Continuous location tracking

### 2.2 Anonymous Data (No Consent Required)
- Anonymous device ID (UUID)
- App usage statistics (crashes, performance)
- Parking search queries (anonymized)

### 2.3 Data With Your Consent
- Email address (only if you want notifications)
- Push notification token (for alerts)
- Location data (only when app is active)

## 3. Legal Basis (GDPR Art. 6)
- **Legitimate Interest:** Providing parking availability service
- **Consent:** Email notifications, push alerts
- **Contract:** Premium features (if applicable)

## 4. How We Use Your Data
- Show nearby parking availability
- Save your favorite parkings (local to your device)
- Send notifications about parking availability (if consented)
- Improve app quality (crash analytics)

## 5. Data Sharing
- **5T Torino:** We query their public API (no personal data shared)
- **Fly.io:** Hosting provider (servers in EU)
- **Sentry:** Anonymous crash reports
- **Firebase:** Push notification delivery (only device token)

We do NOT sell your data. Ever.

## 6. Data Retention
- Favorites: Until you delete your account
- Analytics: 90 days, then anonymized
- Crash logs: 30 days
- Email (if provided): Until withdrawal of consent

## 7. Your Rights (GDPR Art. 15-22)

You have the right to:
- **Access** your data (download everything)
- **Rectify** incorrect data
- **Delete** your account ("right to be forgotten")
- **Port** your data to another service
- **Object** to processing
- **Withdraw consent** anytime

To exercise these rights: privacy@parkingapp.com

Response time: Maximum 30 days

## 8. Data Security
- TLS 1.3 encryption for all data in transit
- Database encryption at rest
- Regular security audits
- No access to your data without legal requirement

## 9. Cookies
We use ONLY essential cookies for:
- Session management
- Security (CSRF protection)

NO tracking cookies. NO advertising cookies.

## 10. Children's Privacy
This app is not intended for children under 16.

## 11. International Transfers
Data stored in EU (Fly.io Frankfurt datacenter).
If you're outside EU, your data may cross borders.

## 12. Data Breach Notification
In case of breach affecting your data:
- We notify you within 72 hours
- We notify authorities as required by GDPR

## 13. Changes to This Policy
We'll notify you 30 days before substantial changes.
Continued use = acceptance of new terms.

## 14. Contact Us
- Email: privacy@parkingapp.com
- Data Protection Officer: [If applicable]
- Complaints: Italian Data Protection Authority (Garante)

## 15. Cookies Banner Text
"We use only essential cookies for security and session management. 
No tracking. No advertising. [Accept] [Learn More]"
```

## GDPR Compliance Checklist

```markdown
## Pre-Launch Checklist

### Documentation
- [ ] Privacy Policy written and published
- [ ] Terms of Service (if applicable)
- [ ] Cookie Policy
- [ ] Data Processing Agreement (with hosting provider)

### Implementation
- [ ] GDPR endpoints (/export, /delete) working
- [ ] Consent management implemented
- [ ] Data minimization verified
- [ ] Encryption at rest enabled
- [ ] Audit logging active

### Testing
- [ ] Test data export (Art. 15)
- [ ] Test data deletion (Art. 17)
- [ ] Test consent withdrawal
- [ ] Verify no PII in logs
- [ ] Check retention periods enforced

### Legal
- [ ] Privacy Policy reviewed by lawyer (recommended)
- [ ] DPO appointed (if required)
- [ ] Data Processing Register maintained
- [ ] Incident response plan documented

### Third Parties
- [ ] List all data processors (Fly.io, Sentry, etc)
- [ ] Verify they're GDPR compliant
- [ ] Data Processing Agreements signed

### Ongoing
- [ ] Annual GDPR compliance audit
- [ ] Regular privacy policy review
- [ ] Staff training on data protection
- [ ] Monitor for data breaches
```

## Penalties for Non-Compliance

**GDPR fines:**
- Up to €20 million OR
- 4% of annual global turnover

**Whichever is higher!**

**Non è uno scherzo.** Compliance è CRITICA.
