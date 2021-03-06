const {
  address,
  encodeParameters,
} = require('../Utils/BSC');
const {
  makeComptroller,
  makeAToken,
} = require('../Utils/Agile');

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

describe('AgileLens', () => {
  let AgileLens;
  let acct;

  beforeEach(async () => {
    AgileLens = await deploy('AgileLens');
    acct = accounts[0];
  });

  describe('aTokenMetadata', () => {
    it('is correct for a aBep20', async () => {
      let aBep20 = await makeAToken();
      expect(
        cullTuple(await call(AgileLens, 'aTokenMetadata', [aBep20._address]))
      ).toEqual(
        {
          aToken: aBep20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(aBep20, 'underlying', []),
          aTokenDecimals: "8",
          underlyingDecimals: "18"
        }
      );
    });

    it('is correct for aBnb', async () => {
      let aBnb = await makeAToken({kind: 'abnb'});
      expect(
        cullTuple(await call(AgileLens, 'aTokenMetadata', [aBnb._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        aToken: aBnb._address,
        aTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
      });
    });
  });

  describe('aTokenMetadataAll', () => {
    it('is correct for a aBep20 and aBnb', async () => {
      let aBep20 = await makeAToken();
      let aBnb = await makeAToken({kind: 'abnb'});
      expect(
        (await call(AgileLens, 'aTokenMetadataAll', [[aBep20._address, aBnb._address]])).map(cullTuple)
      ).toEqual([
        {
          aToken: aBep20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(aBep20, 'underlying', []),
          aTokenDecimals: "8",
          underlyingDecimals: "18"
        },
        {
          borrowRatePerBlock: "0",
          aToken: aBnb._address,
          aTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
        }
      ]);
    });
  });

  describe('aTokenBalances', () => {
    it('is correct for aBEP20', async () => {
      let aBep20 = await makeAToken();
      expect(
        cullTuple(await call(AgileLens, 'aTokenBalances', [aBep20._address, acct]))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          aToken: aBep20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        }
      );
    });

    it('is correct for aBNB', async () => {
      let aBnb = await makeAToken({kind: 'abnb'});
      let bnbBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(AgileLens, 'aTokenBalances', [aBnb._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          aToken: aBnb._address,
          tokenAllowance: bnbBalance,
          tokenBalance: bnbBalance,
        }
      );
    });
  });

  describe('aTokenBalancesAll', () => {
    it('is correct for aBnb and aBep20', async () => {
      let aBep20 = await makeAToken();
      let aBnb = await makeAToken({kind: 'abnb'});
      let bnbBalance = await web3.eth.getBalance(acct);
      
      expect(
        (await call(AgileLens, 'aTokenBalancesAll', [[aBep20._address, aBnb._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          aToken: aBep20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          aToken: aBnb._address,
          tokenAllowance: bnbBalance,
          tokenBalance: bnbBalance,
        }
      ]);
    })
  });

  describe('aTokenUnderlyingPrice', () => {
    it('gets correct price for aBep20', async () => {
      let aBep20 = await makeAToken();
      expect(
        cullTuple(await call(AgileLens, 'aTokenUnderlyingPrice', [aBep20._address]))
      ).toEqual(
        {
          aToken: aBep20._address,
          underlyingPrice: "0",
        }
      );
    });

    it('gets correct price for aBnb', async () => {
      let aBnb = await makeAToken({kind: 'abnb'});
      expect(
        cullTuple(await call(AgileLens, 'aTokenUnderlyingPrice', [aBnb._address]))
      ).toEqual(
        {
          aToken: aBnb._address,
          underlyingPrice: "1000000000000000000",
        }
      );
    });
  });

  describe('aTokenUnderlyingPriceAll', () => {
    it('gets correct price for both', async () => {
      let aBep20 = await makeAToken();
      let aBnb = await makeAToken({kind: 'abnb'});
      expect(
        (await call(AgileLens, 'aTokenUnderlyingPriceAll', [[aBep20._address, aBnb._address]])).map(cullTuple)
      ).toEqual([
        {
          aToken: aBep20._address,
          underlyingPrice: "0",
        },
        {
          aToken: aBnb._address,
          underlyingPrice: "1000000000000000000",
        }
      ]);
    });
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let comptroller = await makeComptroller();

      expect(
        cullTuple(await call(AgileLens, 'getAccountLimits', [comptroller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });

  describe('governance', () => {
    let agl, gov;
    let targets, values, signatures, callDatas;
    let proposalBlock, proposalId;
    let votingDelay;
    let votingPeriod;

    beforeEach(async () => {
      agl = await deploy('AGL', [acct]);
      gov = await deploy('GovernorAlpha', [address(0), agl._address, address(0)]);
      targets = [acct];
      values = ["0"];
      signatures = ["getBalanceOf(address)"];
      callDatas = [encodeParameters(['address'], [acct])];
      await send(agl, 'delegate', [acct]);
      await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"]);
      proposalBlock = +(await web3.eth.getBlockNumber());
      proposalId = await call(gov, 'latestProposalIds', [acct]);
      votingDelay = Number(await call(gov, 'votingDelay'));
      votingPeriod = Number(await call(gov, 'votingPeriod'));
    });

    describe('getGovReceipts', () => {
      it('gets correct values', async () => {
        expect(
          (await call(AgileLens, 'getGovReceipts', [gov._address, acct, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            hasVoted: false,
            proposalId: proposalId,
            support: false,
            votes: "0",
          }
        ]);
      })
    });

    describe('getGovProposals', () => {
      it('gets correct values', async () => {
        expect(
          (await call(AgileLens, 'getGovProposals', [gov._address, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            againstVotes: "0",
            calldatas: callDatas,
            canceled: false,
            endBlock: (Number(proposalBlock) + votingDelay + votingPeriod).toString(),
            eta: "0",
            executed: false,
            forVotes: "0",
            proposalId: proposalId,
            proposer: acct,
            signatures: signatures,
            startBlock: (Number(proposalBlock) + votingDelay).toString(),
            targets: targets
          }
        ]);
      })
    });
  });

  describe('agl', () => {
    let agl, currentBlock;

    beforeEach(async () => {
      currentBlock = +(await web3.eth.getBlockNumber());
      agl = await deploy('AGL', [acct]);
    });

    describe('getAGLBalanceMetadata', () => {
      it('gets correct values', async () => {
        expect(
          cullTuple(await call(AgileLens, 'getAGLBalanceMetadata', [agl._address, acct]))
        ).toEqual({
          balance: "1000000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
        });
      });
    });

    describe('getAGLBalanceMetadataExt', () => {
      it('gets correct values', async () => {
        let comptroller = await makeComptroller();
        await send(comptroller, 'setAgileAccrued', [acct, 5]); // harness only

        expect(
          cullTuple(await call(AgileLens, 'getAGLBalanceMetadataExt', [agl._address, comptroller._address, acct]))
        ).toEqual({
          balance: "1000000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
          allocated: "5"
        });
      });
    });

    describe('getAgileVotes', () => {
      it('gets correct values', async () => {
        expect(
          (await call(AgileLens, 'getAgileVotes', [agl._address, acct, [currentBlock, currentBlock - 1]])).map(cullTuple)
        ).toEqual([
          {
            blockNumber: currentBlock.toString(),
            votes: "0",
          },
          {
            blockNumber: (Number(currentBlock) - 1).toString(),
            votes: "0",
          }
        ]);
      });

      it('reverts on future value', async () => {
        await expect(
          call(AgileLens, 'getAgileVotes', [agl._address, acct, [currentBlock + 1]])
        ).rejects.toRevert('revert AGL::getPriorVotes: not yet determined')
      });
    });
  });
});
