#![no_std]

use soroban_sdk::token::TokenInterface;
use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, Env, String, Symbol};

mod admin;
mod allowance;
mod balance;
mod event;
mod metadata;
mod storage_types;

use storage_types::DataKey;

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
        // Transfer fee: 0.3% (30 basis points)
        env.storage().instance().set(&DataKey::TransferFee, &30u32);
        // Fee recipient is admin initially
        env.storage().instance().set(&DataKey::FeeRecipient, &admin);
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

    pub fn set_fee(env: Env, fee_bps: u32) {
        let admin = admin::read_administrator(&env);
        admin.require_auth();
        if fee_bps > 1000 {
            panic!("fee cannot exceed 10%");
        }
        env.storage()
            .instance()
            .set(&DataKey::TransferFee, &fee_bps);
    }

    pub fn set_fee_recipient(env: Env, recipient: Address) {
        let admin = admin::read_administrator(&env);
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::FeeRecipient, &recipient);
    }

    pub fn get_fee_bps(env: Env) -> u32 {
        env.storage()
            .instance()
            .get::<DataKey, u32>(&DataKey::TransferFee)
            .unwrap_or(0)
    }

    pub fn admin(env: Env) -> Address {
        admin::read_administrator(&env)
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

        // Apply transfer fee
        let fee_bps = env
            .storage()
            .instance()
            .get::<DataKey, u32>(&DataKey::TransferFee)
            .unwrap_or(0);

        let fee_amount = if fee_bps > 0 {
            (amount * fee_bps as i128) / 10000
        } else {
            0
        };

        let net_amount = amount - fee_amount;

        balance::spend_balance(&env, from.clone(), amount);
        balance::receive_balance(&env, to.clone(), net_amount);

        // Send fee to fee recipient
        if fee_amount > 0 {
            let fee_recipient = env
                .storage()
                .instance()
                .get::<DataKey, Address>(&DataKey::FeeRecipient)
                .unwrap();
            balance::receive_balance(&env, fee_recipient.clone(), fee_amount);
            // Emit fee event
            env.events().publish(
                (FEE_TOPIC, symbol_short!("transfer")),
                (from.clone(), fee_recipient, fee_amount),
            );
        }

        event::transfer(&env, from, to, amount);
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        check_nonnegative_amount(amount);
        allowance::spend_allowance(&env, from.clone(), spender, amount);

        let fee_bps = env
            .storage()
            .instance()
            .get::<DataKey, u32>(&DataKey::TransferFee)
            .unwrap_or(0);

        let fee_amount = if fee_bps > 0 {
            (amount * fee_bps as i128) / 10000
        } else {
            0
        };

        let net_amount = amount - fee_amount;

        balance::spend_balance(&env, from.clone(), amount);
        balance::receive_balance(&env, to.clone(), net_amount);

        if fee_amount > 0 {
            let fee_recipient = env
                .storage()
                .instance()
                .get::<DataKey, Address>(&DataKey::FeeRecipient)
                .unwrap();
            balance::receive_balance(&env, fee_recipient.clone(), fee_amount);
        }

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
