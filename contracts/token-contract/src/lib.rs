#![no_std]

use soroban_sdk::token::TokenInterface;
use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, Env, String, Symbol};

mod admin;
mod allowance;
mod balance;
mod event;
mod metadata;
mod storage_types;

pub const MINT_TOPIC: Symbol = symbol_short!("MINT");
pub const BURN_TOPIC: Symbol = symbol_short!("BURN");
pub const TRANSFER_TOPIC: Symbol = symbol_short!("TRANSFER");
pub const FEE_TOPIC: Symbol = symbol_short!("FEE");
pub const ADMIN_TOPIC: Symbol = symbol_short!("ADMIN");

fn check_nonnegative_amount(amount: i128) {
    if amount < 0 {
        panic!("negative amount is not allowed: {}", amount)
    }
}

#[contract]
pub struct SoroswapToken;

#[contractimpl]
impl SoroswapToken {
    pub fn initialize(env: Env, admin: Address, decimal: u32, name: String, symbol: String) {
        if admin::has_administrator(&env) {
            panic!("already initialized")
        }
        admin::write_administrator(&env, &admin);
        metadata::write_metadata(
            &env,
            storage_types::TokenMetadata {
                decimal,
                name,
                symbol,
            },
        );
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        check_nonnegative_amount(amount);
        let admin = admin::read_administrator(&env);
        admin.require_auth();
        balance::receive_balance(&env, to.clone(), amount);
        event::mint(&env, to.clone(), to, amount);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin = admin::read_administrator(&env);
        admin.require_auth();
        admin::write_administrator(&env, &new_admin);
        event::set_admin(&env, admin, new_admin);
    }

    pub fn admin(env: Env) -> Address {
        admin::read_administrator(&env)
    }

    /// Self-serve testnet SST: the recipient signs; credits a fixed amount with a ledger cooldown.
    /// Avoids requiring a server-side admin key on Vercel. Do not treat this as mainnet-safe economics.
    pub fn claim_testnet_drip(env: Env, to: Address) {
        to.require_auth();
        const AMOUNT: i128 = 100 * 10_000_000; // 100 SST (7 decimals)
        const COOLDOWN_LEDGERS: u32 = 720; // ~1h if ~5s/ledger on testnet

        let key = storage_types::DataKey::TestnetDripLastLedger(to.clone());
        let ledger = env.ledger().sequence();
        if let Some(last) = env
            .storage()
            .persistent()
            .get::<storage_types::DataKey, u32>(&key)
        {
            let earliest = last.saturating_add(COOLDOWN_LEDGERS);
            if ledger < earliest {
                panic!("testnet drip cooldown");
            }
        }

        balance::receive_balance(&env, to.clone(), AMOUNT);
        env.storage().persistent().set(&key, &ledger);

        let admin = admin::read_administrator(&env);
        event::mint(&env, admin, to, AMOUNT);
    }
}

#[contractimpl]
impl token::Interface for SoroswapToken {
    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        allowance::read_allowance(&env, from, spender).amount
    }

    fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        check_nonnegative_amount(amount);
        allowance::write_allowance(
            &env,
            from.clone(),
            spender.clone(),
            amount,
            expiration_ledger,
        );
        event::approve(&env, from, spender, amount, expiration_ledger);
    }

    fn balance(env: Env, id: Address) -> i128 {
        balance::read_balance(&env, id)
    }

    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        check_nonnegative_amount(amount);

        balance::spend_balance(&env, from.clone(), amount);
        balance::receive_balance(&env, to.clone(), amount);

        event::transfer(&env, from, to, amount);
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        check_nonnegative_amount(amount);
        allowance::spend_allowance(&env, from.clone(), spender, amount);

        balance::spend_balance(&env, from.clone(), amount);
        balance::receive_balance(&env, to.clone(), amount);

        event::transfer(&env, from, to, amount);
    }

    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        check_nonnegative_amount(amount);
        balance::spend_balance(&env, from.clone(), amount);
        event::burn(&env, from, amount);
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        check_nonnegative_amount(amount);
        allowance::spend_allowance(&env, from.clone(), spender, amount);
        balance::spend_balance(&env, from.clone(), amount);
        event::burn(&env, from, amount);
    }

    fn decimals(env: Env) -> u32 {
        metadata::read_decimal(&env)
    }

    fn name(env: Env) -> String {
        metadata::read_name(&env)
    }

    fn symbol(env: Env) -> String {
        metadata::read_symbol(&env)
    }
}

#[cfg(test)]
mod tests;
