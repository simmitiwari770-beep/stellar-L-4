#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, String};
use soroban_sdk::token::Client as TokenClient;

fn create_token_contract<'a>(env: &Env, admin: &Address) -> TokenClient<'a> {
    let token_address = env.register_contract_wasm(None, crate::soroswap_token::WASM);
    let token = TokenClient::new(env, &token_address);
    token.initialize(admin, &7u32, &String::from_str(env, "Token"), &String::from_str(env, "TKN"));
    token
}

#[test]
fn test_vault() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let vault_address = env.register_contract(None, VaultContract);
    let vault = VaultContractClient::new(&env, &vault_address);

    vault.initialize(&token.address, &10i128); // 10 tokens per 10000 per second

    // Mint tokens
    token.mint(&user1, &1000_0000000i128);
    token.mint(&vault_address, &10000_0000000i128); // Vault reserve for rewards

    assert_eq!(token.balance(&user1), 1000_0000000i128);

    // User deposits 100 tokens
    let deposit_amount = 100_0000000i128;
    token.approve(&user1, &vault_address, &deposit_amount, &10000);
    vault.deposit(&user1, &deposit_amount);

    assert_eq!(vault.get_balance(&user1), deposit_amount);
    assert_eq!(token.balance(&user1), 900_0000000i128);

    // Fast forward time
    env.ledger().set_timestamp(env.ledger().timestamp() + 100);

    // User claims rewards
    vault.claim_rewards(&user1);

    // Check rewards
    // balance = 100_0000000, elapsed = 100, rate = 10
    // formula = 100_0000000 * 100 * 10 / 10000 = 100_0000000
    assert_eq!(token.balance(&user1), 900_0000000i128 + 100_0000000i128);

    // Withdraw
    vault.withdraw(&user1, &deposit_amount);
    assert_eq!(vault.get_balance(&user1), 0);
    assert_eq!(token.balance(&user1), 1100_0000000i128); // 900 + 100 reward + 100 principal
}
