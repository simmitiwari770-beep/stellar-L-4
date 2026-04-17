use soroban_sdk::{symbol_short, Address, Env};

pub fn mint(env: &Env, admin: Address, to: Address, amount: i128) {
    let topics = (symbol_short!("MINT"), to);
    env.events().publish(topics, amount);
}

pub fn burn(env: &Env, from: Address, amount: i128) {
    let topics = (symbol_short!("BURN"), from);
    env.events().publish(topics, amount);
}

pub fn transfer(env: &Env, from: Address, to: Address, amount: i128) {
    let topics = (symbol_short!("TRANSFER"), from, to);
    env.events().publish(topics, amount);
}

pub fn approve(env: &Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
    let topics = (symbol_short!("APPROVE"), from, spender);
    env.events().publish(topics, (amount, expiration_ledger));
}
