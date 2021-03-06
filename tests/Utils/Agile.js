"use strict";

const { dfn } = require('./JS');
const {
  encodeParameters,
  bnbBalance,
  bnbMantissa,
  bnbUnsigned,
  mergeInterface
} = require('./BSC');

async function makeComptroller(opts = {}) {
  const {
    root = saddle.account,
    treasuryGuardian = saddle.accounts[4],
    treasuryAddress = saddle.accounts[4],
    kind = 'unitroller'
  } = opts || {};

  if (kind == 'bool') {
    const comptroller = await deploy('BoolComptroller');
    const agl = opts.agl || await deploy('AGL', [opts.agileOwner || root]);

    //await send(unitroller, '_setTreasuryData', [treasuryGuardian, treasuryAddress, 1e14]);

    return Object.assign(comptroller, { agl });
  }

  if (kind == 'boolFee') {
    const comptroller = await deploy('BoolComptroller');
    await send(comptroller, 'setTreasuryData', [treasuryGuardian, treasuryAddress, 1e14]);
    return comptroller;
  }

  if (kind == 'false-marker') {
    return await deploy('FalseMarkerMethodComptroller');
  }

  if (kind == 'v1-no-proxy') {
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = bnbMantissa(dfn(opts.closeFactor, .051));

    await send(comptroller, '_setCloseFactor', [closeFactor]);
    await send(comptroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(comptroller, { priceOracle });
  }

  if (kind == 'unitroller-g2') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG2');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = bnbMantissa(dfn(opts.closeFactor, .051));
    const liquidationIncentive = bnbMantissa(1);
    const agl = opts.agl || await deploy('AGL', [opts.compOwner || root]);
    const agileRate = bnbUnsigned(dfn(opts.agileRate, 1e18));

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'harnessSetAgileRate', [agileRate]);
    await send(unitroller, 'setAGLAddress', [agl._address]); // harness only

    return Object.assign(unitroller, { priceOracle, agl });
  }

  if (kind == 'unitroller') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = bnbMantissa(dfn(opts.closeFactor, .051));
    const liquidationIncentive = bnbMantissa(1);
    const agl = opts.agl || await deploy('AGL', [opts.agileOwner || root]);
    const agileRate = bnbUnsigned(dfn(opts.agileRate, 1e18));
    const agileMarkets = opts.agileMarkets || [];

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);

    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'setAGLAddress', [agl._address]); // harness only
    await send(unitroller, 'harnessSetAgileRate', [agileRate]);
    
    await send(unitroller, '_setTreasuryData', [treasuryGuardian, treasuryAddress, 1e14]);

    return Object.assign(unitroller, { priceOracle, agl });
  }
}

async function makeAToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'abep20'
  } = opts || {};

  const comptroller = opts.comptroller || await makeComptroller(opts.comptrollerOpts);
  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  const exchangeRate = bnbMantissa(dfn(opts.exchangeRate, 1));
  const decimals = bnbUnsigned(dfn(opts.decimals, 8));
  const symbol = opts.symbol || (kind === 'abnb' ? 'aBNB' : 'aOMG');
  const name = opts.name || `AToken ${symbol}`;
  const admin = opts.admin || root;

  let aToken, underlying;
  let aDelegator, aDelegatee, aDaiMaker;

  switch (kind) {
    case 'abnb':
      aToken = await deploy('ABNBHarness',
        [
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin
        ])
      break;

    case 'adai':
      aDaiMaker  = await deploy('aDaiDelegateMakerHarness');
      underlying = aDaiMaker;
      aDelegatee = await deploy('aDaiDelegateHarness');
      aDelegator = await deploy('ABep20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          aDelegatee._address,
          encodeParameters(['address', 'address'], [aDaiMaker._address, aDaiMaker._address])
        ]
      );
      aToken = await saddle.getContractAt('aDaiDelegateHarness', aDelegator._address);
      break;

    case 'aagl':
      underlying = await deploy('AGL', [opts.compHolder || root]);
      aDelegatee = await deploy('AAglLikeDelegate');
      aDelegator = await deploy('ABep20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          aDelegatee._address,
          "0x0"
        ]
      );
      aToken = await saddle.getContractAt('AAglLikeDelegate', aDelegator._address);
      break;

    case 'abep20':
    default:
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      aDelegatee = await deploy('ABep20DelegateHarness');
      aDelegator = await deploy('ABep20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          aDelegatee._address,
          "0x0"
        ]
      );
      aToken = await saddle.getContractAt('ABep20DelegateHarness', aDelegator._address);
      break;
  }

  if (opts.supportMarket) {
    await send(comptroller, '_supportMarket', [aToken._address]);
  }

  if (opts.addAgileMarket) {
    await send(comptroller, '_addAgileMarket', [aToken._address]);
  }

  if (opts.underlyingPrice) {
    const price = bnbMantissa(opts.underlyingPrice);
    await send(comptroller.priceOracle, 'setUnderlyingPrice', [aToken._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = bnbMantissa(opts.collateralFactor);
    expect(await send(comptroller, '_setCollateralFactor', [aToken._address, factor])).toSucceed();
  }

  return Object.assign(aToken, { name, symbol, underlying, comptroller, interestRateModel });
}

async function makeInterestRateModel(opts = {}) {
  const {
    root = saddle.account,
    kind = 'harnessed'
  } = opts || {};

  if (kind == 'harnessed') {
    const borrowRate = bnbMantissa(dfn(opts.borrowRate, 0));
    return await deploy('InterestRateModelHarness', [borrowRate]);
  }

  if (kind == 'false-marker') {
    const borrowRate = bnbMantissa(dfn(opts.borrowRate, 0));
    return await deploy('FalseMarkerMethodInterestRateModel', [borrowRate]);
  }

  if (kind == 'white-paper') {
    const baseRate = bnbMantissa(dfn(opts.baseRate, 0));
    const multiplier = bnbMantissa(dfn(opts.multiplier, 1e-18));
    return await deploy('WhitePaperInterestRateModel', [baseRate, multiplier]);
  }

  if (kind == 'jump-rate') {
    const baseRate = bnbMantissa(dfn(opts.baseRate, 0));
    const multiplier = bnbMantissa(dfn(opts.multiplier, 1e-18));
    const jump = bnbMantissa(dfn(opts.jump, 0));
    const kink = bnbMantissa(dfn(opts.kink, 0));
    return await deploy('JumpRateModel', [baseRate, multiplier, jump, kink]);
  }
}

async function makePriceOracle(opts = {}) {
  const {
    root = saddle.account,
    kind = 'simple'
  } = opts || {};

  if (kind == 'simple') {
    return await deploy('SimplePriceOracle');
  }
}

async function makeToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'bep20'
  } = opts || {};

  if (kind == 'bep20') {
    const quantity = bnbUnsigned(dfn(opts.quantity, 1e25));
    const decimals = bnbUnsigned(dfn(opts.decimals, 18));
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Bep20 ${symbol}`;
    return await deploy('BEP20Harness', [quantity, name, decimals, symbol]);
  }
}

async function balanceOf(token, account) {
  return bnbUnsigned(await call(token, 'balanceOf', [account]));
}

async function totalSupply(token) {
  return bnbUnsigned(await call(token, 'totalSupply'));
}

async function borrowSnapshot(aToken, account) {
  const { principal, interestIndex } = await call(aToken, 'harnessAccountBorrows', [account]);
  return { principal: bnbUnsigned(principal), interestIndex: bnbUnsigned(interestIndex) };
}

async function totalBorrows(aToken) {
  return bnbUnsigned(await call(aToken, 'totalBorrows'));
}

async function totalReserves(aToken) {
  return bnbUnsigned(await call(aToken, 'totalReserves'));
}

async function enterMarkets(aTokens, from) {
  return await send(aTokens[0].comptroller, 'enterMarkets', [aTokens.map(c => c._address)], { from });
}

async function fastForward(aToken, blocks = 5) {
  return await send(aToken, 'harnessFastForward', [blocks]);
}

async function setBalance(aToken, account, balance) {
  return await send(aToken, 'harnessSetBalance', [account, balance]);
}

async function setBNBBalance(aBnb, balance) {
  const current = await bnbBalance(aBnb._address);
  const root = saddle.account;
  expect(await send(aBnb, 'harnessDoTransferOut', [root, current])).toSucceed();
  expect(await send(aBnb, 'harnessDoTransferIn', [root, balance], { value: balance })).toSucceed();
}

async function getBalances(aTokens, accounts) {
  const balances = {};
  for (let aToken of aTokens) {
    const aBalances = balances[aToken._address] = {};
    for (let account of accounts) {
      aBalances[account] = {
        bnb: await bnbBalance(account),
        cash: aToken.underlying && await balanceOf(aToken.underlying, account),
        tokens: await balanceOf(aToken, account),
        borrows: (await borrowSnapshot(aToken, account)).principal
      };
    }
    aBalances[aToken._address] = {
      bnb: await bnbBalance(aToken._address),
      cash: aToken.underlying && await balanceOf(aToken.underlying, aToken._address),
      tokens: await totalSupply(aToken),
      borrows: await totalBorrows(aToken),
      reserves: await totalReserves(aToken)
    };
  }
  return balances;
}

async function adjustBalances(balances, deltas) {
  for (let delta of deltas) {
    let aToken, account, key, diff;
    if (delta.length == 4) {
      ([aToken, account, key, diff] = delta);
    } else {
      ([aToken, key, diff] = delta);
      account = aToken._address;
    }
    balances[aToken._address][account][key] = balances[aToken._address][account][key].add(diff);
  }
  return balances;
}

async function preApprove(aToken, from, amount, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(aToken.underlying, 'harnessSetBalance', [from, amount], { from })).toSucceed();
  }

  return send(aToken.underlying, 'approve', [aToken._address, amount], { from });
}

async function quickMint(aToken, minter, mintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(aToken, 1);

  if (dfn(opts.approve, true)) {
    expect(await preApprove(aToken, minter, mintAmount, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(aToken, 'harnessSetExchangeRate', [bnbMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(aToken, 'mint', [mintAmount], { from: minter });
}

async function preSupply(aToken, account, tokens, opts = {}) {
  if (dfn(opts.total, true)) {
    expect(await send(aToken, 'harnessSetTotalSupply', [tokens])).toSucceed();
  }
  return send(aToken, 'harnessSetBalance', [account, tokens]);
}

async function quickRedeem(aToken, redeemer, redeemTokens, opts = {}) {
  await fastForward(aToken, 1);

  if (dfn(opts.supply, true)) {
    expect(await preSupply(aToken, redeemer, redeemTokens, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(aToken, 'harnessSetExchangeRate', [bnbMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(aToken, 'redeem', [redeemTokens], { from: redeemer });
}

async function quickRedeemUnderlying(aToken, redeemer, redeemAmount, opts = {}) {
  await fastForward(aToken, 1);

  if (dfn(opts.exchangeRate)) {
    expect(await send(aToken, 'harnessSetExchangeRate', [bnbMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(aToken, 'redeemUnderlying', [redeemAmount], { from: redeemer });
}

async function setOraclePrice(aToken, price) {
  return send(aToken.comptroller.priceOracle, 'setUnderlyingPrice', [aToken._address, bnbMantissa(price)]);
}

async function setOraclePriceFromMantissa(aToken, price) {
  return send(aToken.comptroller.priceOracle, 'setUnderlyingPrice', [aToken._address, price]);
}

async function setBorrowRate(aToken, rate) {
  return send(aToken.interestRateModel, 'setBorrowRate', [bnbMantissa(rate)]);
}

async function getBorrowRate(interestRateModel, cash, borrows, reserves) {
  return call(interestRateModel, 'getBorrowRate', [cash, borrows, reserves].map(bnbUnsigned));
}

async function getSupplyRate(interestRateModel, cash, borrows, reserves, reserveFactor) {
  return call(interestRateModel, 'getSupplyRate', [cash, borrows, reserves, reserveFactor].map(bnbUnsigned));
}

async function pretendBorrow(aToken, borrower, accountIndex, marketIndex, principalRaw, blockNumber = 2e7) {
  await send(aToken, 'harnessSetTotalBorrows', [bnbUnsigned(principalRaw)]);
  await send(aToken, 'harnessSetAccountBorrows', [borrower, bnbUnsigned(principalRaw), bnbMantissa(accountIndex)]);
  await send(aToken, 'harnessSetBorrowIndex', [bnbMantissa(marketIndex)]);
  await send(aToken, 'harnessSetAccrualBlockNumber', [bnbUnsigned(blockNumber)]);
  await send(aToken, 'harnessSetBlockNumber', [bnbUnsigned(blockNumber)]);
}

module.exports = {
  makeComptroller,
  makeAToken,
  makeInterestRateModel,
  makePriceOracle,
  makeToken,

  balanceOf,
  totalSupply,
  borrowSnapshot,
  totalBorrows,
  totalReserves,
  enterMarkets,
  fastForward,
  setBalance,
  setBNBBalance,
  getBalances,
  adjustBalances,

  preApprove,
  quickMint,

  preSupply,
  quickRedeem,
  quickRedeemUnderlying,

  setOraclePrice,
  setOraclePriceFromMantissa,
  setBorrowRate,
  getBorrowRate,
  getSupplyRate,
  pretendBorrow,
};
