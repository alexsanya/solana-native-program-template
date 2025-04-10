import {describe, expect, test} from '@jest/globals';
import { Connection, Transaction, TransactionInstruction, PublicKey, Keypair, sendAndConfirmTransaction, SystemProgram } from '@solana/web3.js';
import { wait } from '../utils';
import sk from '../../program.json';

describe('Counter Program', () => {
  const programId = new PublicKey("5b5cSP7Y5GLciLzWuNBRu9WvD61Cjk5ykvTvL2et2j94");
  //const wallet = Keypair.generate();
  const wallet = Keypair.fromSecretKey(Uint8Array.from(sk));
  const port = process.env['RPC_PORT'];
  const connection = new Connection(`http://127.0.0.1:${port}`, 'confirmed');

  test('Initialize Counter', async () => {
    //await connection.requestAirdrop(wallet.publicKey, 5000000000);
    //await wait(1000);

    console.log("Wallet's balance: ");
     
  
    const counter = await PublicKey.createWithSeed(
      wallet.publicKey,
      'counter',
      programId,
    )

    const instruction = SystemProgram.createAccountWithSeed({
      fromPubkey: wallet.publicKey,
      basePubkey: wallet.publicKey,
      seed: 'counter',
      newAccountPubkey: counter,
      lamports: await connection.getMinimumBalanceForRentExemption(1, 'confirmed'),
      space: 1,
      programId: programId,
    });

    console.log("Program address: ", programId);

    const InitInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: counter, isSigner: false, isWritable: true },
      ],
      programId: new PublicKey(programId),
      data: Buffer.from([0]), // 0: Initialize, 1: Increment
    })

    const transaction = new Transaction()
      .add(instruction)
      .add(InitInstruction);
    transaction.feePayer = wallet.publicKey;

    await sendAndConfirmTransaction(connection, transaction, [wallet]);

    const counterData = await connection.getAccountInfo(counter);
    expect(counterData?.data[0]).toBe(1);
  });

  test("Increment Counter", async () => {
    const counter = await PublicKey.createWithSeed(
      wallet.publicKey,
      'counter',
      programId,
    )

    const increaseInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: counter, isSigner: false, isWritable: true },
      ],
      programId: new PublicKey(programId),
      data: Buffer.from([1]) // 0: Initialize, 1: Increment,
    });

    const transaction = new Transaction().add(increaseInstruction);

    await sendAndConfirmTransaction(connection, transaction, [wallet]);

    const counterData = await connection.getAccountInfo(counter);
    expect(counterData?.data[0]).toBe(2);
  });
});
