#![no_std]

//! SoroSwap Liquidity Pool Contract
//!
//! This contract implements a two-token AMM liquidity pool using the
//! constant product formula x*y=k. It calls the token contract for
//! all token transfers via inter-contract calls.
//!
//! Features:
//! - Add liquidity (receive LP tokens)
//! - Remove liquidity (burn LP tokens)
//! - Swap token_a for token_b and vice versa
//! - 0.3% swap fee distributed to liquidity providers
//! - Event emission for all operations

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, Symbol,
    IntoVal,
};

mod event;
mod storage;

use storage::{DataKey, PoolConfig, PoolReserves};

pub const MINIMUM_LIQUIDITY: i128 = 1000;
pub const FEE_BPS: i128 = 30; // 0.30%

#[contract]
pub struct SoroswapPool;

fn get_reserves(env: &Env) -> PoolReserves {
    env.storage()
        .instance()
        .get(&DataKey::Reserves)
        .unwrap_or(PoolReserves {
            reserve_a: 0,
            reserve_b: 0,
            total_lp: 0,
        })
}

fn save_reserves(env: &Env, reserves: &PoolReserves) {
    env.storage().instance().set(&DataKey::Reserves, reserves);
    env.storage()
        .instance()
        .extend_ttl(500_000, 500_000);
}

fn lp_balance(env: &Env, account: &Address) -> i128 {
    env.storage()
        .persistent()
        .get::<DataKey, i128>(&DataKey::LpBalance(account.clone()))
        .unwrap_or(0)
}

fn set_lp_balance(env: &Env, account: &Address, amount: i128) {
    let key = DataKey::LpBalance(account.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage().persistent().extend_ttl(&key, 500_000, 500_000);
}

fn sqrt(y: i128) -> i128 {
    if y < 4 {
        if y == 0 { 0 } else { 1 }
    } else {
        let mut z = y;
        let mut x = y / 2 + 1;
        while x < z {
            z = x;
            x = (y / x + x) / 2;
        }
        z
    }
}

#[contractimpl]
impl SoroswapPool {
    /// Initialize the pool with two token addresses
    pub fn initialize(env: Env, token_a: Address, token_b: Address, fee_to: Address) {
        if env.storage().instance().has(&DataKey::Config) {
            panic!("already initialized");
        }
        let config = PoolConfig {
            token_a: token_a.clone(),
            token_b: token_b.clone(),
            fee_to,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage()
            .instance()
            .extend_ttl(500_000, 500_000);

        event::initialized(&env, token_a, token_b);
    }

    /// Add liquidity to the pool
    /// Returns the LP tokens minted
    pub fn add_liquidity(
        env: Env,
        provider: Address,
        amount_a: i128,
        amount_b: i128,
    ) -> i128 {
        provider.require_auth();

        if amount_a <= 0 || amount_b <= 0 {
            panic!("amounts must be positive");
        }

        let config: PoolConfig = env.storage().instance().get(&DataKey::Config).unwrap();
        let reserves = get_reserves(&env);

        // — Inter-contract call: transfer token_a from provider to pool —
        let token_a_client = token::Client::new(&env, &config.token_a);
        token_a_client.transfer_from(&env.current_contract_address(), &provider, &env.current_contract_address(), &amount_a);

        // — Inter-contract call: transfer token_b from provider to pool —
        let token_b_client = token::Client::new(&env, &config.token_b);
        token_b_client.transfer_from(&env.current_contract_address(), &provider, &env.current_contract_address(), &amount_b);

        // Compute LP tokens to mint
        let lp_minted = if reserves.total_lp == 0 {
            // Initial liquidity
            let lp = sqrt(amount_a * amount_b) - MINIMUM_LIQUIDITY;
            if lp <= 0 {
                panic!("insufficient initial liquidity");
            }
            lp
        } else {
            // Proportional minting
            let lp_from_a = amount_a * reserves.total_lp / reserves.reserve_a;
            let lp_from_b = amount_b * reserves.total_lp / reserves.reserve_b;
            lp_from_a.min(lp_from_b)
        };

        if lp_minted <= 0 {
            panic!("insufficient liquidity minted");
        }

        let new_lp = lp_balance(&env, &provider) + lp_minted;
        set_lp_balance(&env, &provider, new_lp);

        save_reserves(
            &env,
            &PoolReserves {
                reserve_a: reserves.reserve_a + amount_a,
                reserve_b: reserves.reserve_b + amount_b,
                total_lp: reserves.total_lp + lp_minted,
            },
        );

        event::add_liquidity(&env, provider, amount_a, amount_b, lp_minted);
        lp_minted
    }

    /// Remove liquidity from the pool by burning LP tokens
    pub fn remove_liquidity(
        env: Env,
        provider: Address,
        lp_amount: i128,
    ) -> (i128, i128) {
        provider.require_auth();

        let current_lp = lp_balance(&env, &provider);
        if current_lp < lp_amount {
            panic!("insufficient LP tokens");
        }

        let config: PoolConfig = env.storage().instance().get(&DataKey::Config).unwrap();
        let reserves = get_reserves(&env);

        // Proportional withdrawal
        let amount_a = lp_amount * reserves.reserve_a / reserves.total_lp;
        let amount_b = lp_amount * reserves.reserve_b / reserves.total_lp;

        if amount_a <= 0 || amount_b <= 0 {
            panic!("insufficient output amounts");
        }

        // Burn LP tokens
        set_lp_balance(&env, &provider, current_lp - lp_amount);

        save_reserves(
            &env,
            &PoolReserves {
                reserve_a: reserves.reserve_a - amount_a,
                reserve_b: reserves.reserve_b - amount_b,
                total_lp: reserves.total_lp - lp_amount,
            },
        );

        // — Inter-contract calls: send tokens back to provider —
        let token_a_client = token::Client::new(&env, &config.token_a);
        token_a_client.transfer(&env.current_contract_address(), &provider, &amount_a);

        let token_b_client = token::Client::new(&env, &config.token_b);
        token_b_client.transfer(&env.current_contract_address(), &provider, &amount_b);

        event::remove_liquidity(&env, provider, amount_a, amount_b, lp_amount);
        (amount_a, amount_b)
    }

    /// Swap token_a for token_b (buy_b = true) or token_b for token_a
    pub fn swap(
        env: Env,
        user: Address,
        buy_b: bool,
        amount_in: i128,
        min_out: i128,
    ) -> i128 {
        user.require_auth();

        if amount_in <= 0 {
            panic!("amount_in must be positive");
        }

        let config: PoolConfig = env.storage().instance().get(&DataKey::Config).unwrap();
        let reserves = get_reserves(&env);

        // constant product with 0.3% fee
        let amount_in_with_fee = amount_in * (10000 - FEE_BPS);
        let amount_out;
        let new_reserve_a;
        let new_reserve_b;

        let fee_amount = amount_in * FEE_BPS / 10000;

        if buy_b {
            // swap A → B
            let numerator = amount_in_with_fee * reserves.reserve_b;
            let denominator = reserves.reserve_a * 10000 + amount_in_with_fee;
            amount_out = numerator / denominator;

            if amount_out < min_out {
                panic!("insufficient output: slippage exceeded");
            }

            // Inter-contract call: receive token_a from user via transfer_from
            let token_a_client = token::Client::new(&env, &config.token_a);
            token_a_client.transfer_from(&env.current_contract_address(), &user, &env.current_contract_address(), &amount_in);

            // Distribute fee to LP (stays in reserves as token_a)
            new_reserve_a = reserves.reserve_a + amount_in;
            new_reserve_b = reserves.reserve_b - amount_out;

            // Inter-contract call: send token_b to user
            let token_b_client = token::Client::new(&env, &config.token_b);
            token_b_client.transfer(&env.current_contract_address(), &user, &amount_out);

            event::swap(&env, user, config.token_a, config.token_b, amount_in, amount_out, fee_amount);
        } else {
            // swap B → A
            let numerator = amount_in_with_fee * reserves.reserve_a;
            let denominator = reserves.reserve_b * 10000 + amount_in_with_fee;
            amount_out = numerator / denominator;

            if amount_out < min_out {
                panic!("insufficient output: slippage exceeded");
            }

            // Inter-contract call: receive token_b from user via transfer_from
            let token_b_client = token::Client::new(&env, &config.token_b);
            token_b_client.transfer_from(&env.current_contract_address(), &user, &env.current_contract_address(), &amount_in);

            new_reserve_a = reserves.reserve_a - amount_out;
            new_reserve_b = reserves.reserve_b + amount_in;

            // Inter-contract call: send token_a to user
            let token_a_client = token::Client::new(&env, &config.token_a);
            token_a_client.transfer(&env.current_contract_address(), &user, &amount_out);

            event::swap(&env, user, config.token_b, config.token_a, amount_in, amount_out, fee_amount);
        }

        save_reserves(
            &env,
            &PoolReserves {
                reserve_a: new_reserve_a,
                reserve_b: new_reserve_b,
                total_lp: reserves.total_lp,
            },
        );

        amount_out
    }

    // ─── View functions ───────────────────────────────────────────

    pub fn get_reserves(env: Env) -> PoolReserves {
        get_reserves(&env)
    }

    pub fn get_lp_balance(env: Env, account: Address) -> i128 {
        lp_balance(&env, &account)
    }

    pub fn get_config(env: Env) -> PoolConfig {
        env.storage().instance().get(&DataKey::Config).unwrap()
    }

    /// Quote: compute output for given input using current reserves
    pub fn quote(env: Env, buy_b: bool, amount_in: i128) -> i128 {
        let reserves = get_reserves(&env);
        if reserves.reserve_a == 0 || reserves.reserve_b == 0 {
            return 0;
        }
        let amount_in_with_fee = amount_in * (10000 - FEE_BPS);
        if buy_b {
            let numerator = amount_in_with_fee * reserves.reserve_b;
            let denominator = reserves.reserve_a * 10000 + amount_in_with_fee;
            numerator / denominator
        } else {
            let numerator = amount_in_with_fee * reserves.reserve_a;
            let denominator = reserves.reserve_b * 10000 + amount_in_with_fee;
            numerator / denominator
        }
    }
}

#[cfg(test)]
mod tests;
