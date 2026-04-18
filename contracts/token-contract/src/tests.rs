
#![allow(clippy::inconsistent_digit_grouping)]
extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{SoroswapToken, SoroswapTokenClient};

fn create_token(env: &Env) -> (SoroswapTokenClient<'_>, Address) {
    let admin = Address::generate(env);
    let contract_id = env.register_contract(None, SoroswapToken);
    let client = SoroswapTokenClient::new(env, &contract_id);
    client.initialize(
        &admin,
        &7,
        &String::from_str(env, "SoroVault Token"),
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
    assert_eq!(client.name(), String::from_str(&env, "SoroVault Token"));
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
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = create_token(&env);
    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);

    client.mint(&sender, &1_000_0000000i128);
    client.transfer(&sender, &receiver, &100_0000000i128);

    // No fee — direct 1:1 transfer
    assert_eq!(client.balance(&receiver), 100_0000000i128);
    assert_eq!(client.balance(&sender), 900_0000000i128);
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
fn test_allowance_and_transfer_from() {
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

    // No fee on transfer_from — direct 1:1
    assert_eq!(client.balance(&recipient), 100_0000000i128);
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
