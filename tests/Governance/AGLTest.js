const {
  address,
  advanceBlocks,
  minerStart,
  minerStop,
  unlockedAccount,
  mineBlock,
  blockNumber,
  mineBlockNumber
} = require('../Utils/BSC');

const EIP712 = require('../Utils/EIP712');

describe('AGL', () => {
  const name = 'Agile';
  const symbol = 'AGL';
  const startBlock = 923000;

  let root, a1, a2, accounts, chainId;
  let agl;
  let epochBlocks = 100;
  let epochROI = 20;

  beforeEach(async () => {
    [root, a1, a2, ...accounts] = saddle.accounts;
    chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    try {
      await mineBlockNumber(startBlock);
      agl = await deploy('AGL', [root]);
    } catch (err) {
      console.log('deploy error: ', err);
    }
  });

  describe('metadata', () => {
    it('has given name', async () => {
      expect(await call(agl, 'name')).toEqual(name);
    });

    it('has given symbol', async () => {
      expect(await call(agl, 'symbol')).toEqual(symbol);
    });
  });

  describe('balanceOf', () => {
    it('grants to initial account', async () => {
      expect(await call(agl, 'balanceOf', [root])).toEqual("1000000000000000000000000000");
    });
  });

  describe('ownership', () => {
    it('get owner address', async () => {
      expect(await call(agl, 'owner', [])).toEqual(root);
    });

    it('authorize ownership and assume', async () => {
      await send(agl, 'authorizeOwnershipTransfer', [a1]);
      expect(await call(agl, 'owner', [])).toEqual(root);
      expect(await call(agl, 'authorizedNewOwner', [])).toEqual(a1);

      await send(agl, 'assumeOwnership', [], { from: a1 });
      expect(await call(agl, 'authorizedNewOwner', [])).toEqual(address(0));
      expect(await call(agl, 'owner', [])).toEqual(a1);
    });

    it('renounce ownership', async () => {
      await send(agl, 'renounceOwnership', [root]);
      expect(await call(agl, 'owner', [])).toEqual(address(0));
      expect(await call(agl, 'authorizedNewOwner', [])).toEqual(address(0));
    });
  });

  describe('delegateBySig', () => {
    const Domain = (agl) => ({ name, chainId, verifyingContract: agl._address });
    const Types = {
      Delegation: [
        { name: 'delegatee', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' }
      ]
    };

    it('reverts if the signatory is invalid', async () => {
      const delegatee = root, nonce = 0, expiry = 0;
      await expect(send(agl, 'delegateBySig', [delegatee, nonce, expiry, 0, '0xbad', '0xbad'])).rejects.toRevert("revert AGL::delegateBySig: invalid signature");
    });

    it('reverts if the nonce is bad ', async () => {
      const delegatee = root, nonce = 1, expiry = 0;
      const { v, r, s } = EIP712.sign(Domain(agl), 'Delegation', { delegatee, nonce, expiry }, Types, unlockedAccount(a1).secretKey);
      await expect(send(agl, 'delegateBySig', [delegatee, nonce, expiry, v, r, s])).rejects.toRevert("revert AGL::delegateBySig: invalid nonce");
    });

    it('reverts if the signature has expired', async () => {
      const delegatee = root, nonce = 0, expiry = 0;
      const { v, r, s } = EIP712.sign(Domain(agl), 'Delegation', { delegatee, nonce, expiry }, Types, unlockedAccount(a1).secretKey);
      await expect(send(agl, 'delegateBySig', [delegatee, nonce, expiry, v, r, s])).rejects.toRevert("revert AGL::delegateBySig: signature expired");
    });

    it('delegates on behalf of the signatory', async () => {
      const delegatee = root, nonce = 0, expiry = 10e9;
      const { v, r, s } = EIP712.sign(Domain(agl), 'Delegation', { delegatee, nonce, expiry }, Types, unlockedAccount(a1).secretKey);
      expect(await call(agl, 'delegates', [a1])).toEqual(address(0));
      const tx = await send(agl, 'delegateBySig', [delegatee, nonce, expiry, v, r, s]);
      expect(tx.gasUsed < 80000);
      expect(await call(agl, 'delegates', [a1])).toEqual(root);
    });
  });

  describe('numCheckpoints', () => {
    it('returns the number of checkpoints for a delegate', async () => {
      let guy = accounts[0];
      await send(agl, 'transfer', [guy, '100']); //give an account a few tokens for readability
      await expect(call(agl, 'numCheckpoints', [a1])).resolves.toEqual('0');

      const t1 = await send(agl, 'delegate', [a1], { from: guy });
      await expect(call(agl, 'numCheckpoints', [a1])).resolves.toEqual('1');

      const t2 = await send(agl, 'transfer', [a2, 10], { from: guy });
      await expect(call(agl, 'numCheckpoints', [a1])).resolves.toEqual('2');

      const t3 = await send(agl, 'transfer', [a2, 10], { from: guy });
      await expect(call(agl, 'numCheckpoints', [a1])).resolves.toEqual('3');

      const t4 = await send(agl, 'transfer', [guy, 20], { from: root });
      await expect(call(agl, 'numCheckpoints', [a1])).resolves.toEqual('4');

      await expect(call(agl, 'checkpoints', [a1, 0])).resolves.toEqual(expect.objectContaining({ fromBlock: t1.blockNumber.toString(), votes: '100' }));
      await expect(call(agl, 'checkpoints', [a1, 1])).resolves.toEqual(expect.objectContaining({ fromBlock: t2.blockNumber.toString(), votes: '90' }));
      await expect(call(agl, 'checkpoints', [a1, 2])).resolves.toEqual(expect.objectContaining({ fromBlock: t3.blockNumber.toString(), votes: '80' }));
      await expect(call(agl, 'checkpoints', [a1, 3])).resolves.toEqual(expect.objectContaining({ fromBlock: t4.blockNumber.toString(), votes: '100' }));
    });

    it('does not add more than one checkpoint in a block', async () => {
      let guy = accounts[0];

      await send(agl, 'transfer', [guy, '100']); //give an account a few tokens for readability
      await expect(call(agl, 'numCheckpoints', [a1])).resolves.toEqual('0');
      await minerStop();

      let t1 = send(agl, 'delegate', [a1], { from: guy });
      let t2 = send(agl, 'transfer', [a2, 10], { from: guy });
      let t3 = send(agl, 'transfer', [a2, 10], { from: guy });

      await minerStart();
      t1 = await t1;
      t2 = await t2;
      t3 = await t3;

      await expect(call(agl, 'numCheckpoints', [a1])).resolves.toEqual('1');

      await expect(call(agl, 'checkpoints', [a1, 0])).resolves.toEqual(expect.objectContaining({ fromBlock: t1.blockNumber.toString(), votes: '80' }));
      await expect(call(agl, 'checkpoints', [a1, 1])).resolves.toEqual(expect.objectContaining({ fromBlock: '0', votes: '0' }));
      await expect(call(agl, 'checkpoints', [a1, 2])).resolves.toEqual(expect.objectContaining({ fromBlock: '0', votes: '0' }));

      const t4 = await send(agl, 'transfer', [guy, 20], { from: root });
      await expect(call(agl, 'numCheckpoints', [a1])).resolves.toEqual('2');
      await expect(call(agl, 'checkpoints', [a1, 1])).resolves.toEqual(expect.objectContaining({ fromBlock: t4.blockNumber.toString(), votes: '100' }));
    });
  });

  describe('getPriorVotes', () => {
    it('reverts if block number >= current block', async () => {
      await expect(call(agl, 'getPriorVotes', [a1, 5e10])).rejects.toRevert("revert AGL::getPriorVotes: not yet determined");
    });

    it('returns 0 if there are no checkpoints', async () => {
      expect(await call(agl, 'getPriorVotes', [a1, 0])).toEqual('0');
    });

    it('returns the latest block if >= last checkpoint block', async () => {
      const t1 = await send(agl, 'delegate', [a1], { from: root });
      await mineBlock();
      await mineBlock();

      expect(await call(agl, 'getPriorVotes', [a1, t1.blockNumber])).toEqual('1000000000000000000000000000');
      expect(await call(agl, 'getPriorVotes', [a1, t1.blockNumber + 1])).toEqual('1000000000000000000000000000');
    });

    it('returns zero if < first checkpoint block', async () => {
      await mineBlock();
      const t1 = await send(agl, 'delegate', [a1], { from: root });
      await mineBlock();
      await mineBlock();

      expect(await call(agl, 'getPriorVotes', [a1, t1.blockNumber - 1])).toEqual('0');
      expect(await call(agl, 'getPriorVotes', [a1, t1.blockNumber + 1])).toEqual('1000000000000000000000000000');
    });

    it('generally returns the voting balance at the appropriate checkpoint', async () => {
      const t1 = await send(agl, 'delegate', [a1], { from: root });
      await mineBlock();
      await mineBlock();
      const t2 = await send(agl, 'transfer', [a2, 10], { from: root });
      await mineBlock();
      await mineBlock();
      const t3 = await send(agl, 'transfer', [a2, 10], { from: root });
      await mineBlock();
      await mineBlock();
      const t4 = await send(agl, 'transfer', [root, 20], { from: a2 });
      await mineBlock();
      await mineBlock();

      expect(await call(agl, 'getPriorVotes', [a1, t1.blockNumber - 1])).toEqual('0');
      expect(await call(agl, 'getPriorVotes', [a1, t1.blockNumber])).toEqual('1000000000000000000000000000');
      expect(await call(agl, 'getPriorVotes', [a1, t1.blockNumber + 1])).toEqual('1000000000000000000000000000');
      expect(await call(agl, 'getPriorVotes', [a1, t2.blockNumber])).toEqual('999999999999999999999999990');
      expect(await call(agl, 'getPriorVotes', [a1, t2.blockNumber + 1])).toEqual('999999999999999999999999990');
      expect(await call(agl, 'getPriorVotes', [a1, t3.blockNumber])).toEqual('999999999999999999999999980');
      expect(await call(agl, 'getPriorVotes', [a1, t3.blockNumber + 1])).toEqual('999999999999999999999999980');
      expect(await call(agl, 'getPriorVotes', [a1, t4.blockNumber])).toEqual('1000000000000000000000000000');
      expect(await call(agl, 'getPriorVotes', [a1, t4.blockNumber + 1])).toEqual('1000000000000000000000000000');
    });
  });

  describe('setEpochConfig', () => {
    it('checks 100 blocks per epoch and 0.2% daily ROI increase config', async () => {
      await send(agl, 'setEpochConfig', ['100', '20'], { from: root }); // set blocks and ROI per epoch by owner
      await expect(call(agl, 'getCurrentEpochBlocks', [])).resolves.toEqual('100');
      await expect(call(agl, 'getCurrentEpochROI', [])).resolves.toEqual('20');
      await expect(call(agl, 'getCurrentEpochConfig', [])).resolves.toEqual(expect.objectContaining({ epoch: '32', blocks: '100', roi: '20'}));
    });

    it('returns revert if ROI exceeds max fraction', async () => {
      await expect(send(agl, 'setEpochConfig', ['100', '10000'], { from: root })).rejects.toRevert('revert AGL::setEpochConfig: roi exceeds max fraction'); // set blocks and ROI per epoch by owner
    });

    it('returns revert if blocks is zero', async () => {
      await expect(send(agl, 'setEpochConfig', ['0', '20'], { from: root })).rejects.toRevert('revert AGL::setEpochConfig: zero blocks'); // set blocks and ROI per epoch by owner
    });
  });

  describe('check owner transfer in 390 epochs', () => {
    it('returns latest epoch index if blocknumber >= epoch blocks ', async () => {
      let guy = accounts[0];

      let currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      const eligibleEpochs = await call(agl, 'eligibleEpochs', []);

      // 32 epochs
      let currentEpoch = Number(await call(agl, 'getEpochs', [startBlock.toString()]));
      let currentBlockNumber = await blockNumber();

      await advanceBlocks(currentEpochBlocks * eligibleEpochs / 2);

      await send(agl, 'setEpochConfig', ['20', '20'], { from: root }); // set blocks and ROI per epoch by owner: 47 epoch
      await expect(call(agl, 'getCurrentEpochConfig', [])).resolves.toEqual(expect.objectContaining({ epoch: '47', blocks: '20', roi: '20'}));

      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      expect(currentEpoch).toEqual(117);

      await advanceBlocks(Number(currentEpochBlocks * 390)); // 77 epochs
      currentBlockNumber = await blockNumber();
      // await expect(call(agl, 'getEpochs', [currentBlockNumber.toString()])).resolves.toEqual('77');

      const t1 = await send(agl, 'transfer', [guy, '100'], { from: root });

      await send(agl, 'setEpochConfig', ['100', '20'], { from: root }); // set blocks and ROI per epoch by owner
      await expect(call(agl, 'getCurrentEpochBlocks', [])).resolves.toEqual('100');
      await expect(call(agl, 'getCurrentEpochROI', [])).resolves.toEqual('20');
      await expect(call(agl, 'balanceOf', [guy])).resolves.toEqual('100');
      // await expect(call(agl, 'getCurrentEpochConfig', [])).resolves.toEqual(expect.objectContaining({ epoch: '77', blocks: '100', roi: '20'}));

    });
  });

  describe('getEpochs', () => {
    it('returns latest epoch index if blocknumber >= epoch blocks ', async () => {
      let guy = accounts[0];

      let currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      const eligibleEpochs = await call(agl, 'eligibleEpochs', []);

      // 32 epochs
      let currentEpoch = Number(await call(agl, 'getEpochs', [startBlock.toString()]));
      let currentBlockNumber = await blockNumber();

      await advanceBlocks(currentEpochBlocks * eligibleEpochs / 2);

      await send(agl, 'setEpochConfig', ['100', '10'], { from: root }); // set blocks and ROI per epoch by owner: 47 epoch
      await expect(call(agl, 'getCurrentEpochConfig', [])).resolves.toEqual(expect.objectContaining({ epoch: '47', blocks: '100', roi: '10'}));

      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      expect(currentEpoch).toEqual(61);

      await advanceBlocks(Number(currentEpochBlocks * eligibleEpochs / 2 + currentEpochBlocks)); // 77 epochs
      currentBlockNumber = await blockNumber();
      await expect(call(agl, 'getEpochs', [currentBlockNumber.toString()])).resolves.toEqual('77');


      await send(agl, 'setEpochConfig', ['100', '20'], { from: root }); // set blocks and ROI per epoch by owner
      await expect(call(agl, 'getCurrentEpochBlocks', [])).resolves.toEqual('100');
      await expect(call(agl, 'getCurrentEpochROI', [])).resolves.toEqual('20');
      await expect(call(agl, 'getCurrentEpochConfig', [])).resolves.toEqual(expect.objectContaining({ epoch: '77', blocks: '100', roi: '20'}));

      await advanceBlocks(100);

      currentBlockNumber = await blockNumber();
      await expect(call(agl, 'getEpochs', [currentBlockNumber])).resolves.toEqual('78');
      
      await advanceBlocks(500);

      currentBlockNumber = await blockNumber();
      await expect(call(agl, 'getEpochs', [currentBlockNumber])).resolves.toEqual('83');
      
      await send(agl, 'setEpochConfig', ['500', '20'], { from: root }); // set blocks and ROI per epoch by owner
      await expect(call(agl, 'getCurrentEpochBlocks', [])).resolves.toEqual('500');
      await expect(call(agl, 'getCurrentEpochROI', [])).resolves.toEqual('20');
      await expect(call(agl, 'getCurrentEpochConfig', [])).resolves.toEqual(expect.objectContaining({ epoch: '83', blocks: '500', roi: '20'}));
      
      const epochConfig = await call(agl, 'getEpochConfig', [83]);
      expect(epochConfig).toEqual(expect.objectContaining({ epoch: '83'}));

      await advanceBlocks(600);

      currentBlockNumber = await blockNumber();
      await expect(call(agl, 'getEpochs', [currentBlockNumber])).resolves.toEqual('84');

      await advanceBlocks(1000);

      currentBlockNumber = await blockNumber();
      await expect(call(agl, 'getEpochs', [currentBlockNumber])).resolves.toEqual('86');

      await expect(call(agl, 'getEpochs', ['3147483648000'])).resolves.toEqual((2**32 - 1).toString());
    });
  });

  describe('numTransferPoints', () => {

    it('returns the number of transferPoints for a receive', async () => {
      let guy = accounts[0];

      await expect(call(agl, 'numTransferPoints', [a1])).resolves.toEqual('0');

      const t1 = await send(agl, 'transfer', [guy, '100']); //give an account a few tokens for readability
      await expect(call(agl, 'numTransferPoints', [guy])).resolves.toEqual('1');

      await advanceBlocks(100);

      const t2 = await send(agl, 'transfer', [guy, '100']);
      await expect(call(agl, 'numTransferPoints', [guy])).resolves.toEqual('1');

      const currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      await advanceBlocks(currentEpochBlocks);

      const t3 = await send(agl, 'transfer', [guy, '100']);

      const currentBlockNumber = await blockNumber();
      await expect(call(agl, 'getEpochs', [currentBlockNumber])).resolves.toEqual('33');
      await expect(call(agl, 'numTransferPoints', [guy])).resolves.toEqual('2');

      const t4 = await send(agl, 'transfer', [a2, 10], { from: guy });
      await expect(call(agl, 'numTransferPoints', [guy])).resolves.toEqual('1');
      await expect(call(agl, 'numTransferPoints', [a2])).resolves.toEqual('1');

      await advanceBlocks(currentEpochBlocks);

      const t5 = await send(agl, 'transfer', [guy, 20], { from: root });
      await expect(call(agl, 'numTransferPoints', [guy])).resolves.toEqual('2');

      await expect(call(agl, 'transferPoints', [guy, 0])).resolves.toEqual(expect.objectContaining({ epoch: Math.floor(t4.blockNumber.toString() / currentEpochBlocks).toString(), balance: '290' }));
      await expect(call(agl, 'transferPoints', [guy, 1])).resolves.toEqual(expect.objectContaining({ epoch: Math.floor(t5.blockNumber.toString() / currentEpochBlocks).toString(), balance: '310' }));
      await expect(call(agl, 'transferPoints', [a2, 0])).resolves.toEqual(expect.objectContaining({ epoch: Math.floor(t4.blockNumber.toString() / currentEpochBlocks).toString(), balance: '10' }));
    });

    it('does not add more than one transferpoint in a block', async () => {
      let guy = accounts[0];
      const currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));

      await send(agl, 'transfer', [guy, '100']); //give an account a few tokens for readability
      await expect(call(agl, 'numTransferPoints', [a1])).resolves.toEqual('0');
      await minerStop();

      let t1 = send(agl, 'transfer', [a1, 10], { from: guy });
      let t2 = send(agl, 'transfer', [a1, 10], { from: guy });

      await minerStart();
      t1 = await t1;
      t2 = await t2;

      await expect(call(agl, 'numTransferPoints', [a1])).resolves.toEqual('1');

      await expect(call(agl, 'transferPoints', [a1, 0])).resolves.toEqual(expect.objectContaining({ epoch: Math.floor(t1.blockNumber.toString() / currentEpochBlocks).toString(), balance: '20' }));
      await expect(call(agl, 'transferPoints', [a1, 1])).resolves.toEqual(expect.objectContaining({ epoch: '0', balance: '0' }));

      const t3 = await send(agl, 'transfer', [guy, 20], { from: root });
      await expect(call(agl, 'numTransferPoints', [guy])).resolves.toEqual('1');
      await expect(call(agl, 'transferPoints', [guy, 0])).resolves.toEqual(expect.objectContaining({ epoch: Math.floor(t3.blockNumber.toString() / currentEpochBlocks).toString(), balance: '100' }));
    });

    it('returns zero numTransferPoints if transfer to AGL contract', async () => {
      let guy = accounts[0];
      let aglAddress = agl.options.address;
      const currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      const eligibleEpochs = await call(agl, 'eligibleEpochs', []);

      await send(agl, 'transfer', [aglAddress, '100']); //give an account a few tokens for readability
      await expect(call(agl, 'numTransferPoints', [aglAddress])).resolves.toEqual('0');
      
      await advanceBlocks(currentEpochBlocks * eligibleEpochs);
      await expect(call(agl, 'numTransferPoints', [aglAddress])).resolves.toEqual('0');

      const t2 = await send(agl, 'transfer', [aglAddress, 20], { from: root });
      const aglTransferPoints = await call(agl, 'transferPoints', [aglAddress, '0']);

      expect(aglTransferPoints).toEqual(expect.objectContaining({ balance: '0', epoch: '0' }));
      await expect(call(agl, 'numTransferPoints', [aglAddress])).resolves.toEqual('0');
    });
  });

  describe('getHoldingReward', () => {

    it('returns 0 if there are no transferPoints', async () => {
      await expect(call(agl, 'numTransferPoints', [a1])).resolves.toEqual('0');
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');
    });

    it('returns the latest block if >= last transferPoint block', async () => {
      const balanceAGL = await call(agl, 'balanceOf', [root]);
      const currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      const eligibleEpochs = await call(agl, 'eligibleEpochs', []);
      const t1 = await send(agl, 'transfer', [a1, balanceAGL], { from: root });

      let currentEpoch = Number(await call(agl, 'getEpochs', [startBlock.toString()]));
      await advanceBlocks(currentEpochBlocks * eligibleEpochs / 2);

      let currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');

      await advanceBlocks(Number(currentEpochBlocks * eligibleEpochs / 2 + currentEpochBlocks));
      currentBlockNumber = await blockNumber();
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('60000000000000000000000000');

      await advanceBlocks(currentEpochBlocks * eligibleEpochs);
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('120000000000000000000000000');
    });

    it('returns the holding rewards after claim rewards', async () => {
      const balanceAGL = await call(agl, 'balanceOf', [root]);
      const currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      const eligibleEpochs = await call(agl, 'eligibleEpochs', []);

      let aglAddress = agl.options.address;
      
      await send(agl, 'transfer', [aglAddress, '2000']); //sent holding reward tokens to AGL contract address

      const t1 = await send(agl, 'transfer', [a1, 10000], { from: root });

      let currentEpoch = Number(await call(agl, 'getEpochs', [startBlock.toString()]));
      await advanceBlocks(currentEpochBlocks * eligibleEpochs / 2);

      let currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');

      await advanceBlocks(Number(currentEpochBlocks * eligibleEpochs / 2 + currentEpochBlocks));
      currentBlockNumber = await blockNumber();
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('600');

      let t2 = await send(agl, 'claimReward', [], { from: a1 });

      expect(await call(agl, 'balanceOf', [aglAddress])).toEqual('1400');
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');
      expect(await call(agl, 'balanceOf', [a1])).toEqual('10600');

      await advanceBlocks(currentEpochBlocks * 2);
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('40');

      let t3 = await send(agl, 'claimReward', [], { from: a1 });
      expect(await call(agl, 'balanceOf', [aglAddress])).toEqual('1360');
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');
      expect(await call(agl, 'balanceOf', [a1])).toEqual('10640');
    });

    it('returns the holding rewards after claim rewards and send AGL', async () => {
      let currentBlockNumber = await blockNumber();
      let currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      let currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));

      const balanceAGL = await call(agl, 'balanceOf', [root]);
      const eligibleEpochs = await call(agl, 'eligibleEpochs', []);

      const aglAddress = agl.options.address;
      
      await send(agl, 'transfer', [aglAddress, '2000']); // send holding reward tokens to AGL contract address

      await send(agl, 'transfer', [a1, 10000], { from: root }); // 32 epochs

      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      await advanceBlocks(currentEpochBlocks * eligibleEpochs / 2);

      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      await send(agl, 'setEpochConfig', ['100', '10'], { from: root }); // set blocks and ROI per epoch by owner: 47 epoch

      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');

      await advanceBlocks(Number(currentEpochBlocks * eligibleEpochs / 2 + currentEpochBlocks)); // 77 epochs
      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));

      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('590'); // 0.2% * 15 epochs + 0.1% * 29 epochs

      let t2 = await send(agl, 'claimReward', [], { from: a1 });

      expect(await call(agl, 'balanceOf', [aglAddress])).toEqual('1410');
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');
      expect(await call(agl, 'balanceOf', [a1])).toEqual('10590');

      await advanceBlocks(currentEpochBlocks * 2);
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('20');

      await send(agl, 'transfer', [a2, '1000'], { from: a1 });
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');

      let t3 = await send(agl, 'claimReward', [], { from: a1 });

      expect(await call(agl, 'balanceOf', [aglAddress])).toEqual('1410');
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');
      expect(await call(agl, 'balanceOf', [a1])).toEqual('9590');
      
    });

    it('returns the holding rewards after multiple receive AGL', async () => {
      let currentBlockNumber = await blockNumber();
      let currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      let currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));

      const balanceAGL = await call(agl, 'balanceOf', [root]);
      const eligibleEpochs = await call(agl, 'eligibleEpochs', []);

      const aglAddress = agl.options.address;
      
      await send(agl, 'transfer', [aglAddress, '10000']); // send holding reward tokens to AGL contract address

      await send(agl, 'transfer', [a1, 10000], { from: root }); // 32 epochs

      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      await advanceBlocks(currentEpochBlocks * eligibleEpochs / 2);

      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      await send(agl, 'setEpochConfig', ['100', '10'], { from: root }); // set blocks and ROI per epoch by owner: 47 epoch

      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');

      await advanceBlocks(Number(currentEpochBlocks * eligibleEpochs / 2 + currentEpochBlocks)); // 77 epochs
      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));

      await send(agl, 'transfer', [a1, 5000], { from: root }); // 77 epochs

      await advanceBlocks(Number(currentEpochBlocks *  10)); // 87 epochs

      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('690'); // 10,000 AGL * (0.2% * 15 epochs + 0.1% * 29 epochs) + 10,000 AGL * 0.1% * 10 epochs

      await advanceBlocks(Number(currentEpochBlocks *  eligibleEpochs + currentEpochBlocks)); // 118 epochs
      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('1200'); // 10,000 AGL * (0.2% * 15 epochs + 0.1% * 30 epochs) + 15,000 AGL * 0.1% * 40 epochs

      await send(agl, 'transfer', [a1, 20000], { from: root }); // 118 epochs

      await advanceBlocks(Number(currentEpochBlocks *  10)); // 128 epochs

      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      // Reward Amount: 10,000 AGL * (0.2% * 15 epochs + 0.1% * 30 epochs) + 15,000 AGL * 0.1% * 50 epochs
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('1350');

      await advanceBlocks(Number(currentEpochBlocks *  eligibleEpochs + currentEpochBlocks)); // 159 epochs

      // Reward Amount: 10,000 AGL * (0.2% * 15 epochs + 0.1% * 30 epochs) + 15,000 AGL * 0.1% * 41 epochs + 35,000 AGL * 0.1% * 40 epochs
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('2615');


      let t2 = await send(agl, 'claimReward', [], { from: a1 });

      expect(await call(agl, 'balanceOf', [aglAddress])).toEqual('7385');
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');
      expect(await call(agl, 'balanceOf', [a1])).toEqual('37615');

      await advanceBlocks(currentEpochBlocks * 2);
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('70'); // 35,000 AGL * 0.1% * 2 epochs

      await send(agl, 'transfer', [a2, '1000'], { from: a1 });
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');

      let t3 = await send(agl, 'claimReward', [], { from: a1 });

      expect(await call(agl, 'balanceOf', [aglAddress])).toEqual('7385');
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');
      expect(await call(agl, 'balanceOf', [a1])).toEqual('36615');
      
    });


    it('returns the holding rewards after multiple receive AGL', async () => {
      let currentBlockNumber = await blockNumber();
      let currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      let currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));

      const balanceAGL = await call(agl, 'balanceOf', [root]);
      const eligibleEpochs = await call(agl, 'eligibleEpochs', []);

      const aglAddress = agl.options.address;
      
      await send(agl, 'transfer', [aglAddress, '10000']); // send holding reward tokens to AGL contract address

      await send(agl, 'transfer', [a1, 10000], { from: root }); // 32 epochs

      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      await advanceBlocks(currentEpochBlocks * eligibleEpochs / 2);

      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      await send(agl, 'setEpochConfig', ['100', '10'], { from: root }); // set blocks and ROI per epoch by owner: 47 epoch

      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));
      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('0');

      await advanceBlocks(Number(currentEpochBlocks * eligibleEpochs / 2 + currentEpochBlocks)); // 77 epochs
      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));

      await send(agl, 'transfer', [a1, 5000], { from: root }); // 77 epochs

      await advanceBlocks(Number(currentEpochBlocks *  10)); // 87 epochs

      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('690'); // 10,000 AGL * (0.2% * 15 epochs + 0.1% * 29 epochs) + 10,000 AGL * 0.1% * 10 epochs


      await minerStop();
      let tp3 = send(agl, 'transfer', [a1, 2000], { from: root });
      let tp4 = send(agl, 'setEpochConfig', ['100', '30'], { from: root });
      await minerStart();

      tp3 = await tp3;
      tp4 = await tp4;

      await advanceBlocks(Number(currentEpochBlocks *  eligibleEpochs + currentEpochBlocks)); // 118 epochs
      currentBlockNumber = await blockNumber();
      currentEpoch = Number(await call(agl, 'getEpochs', [currentBlockNumber.toString()]));
      currentEpochBlocks = Number(await call(agl, 'getCurrentEpochBlocks', []));

      expect(await call(agl, 'getHoldingReward', [a1])).toEqual('2280'); 
    });
  });
});
