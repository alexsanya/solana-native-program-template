use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    hash::hashv
};

entrypoint!(process_instruction);

#[repr(u32)]
pub enum CustomError {
    InvalidInstructionDataLength = 0,
    ProofCountMismatch = 1,
    RootMismatch = 2,
}

impl From<CustomError> for ProgramError {
    fn from(e: CustomError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let mut accounts_iter = accounts.iter();
    let _signer = next_account_info(&mut accounts_iter)?;    
    //let counter = next_account_info(&mut accounts_iter)?;

    if instruction_data.len() < 33 {
        msg!("Invalid instruction data length");
        return Err(CustomError::InvalidInstructionDataLength.into());
    }

    let leaf = &instruction_data[0..32];
    let proof_count = instruction_data[32] as usize;

    let expected_len = 33 + proof_count * 32;
    if instruction_data.len() != expected_len {
        msg!("Instruction data length mismatch for proof count");
        return Err(CustomError::ProofCountMismatch.into());
    }

    let mut root = hashv(&[leaf]).to_bytes();

    for i in 0..proof_count {
        let start = 33 + i * 32;
        let sibling = &instruction_data[start..start + 32];

        let mut combined = Vec::with_capacity(64);
        combined.extend_from_slice(&root);
        combined.extend_from_slice(sibling);
        root = hashv(&[&combined]).to_bytes();
    }

    msg!("Caclulated merkle root: {}", hex::encode(root));

    Ok(())
}
