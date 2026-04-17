use soroban_sdk::{symbol_short, Address, Env};

pub fn initialized(env: &Env, token_a: Address, token_b: Address) {
    env.events().publish(
        (symbol_short!("INIT"), symbol_short!("pool")),
        (token_a, token_b),
    );
}

pub fn add_liquidity(
    env: &Env,
    provider: Address,
    amount_a: i128,
    amount_b: i128,
    lp_minted: i128,
) {
    env.events().publish(
        (symbol_short!("ADD_LIQ"), provider),
        (amount_a, amount_b, lp_minted),
    );
}

pub fn remove_liquidity(
    env: &Env,
    provider: Address,
    amount_a: i128,
    amount_b: i128,
    lp_burned: i128,
) {
    env.events().publish(
        (symbol_short!("REM_LIQ"), provider),
        (amount_a, amount_b, lp_burned),
    );
}

pub fn swap(
    env: &Env,
    user: Address,
    token_in: Address,
    token_out: Address,
    amount_in: i128,
    amount_out: i128,
    fee: i128,
) {
    env.events().publish(
        (symbol_short!("SWAP"), user),
        (token_in, token_out, amount_in, amount_out, fee),
    );
}
