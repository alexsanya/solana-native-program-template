import {describe, expect, test} from '@jest/globals';
import { Connection, Transaction, TransactionInstruction, PublicKey, Keypair, sendAndConfirmTransaction, SystemProgram } from '@solana/web3.js';
import { wait } from '../utils';
import sk from '../../program.json';
const { MerkleTree } = require('merkletreejs');
const crypto = require('crypto');


const sha256 = (data: any) => crypto.createHash('sha256').update(data).digest();


describe('Counter Program', () => {
  const programId = new PublicKey("6aZ9AWZDXinkaKcb4Ru43irssNwsY3bK1NQFrsEkkqrb");
  //const wallet = Keypair.generate();
  const wallet = Keypair.fromSecretKey(Uint8Array.from(sk));
  const port = process.env['RPC_PORT'];
  const connection = new Connection(`http://127.0.0.1:${port}`, 'confirmed');
  const SEED = 'tree';

  test.only('Create tree PDA', async () => {
    const TREE_DEPTH = 3;
    const TREE_SIZE = (1 << (TREE_DEPTH + 1)) - 1;
    const totalSize = TREE_SIZE * 32 + 1;
    const lamports = await connection.getMinimumBalanceForRentExemption(totalSize, 'confirmed');

    const [pda, bump] = await PublicKey.findProgramAddressSync(
      [Buffer.from(SEED), wallet.publicKey.toBuffer()], // seeds
      programId
    );

    console.log("Derived PDA:", pda.toBase58());
    console.log("Bump:", bump);

    const createIx = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: pda,
      lamports,
      space: totalSize,
      programId
    });

    const tx = new Transaction().add(createIx);
    tx.feePayer = wallet.publicKey;
    try {
      await sendAndConfirmTransaction(connection, tx, [wallet]);
    } catch (err: any) {
      console.error("⚠️ PDA creation failed — likely because:", err.message);
      console.error("If PDA already exists, use getAccountInfo to confirm.");
    }
  });

  test('Initialize tree', async () => {
    //await connection.requestAirdrop(wallet.publicKey, 5000000000);
    //await wait(1000);

    const TREE_DEPTH = 3;
    const TREE_SIZE = (1 << (TREE_DEPTH + 1)) - 1;
    const totalSize = TREE_SIZE * 32 + 1;

    const tree = await PublicKey.createWithSeed(
      wallet.publicKey,
      SEED,
      programId,
    )

    const instruction = SystemProgram.createAccountWithSeed({
      fromPubkey: wallet.publicKey,
      basePubkey: wallet.publicKey,
      seed: SEED,
      newAccountPubkey: tree,
      lamports: await connection.getMinimumBalanceForRentExemption(totalSize, 'confirmed'),
      space: totalSize,
      programId: programId,
    });

    console.log("Program address: ", programId);

    const transaction = new Transaction()
      .add(instruction)
    transaction.feePayer = wallet.publicKey;

    await sendAndConfirmTransaction(connection, transaction, [wallet]);

    const treeData = await connection.getAccountInfo(tree);
    console.log("Tree account initialized ", tree.toBase58());
    console.log("Tree account owner ", treeData?.owner.toBase58());
  });

  test("Insert leaf", async () => {
    const tree = await PublicKey.createWithSeed(
      wallet.publicKey,
      SEED,
      programId,
    )

    console.log("Tree account sent to instruction ", tree.toBase58());

    const leaf = sha256(Buffer.from('LeafA'));
    const addLeafInstruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: tree, isSigner: false, isWritable: true },
      ],
      programId: new PublicKey(programId),
      data: leaf // 0: Initialize, 1: Increment,
    });



    //const leaves = ['Alice', 'Bob', 'Charlie', 'Dave'].map(x => sha256(Buffer.from(x)));
    //const tree = new MerkleTree(leaves, sha256, { sortPairs: true });

    //const root = tree.getRoot();
    //const proof = tree.getProof(leaf);

    //console.log("Merkle Root:", root);
    //console.log("Merkle Proof:", proof);



    //const leaf: Array<number> = Array.from({length: 32}).map(_ => 0);
    //const root: Array<number> = Array.from({length: 32}).map(_ => 0);
    //const proof: Array<number> = Array.from({length: 32}).map(_ => 0);


    const transaction = new Transaction().add(addLeafInstruction);

    await sendAndConfirmTransaction(connection, transaction, [wallet]);

    //const counterData = await connection.getAccountInfo(counter);
    //expect(counterData?.data[0]).toBe(2);
  });
});
