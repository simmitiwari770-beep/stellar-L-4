use soroban_sdk::{Address, Env};
use crate::storage_types::DataKey;

pub fn has_administrator(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

pub fn read_administrator(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn write_administrator(env: &Env, id: &Address) {
    env.storage().instance().set(&DataKey::Admin, id);
}
