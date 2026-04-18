#![allow(clippy::inconsistent_digit_grouping)]
extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{SoroswapPool, SoroswapPoolClient};

// We need a minimal token contract for testing
mod token {
    use soroban_sdk::token::Interface as TokenInterface;
    use soroban_sdk::{contract, contractimpl, Address, Env, String};

    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl TokenInterface for MockToken {
        fn allowance(_env: Env, _from: Address, _spender: Address) -> i128 {
            0
        }
        fn approve(
            _env: Env,
            _from: Address,
            _spender: Address,
            _amount: i128,
            _expiration_ledger: u32,
        ) {
        }
        fn balance(env: Env, id: Address) -> i128 {
            env.storage()
                .persistent()
                .get::<Address, i128>(&id)
                .unwrap_or(0)
        }
        fn transfer(env: Env, from: Address, to: Address, amount: i128) {
            let from_bal: i128 = env
                .storage()
                .persistent()
                .get::<Address, i128>(&from)
                .unwrap_or(0);
            if from_bal < amount {
                panic!("insufficient")
            }
            env.storage()
                .persistent()
                .set::<Address, i128>(&from, &(from_bal - amount));
            let to_bal: i128 = env
                .storage()
                .persistent()
                .get::<Address, i128>(&to)
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set::<Address, i128>(&to, &(to_bal + amount));
        }
        fn transfer_from(env: Env, _spender: Address, from: Address, to: Address, amount: i128) {
            Self::transfer(env, from, to, amount);
        }
        fn burn(env: Env, from: Address, amount: i128) {
            let bal: i128 = env
                .storage()
                .persistent()
                .get::<Address, i128>(&from)
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set::<Address, i128>(&from, &(bal - amount));
        }
        fn burn_from(env: Env, _spender: Address, from: Address, amount: i128) {
            Self::burn(env, from, amount);
        }
        fn decimals(_env: Env) -> u32 {
            7
        }
        fn name(env: Env) -> String {
            String::from_str(&env, "Mock")
        }
        fn symbol(env: Env) -> String {
            String::from_str(&env, "MCK")
        }
    }
}

fn setup_pool<'a>(env: &Env) -> (SoroswapPoolClient<'a>, Address, Address, Address) {
    let fee_to = Address::generate(env);
    let token_a_id = env.register_contract(None, token::MockToken);
    let token_b_id = env.register_contract(None, token::MockToken);
    let pool_id = env.register_contract(None, SoroswapPool);
    let pool = SoroswapPoolClient::new(env, &pool_id);
    pool.initialize(&token_a_id, &token_b_id, &fee_to);
    (pool, token_a_id, token_b_id, pool_id)
}

fn mint_token(env: &Env, token_id: &Address, user: &Address, amount: i128) {
    env.as_contract(token_id, || {
        env.storage()
            .persistent()
            .set::<Address, i128>(user, &amount);
    });
}

#[test]
fn test_add_and_remove_liquidity() {
    let env = Env::default();
    env.mock_all_auths();

    let (pool, token_a, token_b, _pool_id) = setup_pool(&env);
    let provider = Address::generate(&env);

    mint_token(&env, &token_a, &provider, 10_000_0000000);
    mint_token(&env, &token_b, &provider, 10_000_0000000);

    let lp = pool.add_liquidity(&provider, &1_000_0000000i128, &1_000_0000000i128);
    assert!(lp > 0);

    let reserves = pool.get_reserves();
    assert_eq!(reserves.reserve_a, 1_000_0000000);
    assert_eq!(reserves.reserve_b, 1_000_0000000);
    assert_eq!(reserves.total_lp, lp);

    let lp_bal = pool.get_lp_balance(&provider);
    assert_eq!(lp_bal, lp);

    let (out_a, out_b) = pool.remove_liquidity(&provider, &lp);
    assert!(out_a > 0);
    assert!(out_b > 0);

    let reserves_after = pool.get_reserves();
    assert_eq!(reserves_after.total_lp, 0);
}

#[test]
fn test_swap_a_to_b() {
    let env = Env::default();
    env.mock_all_auths();

    let (pool, token_a, token_b, _pool_id) = setup_pool(&env);
    let provider = Address::generate(&env);
    let trader = Address::generate(&env);

    mint_token(&env, &token_a, &provider, 100_000_0000000);
    mint_token(&env, &token_b, &provider, 100_000_0000000);
    mint_token(&env, &token_a, &trader, 1_000_0000000);

    pool.add_liquidity(&provider, &10_000_0000000i128, &10_000_0000000i128);

    let amount_out = pool.swap(&trader, &true, &100_0000000i128, &0i128);
    assert!(amount_out > 0);

    // Output should be slightly less than input due to fee
    assert!(amount_out < 100_0000000);
}

#[test]
fn test_quote() {
    let env = Env::default();
    env.mock_all_auths();

    let (pool, token_a, token_b, _pool_id) = setup_pool(&env);
    let provider = Address::generate(&env);

    mint_token(&env, &token_a, &provider, 100_000_0000000);
    mint_token(&env, &token_b, &provider, 100_000_0000000);

    pool.add_liquidity(&provider, &10_000_0000000i128, &10_000_0000000i128);

    let quote = pool.quote(&true, &100_0000000i128);
    assert!(quote > 0 && quote < 100_0000000);
}

#[test]
#[should_panic(expected = "insufficient output")]
fn test_swap_slippage_exceeded() {
    let env = Env::default();
    env.mock_all_auths();

    let (pool, token_a, token_b, _pool_id) = setup_pool(&env);
    let provider = Address::generate(&env);
    let trader = Address::generate(&env);

    mint_token(&env, &token_a, &provider, 100_000_0000000);
    mint_token(&env, &token_b, &provider, 100_000_0000000);
    mint_token(&env, &token_a, &trader, 1_000_0000000);

    pool.add_liquidity(&provider, &10_000_0000000i128, &10_000_0000000i128);
    // Request way more output than possible
    pool.swap(&trader, &true, &100_0000000i128, &500_0000000i128);
}
