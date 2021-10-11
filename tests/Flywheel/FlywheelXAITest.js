const {
  makeComptroller,
  makeXAI,
  balanceOf,
  fastForward,
  pretendXAIMint,
  quickMint,
  quickMintXAI
} = require('../Utils/Agile');
const {
  bnbExp,
  bnbDouble,
  bnbUnsigned
} = require('../Utils/BSC');

const agileXAIRate = bnbUnsigned(5e17);

async function agileAccrued(comptroller, user) {
  return bnbUnsigned(await call(comptroller, 'agileAccrued', [user]));
}

async function aglBalance(comptroller, user) {
  return bnbUnsigned(await call(comptroller.agl, 'balanceOf', [user]))
}

async function totalAgileAccrued(comptroller, user) {
  return (await agileAccrued(comptroller, user)).add(await aglBalance(comptroller, user));
}

describe('Flywheel', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, xaicontroller, xai;
  beforeEach(async () => {
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    xai = comptroller.xai;
    xaicontroller = comptroller.xaiunitroller;
  });

  describe('updateAgileXAIMintIndex()', () => {
    it('should calculate agl xai minter index correctly', async () => {
      await send(xaicontroller, 'setBlockNumber', [100]);
      await send(xai, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);
      await send(comptroller, '_setAgileXAIRate', [bnbExp(0.5)]);
      await send(xaicontroller, 'harnessUpdateAgileXAIMintIndex');
      /*
        xaiTokens = 10e18
        agileAccrued = deltaBlocks * setAgileXAIRate
                    = 100 * 0.5e18 = 50e18
        newIndex   += agileAccrued * 1e36 / xaiTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(xaicontroller, 'agileXAIState');
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      await send(xaicontroller, 'harnessUpdateAgileXAIMintIndex');

      const {index, block} = await call(xaicontroller, 'agileXAIState');
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });
  });

  describe('distributeXAIMinterAgile()', () => {
    it('should update xai minter index checkpoint but not agileAccrued for first time user', async () => {
      await send(xaicontroller, "setAgileXAIState", [bnbDouble(6), 10]);
      await send(xaicontroller, "setAgileXAIMinterIndex", [root, bnbUnsigned(0)]);

      await send(comptroller, "harnessDistributeXAIMinterAgile", [root]);
      expect(await call(comptroller, "agileAccrued", [root])).toEqualNumber(0);
      expect(await call(xaicontroller, "agileXAIMinterIndex", [root])).toEqualNumber(6e36);
    });

    it('should transfer agl and update xai minter index checkpoint correctly for repeat time user', async () => {
      await send(comptroller.agl, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});
      await send(xai, "harnessSetBalanceOf", [a1, bnbUnsigned(5e18)]);
      await send(comptroller, "harnessSetMintedXAIs", [a1, bnbUnsigned(5e18)]);
      await send(xaicontroller, "setAgileXAIState", [bnbDouble(6), 10]);
      await send(xaicontroller, "setAgileXAIMinterIndex", [a1, bnbDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total xai mint, 0.5e18 xaiMinterSpeed => 6e18 agileXAIMintIndex
      * this tests that an acct with half the total xai mint over that time gets 25e18 AGL
        xaiMinterAmount = xaiBalance * 1e18
                       = 5e18 * 1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        xaiMinterAccrued= xaiMinterAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeXAIMinterAgile", [a1]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedXAIMinterAgile', {
        xaiMinter: a1,
        agileDelta: bnbUnsigned(25e18).toString(),
        agileXAIMintIndex: bnbDouble(6).toString()
      });
    });

    it('should not transfer if below agl claim threshold', async () => {
      await send(comptroller.agl, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(xai, "harnessSetBalanceOf", [a1, bnbUnsigned(5e17)]);
      await send(comptroller, "harnessSetMintedXAIs", [a1, bnbUnsigned(5e17)]);
      await send(xaicontroller, "setAgileXAIState", [bnbDouble(1.0019), 10]);
      /*
        xaiMinterAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        xaiMintedAccrued+= xaiMinterTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeXAIMinterAgile", [a1]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(0);
    });
  });

  describe('claimAgile', () => {
    it('should accrue agl and then transfer agl accrued', async () => {
      const aglRemaining = agileXAIRate.mul(100), mintAmount = bnbUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.agl, 'transfer', [comptroller._address, aglRemaining], {from: root});
      //await pretendXAIMint(xai, a1, 1);
      const speed = await call(comptroller, 'agileXAIRate');
      const a2AccruedPre = await agileAccrued(comptroller, a2);
      const aglBalancePre = await aglBalance(comptroller, a2);
      await quickMintXAI(comptroller, xai, a2, mintAmount);
      await fastForward(xaicontroller, deltaBlocks);
      const tx = await send(comptroller, 'claimAgile', [a2]);
      const a2AccruedPost = await agileAccrued(comptroller, a2);
      const aglBalancePost = await aglBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(400000);
      expect(speed).toEqualNumber(agileXAIRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(aglBalancePre).toEqualNumber(0);
      expect(aglBalancePost).toEqualNumber(agileXAIRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should claim when agl accrued is below threshold', async () => {
      const aglRemaining = bnbExp(1), accruedAmt = bnbUnsigned(0.0009e18)
      await send(comptroller.agl, 'transfer', [comptroller._address, aglRemaining], {from: root});
      await send(comptroller, 'setAgileAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimAgile', [a1]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });
  });

  describe('claimAgile batch', () => {
    it('should claim the expected amount when holders and arg is duplicated', async () => {
      const aglRemaining = agileXAIRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.agl, 'transfer', [comptroller._address, aglRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        await send(xai, 'harnessIncrementTotalSupply', [mintAmount]);
        expect(await send(xai, 'harnessSetBalanceOf', [from, mintAmount], { from })).toSucceed();
        expect(await await send(comptroller, 'harnessSetMintedXAIs', [from, mintAmount], { from })).toSucceed();
      }
      await fastForward(xaicontroller, deltaBlocks);

      const tx = await send(comptroller, 'claimAgile', [[...claimAccts, ...claimAccts], [], false, false]);
      // agl distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(xaicontroller, 'agileXAIMinterIndex', [acct])).toEqualNumber(bnbDouble(1.0625));
        expect(await aglBalance(comptroller, acct)).toEqualNumber(bnbExp(0.625));
      }
    });

    it('claims agl for multiple xai minters only, primes uninitiated', async () => {
      const aglRemaining = agileXAIRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10), xaiAmt = bnbExp(1), xaiMintIdx = bnbExp(1)
      await send(comptroller.agl, 'transfer', [comptroller._address, aglRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(xai, 'harnessIncrementTotalSupply', [xaiAmt]);
        await send(xai, 'harnessSetBalanceOf', [acct, xaiAmt]);
        await send(comptroller, 'harnessSetMintedXAIs', [acct, xaiAmt]);
      }

      await send(xaicontroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimAgile', [claimAccts, [], false, false]);
      for(let acct of claimAccts) {
        expect(await call(xaicontroller, 'agileXAIMinterIndex', [acct])).toEqualNumber(bnbDouble(1.625));
      }
    });
  });

  describe('_setAgileXAIRate', () => {
    it('should correctly change agile xai rate if called by admin', async () => {
      expect(await call(comptroller, 'agileXAIRate')).toEqualNumber(agileXAIRate);
      const tx1 = await send(comptroller, '_setAgileXAIRate', [bnbUnsigned(3e18)]);
      expect(await call(comptroller, 'agileXAIRate')).toEqualNumber(bnbUnsigned(3e18));
      const tx2 = await send(comptroller, '_setAgileXAIRate', [bnbUnsigned(2e18)]);
      expect(await call(comptroller, 'agileXAIRate')).toEqualNumber(bnbUnsigned(2e18));
      expect(tx2).toHaveLog('NewAgileXAIRate', {
        oldAgileXAIRate: bnbUnsigned(3e18),
        newAgileXAIRate: bnbUnsigned(2e18)
      });
    });

    it('should not change agile xai rate unless called by admin', async () => {
      await expect(
        send(comptroller, '_setAgileXAIRate', [bnbUnsigned(1e18)], {from: a1})
      ).rejects.toRevert('revert only admin can');
    });
  });
});
