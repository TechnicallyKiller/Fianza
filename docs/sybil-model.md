# Sybil / counterparty-independence model

Counterparty independence is the core open research bet (see README, "Risk model
and economics"). MVP mitigation: count revenue only from a minimum number of
independently-identified counterparties, weight zkTLS-proved off-chain revenue
more heavily, and keep the two facilitator-side addresses on an explicit exclude
list. Robust anti-Sybil heuristics are out of scope for v1 and tracked here.
