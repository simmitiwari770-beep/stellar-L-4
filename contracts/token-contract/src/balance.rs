use crate::storage_types::DataKey;
use soroban_sdk::{Address, Env};

pub fn read_balance(env: &Env, addr: Address) -> i128 {
    let key = DataKey::Balance(addr);
    env.storage()
        .persistent()
        .get::<DataKey, i128>(&key)
        .unwrap_or(0)
}

fn write_balance(env: &Env, addr: Address, amount: i128) {
    let key = DataKey::Balance(addr);
    env.storage()
        .persistent()
        .set::<DataKey, i128>(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, 500_000, 500_000);
}

pub fn receive_balance(env: &Env, addr: Address, amount: i128) {
    let balance = read_balance(env, addr.clone());
    write_balance(env, addr, balance + amount);
}

pub fn spend_balance(env: &Env, addr: Address, amount: i128) {
    let balance = read_balance(env, addr.clone());
    if balance < amount {
        panic!("insufficient balance");
    }
    write_balance(env, addr, balance - amount);
}
