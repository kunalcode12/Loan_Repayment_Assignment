-- Initial schema for the loan repayment service.
--
-- Money is BIGINT paise throughout. There is no NUMERIC, REAL or DOUBLE
-- PRECISION column anywhere in this schema, so no monetary value can ever be
-- stored as a floating point type.
--
-- Interest rates are stored as integer basis points (18% p.a. -> 1800) for the
-- same reason: 18.75% has no exact binary float representation, but 1875 is an
-- exact integer.

-- Human-readable loan references (LN-001001, LN-001002, ...) are allocated by
-- the database so that two concurrent creates cannot collide.
CREATE SEQUENCE IF NOT EXISTS loan_reference_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS loans (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference                TEXT        NOT NULL
                                 DEFAULT ('LN-' || lpad(nextval('loan_reference_seq')::text, 6, '0')),
    principal_paise          BIGINT      NOT NULL,
    annual_interest_rate_bps INTEGER     NOT NULL,
    tenure_months            SMALLINT    NOT NULL,
    disbursement_date        DATE        NOT NULL,
    emi_paise                BIGINT      NOT NULL,
    total_interest_paise     BIGINT      NOT NULL,
    total_payable_paise      BIGINT      NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT loans_reference_unique UNIQUE (reference),
    CONSTRAINT loans_principal_positive CHECK (principal_paise > 0),
    CONSTRAINT loans_rate_range CHECK (annual_interest_rate_bps BETWEEN 0 AND 1000000),
    CONSTRAINT loans_tenure_positive CHECK (tenure_months > 0),
    CONSTRAINT loans_emi_positive CHECK (emi_paise > 0),
    CONSTRAINT loans_total_interest_non_negative CHECK (total_interest_paise >= 0),
    CONSTRAINT loans_total_payable_consistent
        CHECK (total_payable_paise = principal_paise + total_interest_paise)
);

CREATE TABLE IF NOT EXISTS installments (
    id                        UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id                   UUID     NOT NULL REFERENCES loans (id) ON DELETE CASCADE,
    installment_number        SMALLINT NOT NULL,
    due_date                  DATE     NOT NULL,
    principal_component_paise BIGINT   NOT NULL,
    interest_component_paise  BIGINT   NOT NULL,
    principal_paid_paise      BIGINT   NOT NULL DEFAULT 0,
    interest_paid_paise       BIGINT   NOT NULL DEFAULT 0,

    CONSTRAINT installments_loan_number_unique UNIQUE (loan_id, installment_number),
    CONSTRAINT installments_number_positive CHECK (installment_number > 0),
    CONSTRAINT installments_components_non_negative
        CHECK (principal_component_paise >= 0 AND interest_component_paise >= 0),
    CONSTRAINT installments_paid_non_negative
        CHECK (principal_paid_paise >= 0 AND interest_paid_paise >= 0),
    -- An instalment can never be paid beyond what it is worth. This is the
    -- database-level guarantee behind the allocation logic.
    CONSTRAINT installments_not_overpaid
        CHECK (principal_paid_paise <= principal_component_paise
           AND interest_paid_paise <= interest_component_paise)
);

-- A payment cannot exist without a loan: the column is NOT NULL *and* carries a
-- foreign key, so neither a missing loan id nor a dangling one is accepted, and
-- deleting a loan removes its payments rather than orphaning them.
CREATE TABLE IF NOT EXISTS payments (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id           UUID        NOT NULL REFERENCES loans (id) ON DELETE CASCADE,
    idempotency_key   TEXT        NOT NULL,
    amount_paise      BIGINT      NOT NULL,
    payment_date      DATE        NOT NULL,
    allocated_paise   BIGINT      NOT NULL DEFAULT 0,
    unallocated_paise BIGINT      NOT NULL DEFAULT 0,
    recorded_by       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- The duplicate-submission guarantee: a retry of the same request carries
    -- the same key and is rejected by the database, not just by application
    -- code, so two concurrent retries cannot both succeed.
    CONSTRAINT payments_idempotency_key_unique UNIQUE (idempotency_key),
    CONSTRAINT payments_amount_positive CHECK (amount_paise > 0),
    CONSTRAINT payments_split_non_negative
        CHECK (allocated_paise >= 0 AND unallocated_paise >= 0),
    -- Every paisa received is either allocated to an instalment or held as an
    -- explicit excess credit. Money can never go missing.
    CONSTRAINT payments_split_balances
        CHECK (allocated_paise + unallocated_paise = amount_paise)
);

CREATE TABLE IF NOT EXISTS payment_allocations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      UUID        NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
    installment_id  UUID        NOT NULL REFERENCES installments (id) ON DELETE CASCADE,
    interest_paise  BIGINT      NOT NULL DEFAULT 0,
    principal_paise BIGINT      NOT NULL DEFAULT 0,
    days_late       INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT payment_allocations_unique UNIQUE (payment_id, installment_id),
    CONSTRAINT payment_allocations_non_negative
        CHECK (interest_paise >= 0 AND principal_paise >= 0),
    CONSTRAINT payment_allocations_non_empty
        CHECK (interest_paise + principal_paise > 0),
    CONSTRAINT payment_allocations_days_late_non_negative CHECK (days_late >= 0)
);

CREATE INDEX IF NOT EXISTS installments_loan_due_date_idx
    ON installments (loan_id, due_date, installment_number);

CREATE INDEX IF NOT EXISTS payments_loan_created_idx
    ON payments (loan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_allocations_installment_idx
    ON payment_allocations (installment_id);

CREATE INDEX IF NOT EXISTS loans_created_at_idx
    ON loans (created_at DESC);
