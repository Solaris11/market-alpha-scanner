INSERT INTO legal_documents (type, version, content)
VALUES
    (
        'terms',
        'tradeveto-v1',
        'TradeVeto is research software. It is not a broker, investment adviser, fiduciary, tax adviser, or legal adviser. You are responsible for every trading and investment decision you make while using the product. Use the product at your own risk.'
    ),
    (
        'privacy',
        'tradeveto-v1',
        'TradeVeto stores account, session, watchlist, risk profile, paper trading, alert, analytics, feedback, and subscription data needed to operate the service. Do not submit information you are not authorized to provide.'
    ),
    (
        'risk',
        'tradeveto-v1',
        'TradeVeto does not provide financial advice. Trading and investing involve risk, and you can lose money. Signals, simulations, scanner output, alerts, and risk tools are educational decision support only. Use at your own risk.'
    )
ON CONFLICT (type, version)
DO UPDATE SET content = EXCLUDED.content;
