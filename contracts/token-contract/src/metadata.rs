use soroban_sdk::{Env};
use crate::storage_types::{DataKey, TokenMetadata};

pub fn read_decimal(env: &Env) -> u32 {
    let meta = env
        .storage()
        .instance()
        .get::<DataKey, TokenMetadata>(&DataKey::Metadata)
        .unwrap();
    meta.decimal
}

pub fn read_name(env: &Env) -> soroban_sdk::String {
    let meta = env
        .storage()
        .instance()
        .get::<DataKey, TokenMetadata>(&DataKey::Metadata)
        .unwrap();
    meta.name
}

pub fn read_symbol(env: &Env) -> soroban_sdk::String {
    let meta = env
        .storage()
        .instance()
        .get::<DataKey, TokenMetadata>(&DataKey::Metadata)
        .unwrap();
    meta.symbol
}

pub fn write_metadata(env: &Env, metadata: TokenMetadata) {
    env.storage()
        .instance()
        .set(&DataKey::Metadata, &metadata);
}
