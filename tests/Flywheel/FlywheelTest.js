const {
  makeComptroller,
  makeAToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint
} = require('../Utils/Agile');
const {
  bnbExp,
  bnbDouble,
  bnbUnsigned
} = require('../Utils/BSC');

const agileRate = bnbUnsigned(1e18);

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
  let comptroller, aLOW, aREP, aZRX, aEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    aLOW = await makeAToken({comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    aREP = await makeAToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    aZRX = await makeAToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    aEVIL = await makeAToken({comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts});
  });

  describe('getAgileMarkets()', () => {
    it('should return the agile markets', async () => {
      for (let mkt of [aLOW, aREP, aZRX]) {
        await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0.5)]);
      }
      expect(await call(comptroller, 'getAgileMarkets')).toEqual(
        [aLOW, aREP, aZRX].map((c) => c._address)
      );
    });
  });

  describe('_setAgileSpeed()', () => {
    it('should update market index when calling setAgileSpeed', async () => {
      const mkt = aREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);

      await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0.5)]);
      await fastForward(comptroller, 20);
      await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(1)]);

      const {index, block} = await call(comptroller, 'agileSupplyState', [mkt._address]);
      expect(index).toEqualNumber(2e36);
      expect(block).toEqualNumber(20);
    });

    it('should correctly drop a agl market if called by admin', async () => {
      for (let mkt of [aLOW, aREP, aZRX]) {
        await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0.5)]);
      }
      const tx = await send(comptroller, '_setAgileSpeed', [aLOW._address, 0]);
      expect(await call(comptroller, 'getAgileMarkets')).toEqual(
        [aREP, aZRX].map((c) => c._address)
      );
      expect(tx).toHaveLog('AgileSpeedUpdated', {
        aToken: aLOW._address,
        newSpeed: 0
      });
    });

    it('should correctly drop a agl market from middle of array', async () => {
      for (let mkt of [aLOW, aREP, aZRX]) {
        await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0.5)]);
      }
      await send(comptroller, '_setAgileSpeed', [aREP._address, 0]);
      expect(await call(comptroller, 'getAgileMarkets')).toEqual(
        [aLOW, aZRX].map((c) => c._address)
      );
    });

    it('should not drop a agl market unless called by admin', async () => {
      for (let mkt of [aLOW, aREP, aZRX]) {
        await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0.5)]);
      }
      await expect(
        send(comptroller, '_setAgileSpeed', [aLOW._address, 0], {from: a1})
      ).rejects.toRevert('revert only admin can set agile speed');
    });

    it('should not add non-listed markets', async () => {
      const aBAT = await makeAToken({ comptroller, supportMarket: false });
      await expect(
        send(comptroller, 'harnessAddAgileMarkets', [[aBAT._address]])
      ).rejects.toRevert('revert agile market is not listed');

      const markets = await call(comptroller, 'getAgileMarkets');
      expect(markets).toEqual([]);
    });
  });

  describe('updateAgileBorrowIndex()', () => {
    it('should calculate agl borrower index correctly', async () => {
      const mkt = aREP;
      await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalBorrows', [bnbUnsigned(11e18)]);
      await send(comptroller, 'harnessUpdateAgileBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        agileAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + agileAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(comptroller, 'agileBorrowState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not revert or update agileBorrowState index if aToken not in Agile markets', async () => {
      const mkt = await makeAToken({
        comptroller: comptroller,
        supportMarket: true,
        addAgileMarket: false,
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateAgileBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'agileBorrowState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'agileSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = aREP;
      await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'harnessUpdateAgileBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'agileBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not update index if agile speed is 0', async () => {
      const mkt = aREP;
      await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0)]);
      await send(comptroller, 'harnessUpdateAgileBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'agileBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(100);
    });
  });

  describe('updateAgileSupplyIndex()', () => {
    it('should calculate agl supplier index correctly', async () => {
      const mkt = aREP;
      await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);
      await send(comptroller, 'harnessUpdateAgileSupplyIndex', [mkt._address]);
      /*
        suppyTokens = 10e18
        agileAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += agileAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const {index, block} = await call(comptroller, 'agileSupplyState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index on non-Agile markets', async () => {
      const mkt = await makeAToken({
        comptroller: comptroller,
        supportMarket: true,
        addAgileMarket: false
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateAgileSupplyIndex', [
        mkt._address
      ]);

      const {index, block} = await call(comptroller, 'agileSupplyState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'agileSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
      // atoken could have no agile speed or agl supplier state if not in agile markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = aREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);
      await send(comptroller, '_setAgileSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'harnessUpdateAgileSupplyIndex', [mkt._address]);

      const {index, block} = await call(comptroller, 'agileSupplyState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not matter if the index is updated multiple times', async () => {
      const agileRemaining = agileRate.mul(100)
      await send(comptroller, 'harnessAddAgileMarkets', [[aLOW._address]]);
      await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      await pretendBorrow(aLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessRefreshAgileSpeeds');

      await quickMint(aLOW, a2, bnbUnsigned(10e18));
      await quickMint(aLOW, a3, bnbUnsigned(15e18));

      const a2Accrued0 = await totalAgileAccrued(comptroller, a2);
      const a3Accrued0 = await totalAgileAccrued(comptroller, a3);
      const a2Balance0 = await balanceOf(aLOW, a2);
      const a3Balance0 = await balanceOf(aLOW, a3);

      await fastForward(comptroller, 20);

      const txT1 = await send(aLOW, 'transfer', [a2, a3Balance0.sub(a2Balance0)], {from: a3});

      const a2Accrued1 = await totalAgileAccrued(comptroller, a2);
      const a3Accrued1 = await totalAgileAccrued(comptroller, a3);
      const a2Balance1 = await balanceOf(aLOW, a2);
      const a3Balance1 = await balanceOf(aLOW, a3);

      await fastForward(comptroller, 10);
      await send(comptroller, 'harnessUpdateAgileSupplyIndex', [aLOW._address]);
      await fastForward(comptroller, 10);

      const txT2 = await send(aLOW, 'transfer', [a3, a2Balance1.sub(a3Balance1)], {from: a2});

      const a2Accrued2 = await totalAgileAccrued(comptroller, a2);
      const a3Accrued2 = await totalAgileAccrued(comptroller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.sub(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.sub(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(220000);
      expect(txT1.gasUsed).toBeGreaterThan(150000);
      expect(txT2.gasUsed).toBeLessThan(150000);
      expect(txT2.gasUsed).toBeGreaterThan(100000);
    });
  });

  describe('distributeBorrowerAgile()', () => {

    it('should update borrow index checkpoint but not agileAccrued for first time user', async () => {
      const mkt = aREP;
      await send(comptroller, "setAgileBorrowState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setAgileBorrowerIndex", [mkt._address, root, bnbUnsigned(0)]);

      await send(comptroller, "harnessDistributeBorrowerAgile", [mkt._address, root, bnbExp(1.1)]);
      expect(await call(comptroller, "agileAccrued", [root])).toEqualNumber(0);
      expect(await call(comptroller, "agileBorrowerIndex", [ mkt._address, root])).toEqualNumber(6e36);
    });

    it('should transfer agl and update borrow index checkpoint correctly for repeat time user', async () => {
      const mkt = aREP;
      await send(comptroller.agl, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, bnbUnsigned(5.5e18), bnbExp(1)]);
      await send(comptroller, "setAgileBorrowState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setAgileBorrowerIndex", [mkt._address, a1, bnbDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 agileBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 AGL
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBorrowerAgile", [mkt._address, a1, bnbUnsigned(1.1e18)]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedBorrowerAgile', {
        aToken: mkt._address,
        borrower: a1,
        agileDelta: bnbUnsigned(25e18).toString(),
        agileBorrowIndex: bnbDouble(6).toString()
      });
    });

    it('should not transfer agl automatically', async () => {
      const mkt = aREP;
      await send(comptroller.agl, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, bnbUnsigned(5.5e17), bnbExp(1)]);
      await send(comptroller, "setAgileBorrowState", [mkt._address, bnbDouble(1.0019), 10]);
      await send(comptroller, "setAgileBorrowerIndex", [mkt._address, a1, bnbDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < agileClaimThreshold of 0.001e18
      */
      await send(comptroller, "harnessDistributeBorrowerAgile", [mkt._address, a1, bnbExp(1.1)]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-Agile market', async () => {
      const mkt = await makeAToken({
        comptroller: comptroller,
        supportMarket: true,
        addAgileMarket: false,
      });

      await send(comptroller, "harnessDistributeBorrowerAgile", [mkt._address, a1, bnbExp(1.1)]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'agileBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });
  });

  describe('distributeSupplierAgile()', () => {
    it('should transfer agl and update supply index correctly for first time user', async () => {
      const mkt = aREP;
      await send(comptroller.agl, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e18)]);
      await send(comptroller, "setAgileSupplyState", [mkt._address, bnbDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 agileSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 AGL:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(comptroller, "harnessDistributeAllSupplierAgile", [mkt._address, a1]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedSupplierAgile', {
        aToken: mkt._address,
        supplier: a1,
        agileDelta: bnbUnsigned(25e18).toString(),
        agileSupplyIndex: bnbDouble(6).toString()
      });
    });

    it('should update agl accrued and supply index for repeat user', async () => {
      const mkt = aREP;
      await send(comptroller.agl, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e18)]);
      await send(comptroller, "setAgileSupplyState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setAgileSupplierIndex", [mkt._address, a1, bnbDouble(2)])
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

     await send(comptroller, "harnessDistributeAllSupplierAgile", [mkt._address, a1]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(20e18);
    });

    it('should not transfer when agileAccrued below threshold', async () => {
      const mkt = aREP;
      await send(comptroller.agl, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e17)]);
      await send(comptroller, "setAgileSupplyState", [mkt._address, bnbDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeSupplierAgile", [mkt._address, a1]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-Agile market', async () => {
      const mkt = await makeAToken({
        comptroller: comptroller,
        supportMarket: true,
        addAgileMarket: false,
      });

      await send(comptroller, "harnessDistributeSupplierAgile", [mkt._address, a1]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'agileBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });

  });

  describe('transferAGL', () => {
    it('should transfer agl accrued when amount is above threshold', async () => {
      const agileRemaining = 1000, a1AccruedPre = 100, threshold = 1;
      const aglBalancePre = await aglBalance(comptroller, a1);
      const tx0 = await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      const tx1 = await send(comptroller, 'setAgileAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferAgile', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await agileAccrued(comptroller, a1);
      const aglBalancePost = await aglBalance(comptroller, a1);
      expect(aglBalancePre).toEqualNumber(0);
      expect(aglBalancePost).toEqualNumber(a1AccruedPre);
    });

    it('should not transfer when agl accrued is below threshold', async () => {
      const agileRemaining = 1000, a1AccruedPre = 100, threshold = 101;
      const aglBalancePre = await call(comptroller.agl, 'balanceOf', [a1]);
      const tx0 = await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      const tx1 = await send(comptroller, 'setAgileAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferAgile', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await agileAccrued(comptroller, a1);
      const aglBalancePost = await aglBalance(comptroller, a1);
      expect(aglBalancePre).toEqualNumber(0);
      expect(aglBalancePost).toEqualNumber(0);
    });

    it('should not transfer agl if agl accrued is greater than agl remaining', async () => {
      const agileRemaining = 99, a1AccruedPre = 100, threshold = 1;
      const aglBalancePre = await aglBalance(comptroller, a1);
      const tx0 = await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      const tx1 = await send(comptroller, 'setAgileAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferAgile', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await agileAccrued(comptroller, a1);
      const aglBalancePost = await aglBalance(comptroller, a1);
      expect(aglBalancePre).toEqualNumber(0);
      expect(aglBalancePost).toEqualNumber(0);
    });
  });

  describe('claimAgile', () => {
    it('should accrue agl and then transfer agl accrued', async () => {
      const agileRemaining = agileRate.mul(100), mintAmount = bnbUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      await pretendBorrow(aLOW, a1, 1, 1, 100);
      await send(comptroller, '_setAgileSpeed', [aLOW._address, bnbExp(0.5)]);
      await send(comptroller, 'harnessRefreshAgileSpeeds');
      const speed = await call(comptroller, 'agileSpeeds', [aLOW._address]);
      const a2AccruedPre = await agileAccrued(comptroller, a2);
      const aglBalancePre = await aglBalance(comptroller, a2);
      await quickMint(aLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimAgile', [a2]);
      const a2AccruedPost = await agileAccrued(comptroller, a2);
      const aglBalancePost = await aglBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(500000);
      expect(speed).toEqualNumber(agileRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(aglBalancePre).toEqualNumber(0);
      expect(aglBalancePost).toEqualNumber(agileRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should accrue agl and then transfer agl accrued in a single market', async () => {
      const agileRemaining = agileRate.mul(100), mintAmount = bnbUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      await pretendBorrow(aLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddAgileMarkets', [[aLOW._address]]);
      await send(comptroller, 'harnessRefreshAgileSpeeds');
      const speed = await call(comptroller, 'agileSpeeds', [aLOW._address]);
      const a2AccruedPre = await agileAccrued(comptroller, a2);
      const aglBalancePre = await aglBalance(comptroller, a2);
      await quickMint(aLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimAgile', [a2, [aLOW._address]]);
      const a2AccruedPost = await agileAccrued(comptroller, a2);
      const aglBalancePost = await aglBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(300000);
      expect(speed).toEqualNumber(agileRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(aglBalancePre).toEqualNumber(0);
      expect(aglBalancePost).toEqualNumber(agileRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should claim when agl accrued is below threshold', async () => {
      const agileRemaining = bnbExp(1), accruedAmt = bnbUnsigned(0.0009e18)
      await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      await send(comptroller, 'setAgileAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimAgile', [a1, [aLOW._address]]);
      expect(await agileAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await aglBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const aNOT = await makeAToken({comptroller});
      await expect(
        send(comptroller, 'claimAgile', [a1, [aNOT._address]])
      ).rejects.toRevert('revert not listed market');
    });
  });

  describe('claimAgile batch', () => {
    it('should revert when claiming agl from non-listed market', async () => {
      const agileRemaining = agileRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;

      for(let from of claimAccts) {
        expect(await send(aLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(aLOW.underlying, 'approve', [aLOW._address, mintAmount], { from });
        send(aLOW, 'mint', [mintAmount], { from });
      }

      await pretendBorrow(aLOW, root, 1, 1, bnbExp(10));
      await send(comptroller, 'harnessRefreshAgileSpeeds');

      await fastForward(comptroller, deltaBlocks);

      await expect(send(comptroller, 'claimAgile', [claimAccts, [aLOW._address, aEVIL._address], true, true])).rejects.toRevert('revert not listed market');
    });

    it('should claim the expected amount when holders and atokens arg is duplicated', async () => {
      const agileRemaining = agileRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(aLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(aLOW.underlying, 'approve', [aLOW._address, mintAmount], { from });
        send(aLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(aLOW, root, 1, 1, bnbExp(10));
      await send(comptroller, 'harnessAddAgileMarkets', [[aLOW._address]]);
      await send(comptroller, 'harnessRefreshAgileSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimAgile', [[...claimAccts, ...claimAccts], [aLOW._address, aLOW._address], false, true]);
      // agl distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'agileSupplierIndex', [aLOW._address, acct])).toEqualNumber(bnbDouble(1.125));
        expect(await aglBalance(comptroller, acct)).toEqualNumber(bnbExp(1.25));
      }
    });

    it('claims agl for multiple suppliers only', async () => {
      const agileRemaining = agileRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(aLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(aLOW.underlying, 'approve', [aLOW._address, mintAmount], { from });
        send(aLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(aLOW, root, 1, 1, bnbExp(10));
      await send(comptroller, 'harnessAddAgileMarkets', [[aLOW._address]]);
      await send(comptroller, 'harnessRefreshAgileSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimAgile', [claimAccts, [aLOW._address], false, true]);
      // agl distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'agileSupplierIndex', [aLOW._address, acct])).toEqualNumber(bnbDouble(1.125));
        expect(await aglBalance(comptroller, acct)).toEqualNumber(bnbExp(1.25));
      }
    });

    it('claims agl for multiple borrowers only, primes uninitiated', async () => {
      const agileRemaining = agileRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10), borrowAmt = bnbExp(1), borrowIdx = bnbExp(1)
      await send(comptroller.agl, 'transfer', [comptroller._address, agileRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(aLOW, 'harnessIncrementTotalBorrows', [borrowAmt]);
        await send(aLOW, 'harnessSetAccountBorrows', [acct, borrowAmt, borrowIdx]);
      }
      await send(comptroller, 'harnessAddAgileMarkets', [[aLOW._address]]);
      await send(comptroller, 'harnessRefreshAgileSpeeds');

      await send(comptroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimAgile', [claimAccts, [aLOW._address], true, false]);
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'agileBorrowerIndex', [aLOW._address, acct])).toEqualNumber(bnbDouble(2.25));
        expect(await call(comptroller, 'agileSupplierIndex', [aLOW._address, acct])).toEqualNumber(0);
      }
    });

    it('should revert when a market is not listed', async () => {
      const aNOT = await makeAToken({comptroller});
      await expect(
        send(comptroller, 'claimAgile', [[a1, a2], [aNOT._address], true, true])
      ).rejects.toRevert('revert not listed market');
    });
  });

  describe('harnessRefreshAgileSpeeds', () => {
    it('should start out 0', async () => {
      await send(comptroller, 'harnessRefreshAgileSpeeds');
      const speed = await call(comptroller, 'agileSpeeds', [aLOW._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should get correct speeds with borrows', async () => {
      await pretendBorrow(aLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddAgileMarkets', [[aLOW._address]]);
      const tx = await send(comptroller, 'harnessRefreshAgileSpeeds');
      const speed = await call(comptroller, 'agileSpeeds', [aLOW._address]);
      expect(speed).toEqualNumber(agileRate);
      expect(tx).toHaveLog(['AgileSpeedUpdated', 0], {
        aToken: aLOW._address,
        newSpeed: speed
      });
    });

    it('should get correct speeds for 2 assets', async () => {
      await pretendBorrow(aLOW, a1, 1, 1, 100);
      await pretendBorrow(aZRX, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddAgileMarkets', [[aLOW._address, aZRX._address]]);
      await send(comptroller, 'harnessRefreshAgileSpeeds');
      const speed1 = await call(comptroller, 'agileSpeeds', [aLOW._address]);
      const speed2 = await call(comptroller, 'agileSpeeds', [aREP._address]);
      const speed3 = await call(comptroller, 'agileSpeeds', [aZRX._address]);
      expect(speed1).toEqualNumber(agileRate.div(4));
      expect(speed2).toEqualNumber(0);
      expect(speed3).toEqualNumber(agileRate.div(4).mul(3));
    });
  });

  describe('harnessAddAgileMarkets', () => {
    it('should correctly add a agile market if called by admin', async () => {
      const aBAT = await makeAToken({comptroller, supportMarket: true});
      const tx1 = await send(comptroller, 'harnessAddAgileMarkets', [[aLOW._address, aREP._address, aZRX._address]]);
      const tx2 = await send(comptroller, 'harnessAddAgileMarkets', [[aBAT._address]]);
      const markets = await call(comptroller, 'getAgileMarkets');
      expect(markets).toEqual([aLOW, aREP, aZRX, aBAT].map((c) => c._address));
      expect(tx2).toHaveLog('AgileSpeedUpdated', {
        aToken: aBAT._address,
        newSpeed: 1
      });
    });

    it('should not write over a markets existing state', async () => {
      const mkt = aLOW._address;
      const bn0 = 10, bn1 = 20;
      const idx = bnbUnsigned(1.5e36);

      await send(comptroller, "harnessAddAgileMarkets", [[mkt]]);
      await send(comptroller, "setAgileSupplyState", [mkt, idx, bn0]);
      await send(comptroller, "setAgileBorrowState", [mkt, idx, bn0]);
      await send(comptroller, "setBlockNumber", [bn1]);
      await send(comptroller, "_setAgileSpeed", [mkt, 0]);
      await send(comptroller, "harnessAddAgileMarkets", [[mkt]]);

      const supplyState = await call(comptroller, 'agileSupplyState', [mkt]);
      expect(supplyState.block).toEqual(bn1.toString());
      expect(supplyState.index).toEqual(idx.toString());

      const borrowState = await call(comptroller, 'agileBorrowState', [mkt]);
      expect(borrowState.block).toEqual(bn1.toString());
      expect(borrowState.index).toEqual(idx.toString());
    });
  });
});
