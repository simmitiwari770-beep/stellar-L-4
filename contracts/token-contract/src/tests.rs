#![cfg(test)]
#![allow(clippy::inconsistent_digit_grouping)]
extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{SoroswapToken, SoroswapTokenClient};

fn create_token<'a>(env: &Env) -> (SoroswapTokenClient<'a>, Address) {
    let admin = Address::generate(env);
    let contract_id = env.register_contract(None, SoroswapToken);
    let client = SoroswapTokenClient::new(env, &contract_id);
    client.initialize(
        &admin,
        &7,
        &String::from_str(env, "SoroSwap Token"),
        &String::from_str(env, "SST"),
    );
    (client, admin)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = create_token(&env);

    assert_eq!(client.decimals(), 7);
    assert_eq!(client.name(), String::from_str(&env, "SoroSwap Token"));
    assert_eq!(client.symbol(), String::from_str(&env, "SST"));
}

#[test]
fn test_mint_and_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = create_token(&env);
    let user = Address::generate(&env);

    client.mint(&user, &1_000_0000000i128);
    assert_eq!(client.balance(&user), 1_000_0000000i128);
}

#[test]
fn test_transfer_with_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = create_token(&env);
    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);

    // Mint 1000 tokens to sender
    client.mint(&sender, &1_000_0000000i128);

    // Transfer 100 tokens — 0.3% fee should be deducted
    client.transfer(&sender, &receiver, &100_0000000i128);

    let fee = 100_0000000i128 * 30 / 10000; // 30 bps
    let expected = 100_0000000i128 - fee;

    assert_eq!(client.balance(&receiver), expected);
    // admin gets fee
    assert_eq!(client.balance(&admin), fee);
    // sender has correct remainder
    assert_eq!(client.balance(&sender), 1_000_0000000i128 - 100_0000000i128);
}

#[test]
fn test_burn() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _) = create_token(&env);
    let user = Address::generate(&env);

    client.mint(&user, &500_0000000i128);
    client.burn(&user, &200_0000000i128);

    assert_eq!(client.balance(&user), 300_0000000i128);
}

#[test]
fn test_allowance() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _) = create_token(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mint(&owner, &1000_0000000i128);
    client.approve(
        &owner,
        &spender,
        &200_0000000i128,
        &(env.ledger().sequence() + 1000),
    );
    assert_eq!(client.allowance(&owner, &spender), 200_0000000i128);

    client.transfer_from(&spender, &owner, &recipient, &100_0000000i128);

    let fee = 100_0000000i128 * 30 / 10000;
    assert_eq!(client.balance(&recipient), 100_0000000i128 - fee);
    assert_eq!(client.allowance(&owner, &spender), 100_0000000i128);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn test_transfer_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _) = create_token(&env);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mint(&user, &10_0000000i128);
    client.transfer(&user, &recipient, &100_0000000i128);
}

#[test]
fn test_set_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = create_token(&env);
    assert_eq!(client.get_fee_bps(), 30u32);

    client.set_fee(&50u32);
    assert_eq!(client.get_fee_bps(), 50u32);
}

#[test]
#[should_panic(expected = "fee cannot exceed 10%")]
fn test_set_fee_too_high() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = create_token(&env);
    client.set_fee(&1001u32);
}
