use anchor_lang::prelude::*;

// ---------------------------------------------------------------------------
// Program ID — replace with the actual address after `anchor deploy`
// ---------------------------------------------------------------------------
declare_id!("DquVDUN6FuMc3362tYhkgdKPiKrmfRhMX9KYdQ547r5R");

// ---------------------------------------------------------------------------
// Threat-level constants (must match Python mapping: LOW=0..CRITICAL=3)
// ---------------------------------------------------------------------------
pub const THREAT_LOW: u8 = 0;
pub const THREAT_MEDIUM: u8 = 1;
pub const THREAT_HIGH: u8 = 2;
pub const THREAT_CRITICAL: u8 = 3;

/// Maximum byte length of an IPFS CID string stored on-chain.
pub const MAX_CID_LEN: usize = 64;

// ---------------------------------------------------------------------------
// The PhantomID Anchor program
// ---------------------------------------------------------------------------
#[program]
pub mod phantom_anchor {
    use super::*;

    /// Record an identity-threat event on-chain.
    ///
    /// This is the **only** instruction in this program.  Do not add more.
    ///
    /// # Arguments
    /// * `user_pseudonym`  – Raw bytes of a SHA-256 hash of the user identifier.
    ///                       NEVER the raw identifier itself.
    /// * `report_cid`      – IPFS CID string (max 64 chars) returned by Pinata.
    /// * `report_hash`     – SHA-256 of the full JSON report uploaded to IPFS.
    /// * `threat_level`    – 0=LOW  1=MEDIUM  2=HIGH  3=CRITICAL
    /// * `timestamp`       – Unix timestamp (seconds, UTC).
    pub fn record_threat_event(
        ctx: Context<RecordThreatEvent>,
        user_pseudonym: [u8; 32],
        report_cid: String,
        report_hash: [u8; 32],
        threat_level: u8,
        timestamp: i64,
    ) -> Result<()> {
        // ---- Validation ------------------------------------------------
        require!(
            report_cid.len() <= MAX_CID_LEN,
            PhantomError::CidTooLong
        );
        require!(
            threat_level <= THREAT_CRITICAL,
            PhantomError::InvalidThreatLevel
        );
        require!(timestamp > 0, PhantomError::InvalidTimestamp);

        // ---- Persist ---------------------------------------------------
        let event = &mut ctx.accounts.threat_event;
        event.user_pseudonym = user_pseudonym;
        event.report_cid = report_cid;
        event.report_hash = report_hash;
        event.threat_level = threat_level;
        event.timestamp = timestamp;
        event.authority = ctx.accounts.authority.key();
        event.bump = ctx.bumps.threat_event;

        emit!(ThreatEventRecorded {
            user_pseudonym,
            report_cid: event.report_cid.clone(),
            report_hash,
            threat_level,
            timestamp,
        });

        msg!(
            "PhantomID: threat event recorded | level={} | cid={}",
            threat_level,
            event.report_cid
        );

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Account contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(
    user_pseudonym: [u8; 32],
    report_cid: String,
    report_hash: [u8; 32],
    threat_level: u8,
    timestamp: i64
)]
pub struct RecordThreatEvent<'info> {
    /// The PDA that holds this event's data.
    /// Seeds: ["threat_event", user_pseudonym, report_hash]
    /// This ensures one on-chain account per unique (user, report) pair.
    #[account(
        init,
        payer = authority,
        space = ThreatEventAccount::space(&report_cid),
        seeds = [
            b"threat_event".as_ref(),
            user_pseudonym.as_ref(),
            report_hash.as_ref(),
        ],
        bump
    )]
    pub threat_event: Account<'info, ThreatEventAccount>,

    /// The signer paying for the account rent.
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// Account state
// ---------------------------------------------------------------------------

#[account]
#[derive(Default)]
pub struct ThreatEventAccount {
    /// SHA-256 of the user identifier — never raw PII.
    pub user_pseudonym: [u8; 32],
    /// IPFS CID of the full report JSON (max 64 bytes).
    pub report_cid: String,
    /// SHA-256 of the uploaded report JSON bytes.
    pub report_hash: [u8; 32],
    /// 0=LOW  1=MEDIUM  2=HIGH  3=CRITICAL
    pub threat_level: u8,
    /// Unix timestamp (seconds, UTC).
    pub timestamp: i64,
    /// The authority that created this record.
    pub authority: Pubkey,
    /// PDA bump seed.
    pub bump: u8,
}

impl ThreatEventAccount {
    /// Discriminator (8) + user_pseudonym (32) + report_cid (4 + len) +
    /// report_hash (32) + threat_level (1) + timestamp (8) +
    /// authority (32) + bump (1)
    pub fn space(report_cid: &str) -> usize {
        8   // discriminator
        + 32  // user_pseudonym
        + 4 + report_cid.len().min(MAX_CID_LEN)  // report_cid (string prefix + bytes)
        + 32  // report_hash
        + 1   // threat_level
        + 8   // timestamp
        + 32  // authority
        + 1   // bump
    }
}

// ---------------------------------------------------------------------------
// Events (emitted on-chain, indexable by client)
// ---------------------------------------------------------------------------

#[event]
pub struct ThreatEventRecorded {
    pub user_pseudonym: [u8; 32],
    pub report_cid: String,
    pub report_hash: [u8; 32],
    pub threat_level: u8,
    pub timestamp: i64,
}

// ---------------------------------------------------------------------------
// Custom errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum PhantomError {
    #[msg("report_cid exceeds the maximum allowed length of 64 characters")]
    CidTooLong,
    #[msg("threat_level must be 0 (LOW), 1 (MEDIUM), 2 (HIGH), or 3 (CRITICAL)")]
    InvalidThreatLevel,
    #[msg("timestamp must be a positive Unix epoch value")]
    InvalidTimestamp,
}
