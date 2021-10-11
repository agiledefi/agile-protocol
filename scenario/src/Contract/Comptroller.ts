import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface ComptrollerMethods {
  getAccountLiquidity(string): Callable<{0: number, 1: number, 2: number}>
  getHypotheticalAccountLiquidity(account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Callable<{0: number, 1: number, 2: number}>
  membershipLength(string): Callable<string>
  checkMembership(user: string, aToken: string): Callable<string>
  getAssetsIn(string): Callable<string[]>
  admin(): Callable<string>
  oracle(): Callable<string>
  maxAssets(): Callable<number>
  liquidationIncentiveMantissa(): Callable<number>
  closeFactorMantissa(): Callable<number>
  getBlockNumber(): Callable<number>
  collateralFactor(string): Callable<string>
  markets(string): Callable<{0: boolean, 1: number, 2?: boolean}>
  _setMaxAssets(encodedNumber): Sendable<number>
  _setLiquidationIncentive(encodedNumber): Sendable<number>
  _supportMarket(string): Sendable<number>
  _setPriceOracle(string): Sendable<number>
  _setCollateralFactor(string, encodedNumber): Sendable<number>
  _setCloseFactor(encodedNumber): Sendable<number>
  _setXAIMintRate(encodedNumber): Sendable<number>
  _setXAIController(string): Sendable<number>
  enterMarkets(markets: string[]): Sendable<number>
  exitMarket(market: string): Sendable<number>
  fastForward(encodedNumber): Sendable<number>
  _setPendingImplementation(string): Sendable<number>
  comptrollerImplementation(): Callable<string>
  unlist(string): Sendable<void>
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  _setPendingAdmin(string): Sendable<number>
  _acceptAdmin(): Sendable<number>
  _setProtocolPaused(bool): Sendable<number>
  protocolPaused(): Callable<boolean>
  _addAgileMarkets(markets: string[]): Sendable<void>
  _dropAgileMarket(market: string): Sendable<void>
  getAgileMarkets(): Callable<string[]>
  refreshAgileSpeeds(): Sendable<void>
  agileRate(): Callable<number>
  agileSupplyState(string): Callable<string>
  agileBorrowState(string): Callable<string>
  agileAccrued(string): Callable<string>
  agileSupplierIndex(market: string, account: string): Callable<string>
  agileBorrowerIndex(market: string, account: string): Callable<string>
  agileSpeeds(string): Callable<string>
  claimAgile(string): Sendable<void>
  _setAgileRate(encodedNumber): Sendable<void>
  _setAgileSpeed(aToken: string, encodedNumber): Sendable<void>
  mintedXAIs(string): Callable<number>
  _setMarketBorrowCaps(aTokens:string[], borrowCaps:encodedNumber[]): Sendable<void>
  _setBorrowCapGuardian(string): Sendable<void>
  borrowCapGuardian(): Callable<string>
  borrowCaps(string): Callable<string>
  _setTreasuryData(guardian, address, percent: encodedNumber): Sendable<number>
}

export interface Comptroller extends Contract {
  methods: ComptrollerMethods
}
