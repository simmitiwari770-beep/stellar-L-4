#![no_std]

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env};

mod storage_types;
use storage_types::DataKey;

use soroban_sdk::token::Client as TokenClient;

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    pub fn initialize(env: Env, token: Address, reward_rate: i128) {
        if env.storage().instance().has(&DataKey::Token) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage()
            .instance()
            .set(&DataKey::RewardRate, &reward_rate);
    }

    fn update_rewards(env: &Env, user: &Address) {
        let balance = Self::get_balance(env.clone(), user.clone());
        let last_updated = env
            .storage()
            .persistent()
            .get::<DataKey, u64>(&DataKey::UserLastUpdated(user.clone()))
            .unwrap_or(env.ledger().timestamp());
        let current_time = env.ledger().timestamp();

        let elapsed = (current_time - last_updated) as i128;
        let rate = env
            .storage()
            .instance()
            .get::<DataKey, i128>(&DataKey::RewardRate)
            .unwrap_or(0);

        // reward = balance * elapsed * rate / 10000
        let new_rewards = (balance * elapsed * rate) / 10000;

        let existing_rewards = Self::get_pending_rewards(env.clone(), user.clone());

        env.storage().persistent().set(
            &DataKey::UserPendingRewards(user.clone()),
            &(existing_rewards + new_rewards),
        );
        env.storage()
            .persistent()
            .set(&DataKey::UserLastUpdated(user.clone()), &current_time);
    }

    pub fn deposit(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        Self::update_rewards(&env, &user);

        let token = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Token)
            .unwrap();
        let token_client = TokenClient::new(&env, &token);

        // Vault transfers tokens to itself from the user
        token_client.transfer_from(
            &env.current_contract_address(),
            &user,
            &env.current_contract_address(),
            &amount,
        );

        let mut balance = Self::get_balance(env.clone(), user.clone());
        balance += amount;
        env.storage()
            .persistent()
            .set(&DataKey::UserBalance(user.clone()), &balance);

        env.events()
            .publish((symbol_short!("DEPOSIT"), user.clone()), amount);
    }

    pub fn withdraw(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        Self::update_rewards(&env, &user);

        let mut balance = Self::get_balance(env.clone(), user.clone());
        if balance < amount {
            panic!("Insufficient balance");
        }

        balance -= amount;
        env.storage()
            .persistent()
            .set(&DataKey::UserBalance(user.clone()), &balance);

        let token = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Token)
            .unwrap();
        let token_client = TokenClient::new(&env, &token);

        token_client.transfer(&env.current_contract_address(), &user, &amount);

        env.events()
            .publish((symbol_short!("WITHDRAW"), user.clone()), amount);
    }

    pub fn claim_rewards(env: Env, user: Address) {
        user.require_auth();
        Self::update_rewards(&env, &user);

        let pending_rewards = Self::get_pending_rewards(env.clone(), user.clone());
        if pending_rewards <= 0 {
            return;
        }

        env.storage()
            .persistent()
            .set(&DataKey::UserPendingRewards(user.clone()), &0i128);

        let token = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Token)
            .unwrap();
        let token_client = TokenClient::new(&env, &token);

        token_client.transfer(&env.current_contract_address(), &user, &pending_rewards);

        env.events()
            .publish((symbol_short!("CLAIM"), user.clone()), pending_rewards);
    }

    pub fn get_balance(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get::<DataKey, i128>(&DataKey::UserBalance(user))
            .unwrap_or(0)
    }

    pub fn get_pending_rewards(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get::<DataKey, i128>(&DataKey::UserPendingRewards(user))
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests;
