use soroban_sdk::{contracttype, Address};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Token,
    RewardRate, // Rewards per second per 10000 tokens
    UserBalance(Address),
    UserLastUpdated(Address),
    UserPendingRewards(Address),
}
