use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    hash::hashv,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{rent::Rent, Sysvar},
    system_instruction
};

entrypoint!(process_instruction);

#[repr(u32)]
pub enum CustomError {
    InvalidLeafLength = 0,
    TreeOverflow = 1
}

impl From<CustomError> for ProgramError {
    fn from(e: CustomError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

const MAX_DEPTH: usize = 3; // Tree with 8 leaves max
const TREE_SIZE: usize = (1 << (MAX_DEPTH + 1)) - 1; // 15 nodes
const TREE_SIZE_BYTES: usize = TREE_SIZE * 32 + 1; // bytes for all nodes + 1 byte for next_leaf_index

// State: flat array of [u8; 32] hashes
#[repr(C)]
pub struct MerkleTree {
    pub nodes: [[u8; 32]; TREE_SIZE],
    pub next_leaf_index: u8, // index of the next free leaf
}

impl MerkleTree {
    pub fn insert_leaf(&mut self, leaf: [u8; 32]) -> ProgramResult {
        let leaf_pos = (1 << MAX_DEPTH) - 1 + self.next_leaf_index as usize;
        if leaf_pos >= TREE_SIZE {
            msg!("Tree is full");
            return Err(CustomError::TreeOverflow.into());
        }

        self.nodes[leaf_pos] = leaf;
        let mut current = leaf_pos;

        while current > 0 {
            let parent = (current - 1) / 2;
            let left = self.nodes[2 * parent + 1];
            let right = self.nodes[2 * parent + 2];

            self.nodes[parent] = hashv(&[left.as_slice(), right.as_slice()]).to_bytes();

            current = parent;
        }

        self.next_leaf_index += 1;
        Ok(())
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let (tag, rest) = instruction_data.split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    match tag {
        0 => initialize_tree(program_id, accounts, rest),
        1 => insert_leaf(program_id, accounts, rest),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

pub fn insert_leaf(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let tree_account = next_account_info(accounts_iter)?;

    let mut tree_data = tree_account.try_borrow_mut_data()?;
    let tree: &mut MerkleTree = unsafe { &mut *(tree_data.as_mut_ptr() as *mut MerkleTree) };

    if instruction_data.len() != 32 {
        msg!("Invalid leaf length");
        return Err(CustomError::InvalidLeafLength.into());
    }

    let mut leaf = [0u8; 32];
    leaf.copy_from_slice(&instruction_data[..32]);
    tree.insert_leaf(leaf)?;

    msg!("Leaf inserted. Root: {}", hex::encode(tree.nodes[0]));
    Ok(())           
}

// Instruction 0: Initialize PDA Tree Account
fn initialize_tree(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let payer = next_account_info(accounts_iter)?;
    let tree_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let rent_sysvar = next_account_info(accounts_iter)?;

    let rent = &Rent::from_account_info(rent_sysvar)?;
    let space = TREE_SIZE_BYTES;
    let lamports = rent.minimum_balance(space);

    let (expected_pda, bump) = Pubkey::find_program_address(&[b"tree", payer.key.as_ref()], program_id);
    if &expected_pda != tree_account.key {
        msg!("Invalid PDA provided");
        return Err(ProgramError::InvalidArgument);
    }

    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            tree_account.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[payer.clone(), tree_account.clone(), system_program.clone()],
        &[&[b"tree", payer.key.as_ref(), &[bump]]],
    )?;

    msg!("✅ Merkle Tree PDA initialized");
    Ok(())
}
