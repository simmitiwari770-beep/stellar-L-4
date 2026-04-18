

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::testutils::Ledger;

fn mint_tokens(env: &Env, token_address: &Address, _admin: &Address, to: &Address, amount: i128) {
    use soroban_sdk::token::StellarAssetClient;
    StellarAssetClient::new(env, token_address).mint(to, &amount);
}

fn create_token_contract(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone()).address().clone()
}

#[test]
fn test_deposit_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token_address = create_token_contract(&env, &admin);
    let token = TokenClient::new(&env, &token_address);

    let vault_address = env.register_contract(None, VaultContract);
    let vault = VaultContractClient::new(&env, &vault_address);

    vault.initialize(&token_address, &10i128);

    // Mint tokens
    mint_tokens(&env, &token_address, &admin, &user1, 1000_0000000i128);
    mint_tokens(&env, &token_address, &admin, &vault_address, 10000_0000000i128);

    assert_eq!(token.balance(&user1), 1000_0000000i128);

    // Deposit 100 tokens
    let deposit_amount = 100_0000000i128;
    token.approve(&user1, &vault_address, &deposit_amount, &10000u32);
    vault.deposit(&user1, &deposit_amount);

    assert_eq!(vault.get_balance(&user1), deposit_amount);
    assert_eq!(token.balance(&user1), 900_0000000i128);

    // Withdraw 100 tokens
    vault.withdraw(&user1, &deposit_amount);
    assert_eq!(vault.get_balance(&user1), 0);
    assert_eq!(token.balance(&user1), 1000_0000000i128);
}

#[test]
fn test_rewards_accrue() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token_address = create_token_contract(&env, &admin);
    let token = TokenClient::new(&env, &token_address);

    let vault_address = env.register_contract(None, VaultContract);
    let vault = VaultContractClient::new(&env, &vault_address);

    vault.initialize(&token_address, &10i128);

    mint_tokens(&env, &token_address, &admin, &user1, 1000_0000000i128);
    mint_tokens(&env, &token_address, &admin, &vault_address, 10000_0000000i128);

    // Deposit 100 tokens at t=0
    token.approve(&user1, &vault_address, &100_0000000i128, &10000u32);
    vault.deposit(&user1, &100_0000000i128);

    // Advance time by 100 seconds
    env.ledger().with_mut(|l| {
        l.timestamp += 100;
    });

    // Claim rewards
    vault.claim_rewards(&user1);

    // rewards = 100_0000000 * 100 * 10 / 10000 = 10_0000000 (10 tokens)
    // user should have: 900 (after deposit) + 10 (reward) = 910
    assert_eq!(token.balance(&user1), 910_0000000i128);
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_deposit_zero_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let token_address = create_token_contract(&env, &admin);
    let vault_address = env.register_contract(None, VaultContract);
    let vault = VaultContractClient::new(&env, &vault_address);

    vault.initialize(&token_address, &10i128);
    vault.deposit(&user1, &0i128);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_withdraw_more_than_deposited() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let token_address = create_token_contract(&env, &admin);
    let token = TokenClient::new(&env, &token_address);
    let vault_address = env.register_contract(None, VaultContract);
    let vault = VaultContractClient::new(&env, &vault_address);

    vault.initialize(&token_address, &10i128);
    mint_tokens(&env, &token_address, &admin, &user1, 1000_0000000i128);

    token.approve(&user1, &vault_address, &100_0000000i128, &10000u32);
    vault.deposit(&user1, &100_0000000i128);

    vault.withdraw(&user1, &200_0000000i128);
}
