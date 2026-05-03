CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS legal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_documents_type_version
ON legal_documents(type, version);

CREATE TABLE IF NOT EXISTS legal_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_user ON legal_acceptances(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_acceptances_user_doc_version
ON legal_acceptances(user_id, document_type, document_version);

INSERT INTO legal_documents (type, version, content)
VALUES
    (
        'terms',
        'v1',
        'Market Alpha Scanner is research software. It is not a broker, investment adviser, fiduciary, tax adviser, or legal adviser. You are responsible for every trading and investment decision you make while using the product. Use the product at your own risk.'
    ),
    (
        'privacy',
        'v1',
        'Market Alpha Scanner stores account, session, watchlist, risk profile, paper trading, alert, and subscription data needed to operate the service. Do not submit information you are not authorized to provide.'
    ),
    (
        'risk',
        'v1',
        'Market Alpha Scanner does not provide financial advice. Trading and investing involve risk, and you can lose money. Signals, simulations, scanner output, alerts, and risk tools are educational decision support only. Use at your own risk.'
    )
ON CONFLICT (type, version)
DO UPDATE SET content = EXCLUDED.content;
