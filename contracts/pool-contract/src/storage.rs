use soroban_sdk::{contracttype, Address};

#[derive(Clone)]
#[contracttype]
pub struct PoolConfig {
    pub token_a: Address,
    pub token_b: Address,
    pub fee_to: Address,
}

#[derive(Clone)]
#[contracttype]
pub struct PoolReserves {
    pub reserve_a: i128,
    pub reserve_b: i128,
    pub total_lp: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Config,
    Reserves,
    LpBalance(Address),
}
