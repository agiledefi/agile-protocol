import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {Comptroller} from '../Contract/Comptroller';
import {ComptrollerImpl} from '../Contract/ComptrollerImpl';
import {AToken} from '../Contract/AToken';
import {invoke} from '../Invokation';
import {
  getAddressA,
  getBoolA,
  getEventV,
  getExpNumberA,
  getNumberA,
  getPercentV,
  getStringA,
  getCoreValue
} from '../CoreValue';
import {
  AddressA,
  BoolA,
  EventV,
  NumberA,
  StringA
} from '../Value';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {buildComptrollerImpl} from '../Builder/ComptrollerImplBuilder';
import {ComptrollerErrorReporter} from '../ErrorReporter';
import {getComptroller, getComptrollerImpl} from '../ContractLookup';
import {getLiquidity} from '../Value/ComptrollerValue';
import {getATokenV} from '../Value/ATokenValue';
import {encodedNumber} from '../Encoding';
import {encodeABI, rawValues} from "../Utils";

async function genComptroller(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, comptrollerImpl: comptroller, comptrollerImplData: comptrollerData} = await buildComptrollerImpl(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added Comptroller (${comptrollerData.description}) at address ${comptroller._address}`,
    comptrollerData.invokation
  );

  return world;
};

async function setProtocolPaused(world: World, from: string, comptroller: Comptroller, isPaused: boolean): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setProtocolPaused(isPaused), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: set protocol paused to ${isPaused}`,
    invokation
  );

  return world;
}

async function setMaxAssets(world: World, from: string, comptroller: Comptroller, numberOfAssets: NumberA): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setMaxAssets(numberOfAssets.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set max assets to ${numberOfAssets.show()}`,
    invokation
  );

  return world;
}

async function setLiquidationIncentive(world: World, from: string, comptroller: Comptroller, liquidationIncentive: NumberA): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setLiquidationIncentive(liquidationIncentive.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set liquidation incentive to ${liquidationIncentive.show()}`,
    invokation
  );

  return world;
}

async function supportMarket(world: World, from: string, comptroller: Comptroller, aToken: AToken): Promise<World> {
  if (world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world.printer.printLine(`Dry run: Supporting market  \`${aToken._address}\``);
    return world;
  }

  let invokation = await invoke(world, comptroller.methods._supportMarket(aToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Supported market ${aToken.name}`,
    invokation
  );

  return world;
}

async function unlistMarket(world: World, from: string, comptroller: Comptroller, aToken: AToken): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.unlist(aToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Unlisted market ${aToken.name}`,
    invokation
  );

  return world;
}

async function enterMarkets(world: World, from: string, comptroller: Comptroller, assets: string[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.enterMarkets(assets), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Called enter assets ${assets} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function exitMarket(world: World, from: string, comptroller: Comptroller, asset: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.exitMarket(asset), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Called exit market ${asset} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setPriceOracle(world: World, from: string, comptroller: Comptroller, priceOracleAddr: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPriceOracle(priceOracleAddr), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set price oracle for to ${priceOracleAddr} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setCollateralFactor(world: World, from: string, comptroller: Comptroller, aToken: AToken, collateralFactor: NumberA): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCollateralFactor(aToken._address, collateralFactor.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set collateral factor for ${aToken.name} to ${collateralFactor.show()}`,
    invokation
  );

  return world;
}

async function setCloseFactor(world: World, from: string, comptroller: Comptroller, closeFactor: NumberA): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCloseFactor(closeFactor.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set close factor to ${closeFactor.show()}`,
    invokation
  );

  return world;
}

async function fastForward(world: World, from: string, comptroller: Comptroller, blocks: NumberA): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.fastForward(blocks.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Fast forward ${blocks.show()} blocks to #${invokation.value}`,
    invokation
  );

  return world;
}

async function sendAny(world: World, from:string, comptroller: Comptroller, signature: string, callArgs: string[]): Promise<World> {
  const fnData = encodeABI(world, signature, callArgs);
  await world.web3.eth.sendTransaction({
      to: comptroller._address,
      data: fnData,
      from: from
    })
  return world;
}

async function addAgileMarkets(world: World, from: string, comptroller: Comptroller, aTokens: AToken[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._addAgileMarkets(aTokens.map(c => c._address)), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Added Agile markets ${aTokens.map(c => c.name)}`,
    invokation
  );

  return world;
}

async function dropAgileMarket(world: World, from: string, comptroller: Comptroller, aToken: AToken): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._dropAgileMarket(aToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Drop Agile market ${aToken.name}`,
    invokation
  );

  return world;
}

async function refreshAgileSpeeds(world: World, from: string, comptroller: Comptroller): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.refreshAgileSpeeds(), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Refreshed Agile speeds`,
    invokation
  );

  return world;
}

async function claimAgile(world: World, from: string, comptroller: Comptroller, holder: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.claimAgile(holder), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `AGL claimed by ${holder}`,
    invokation
  );

  return world;
}

async function setAgileRate(world: World, from: string, comptroller: Comptroller, rate: NumberA): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setAgileRate(rate.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `AGL rate set to ${rate.show()}`,
    invokation
  );

  return world;
}

async function setAgileSpeed(world: World, from: string, comptroller: Comptroller, aToken: AToken, speed: NumberA): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setAgileSpeed(aToken._address, speed.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Agile speed for market ${aToken._address} set to ${speed.show()}`,
    invokation
  );

  return world;
}

async function printLiquidity(world: World, comptroller: Comptroller): Promise<World> {
  let enterEvents = await getPastEvents(world, comptroller, 'StdComptroller', 'MarketEntered');
  let addresses = enterEvents.map((event) => event.returnValues['account']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Liquidity:")

  const liquidityMap = await Promise.all(uniq.map(async (address) => {
    let userLiquidity = await getLiquidity(world, comptroller, address);

    return [address, userLiquidity.val];
  }));

  liquidityMap.forEach(([address, liquidity]) => {
    world.printer.printLine(`\t${world.settings.lookupAlias(address)}: ${liquidity / 1e18}e18`)
  });

  return world;
}

async function setPendingAdmin(world: World, from: string, comptroller: Comptroller, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPendingAdmin(newPendingAdmin), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, comptroller: Comptroller): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._acceptAdmin(), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function setMarketBorrowCaps(world: World, from: string, comptroller: Comptroller, aTokens: AToken[], borrowCaps: NumberA[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setMarketBorrowCaps(aTokens.map(c => c._address), borrowCaps.map(c => c.encode())), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Borrow caps on ${aTokens} set to ${borrowCaps}`,
    invokation
  );

  return world;
}

async function setBorrowCapGuardian(world: World, from: string, comptroller: Comptroller, newBorrowCapGuardian: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setBorrowCapGuardian(newBorrowCapGuardian), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets borrow cap guardian to ${newBorrowCapGuardian}`,
    invokation
  );

  return world;
}

async function setTreasuryData(
  world: World,
  from: string,
  comptroller: Comptroller,
  guardian: string,
  address: string,
  percent: NumberA,
): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setTreasuryData(guardian, address, percent.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set treasury data to guardian: ${guardian}, address: ${address}, percent: ${percent.show()}`,
    invokation
  );

  return world;
}

export function comptrollerCommands() {
  return [
    new Command<{comptrollerParams: EventV}>(`
        #### Deploy

        * "Comptroller Deploy ...comptrollerParams" - Generates a new Comptroller (not as Impl)
          * E.g. "Comptroller Deploy YesNo"
      `,
      "Deploy",
      [new Arg("comptrollerParams", getEventV, {variadic: true})],
      (world, from, {comptrollerParams}) => genComptroller(world, from, comptrollerParams.val)
    ),
    new Command<{comptroller: Comptroller, isPaused: BoolA}>(`
        #### SetProtocolPaused

        * "Comptroller SetProtocolPaused <Bool>" - Pauses or unpaused protocol
          * E.g. "Comptroller SetProtocolPaused True"
      `,
      "SetProtocolPaused",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("isPaused", getBoolA)
      ],
      (world, from, {comptroller, isPaused}) => setProtocolPaused(world, from, comptroller, isPaused.val)
    ),
    new Command<{comptroller: Comptroller, aToken: AToken}>(`
        #### SupportMarket

        * "Comptroller SupportMarket <AToken>" - Adds support in the Comptroller for the given aToken
          * E.g. "Comptroller SupportMarket aZRX"
      `,
      "SupportMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("aToken", getATokenV)
      ],
      (world, from, {comptroller, aToken}) => supportMarket(world, from, comptroller, aToken)
    ),
    new Command<{comptroller: Comptroller, aToken: AToken}>(`
        #### UnList

        * "Comptroller UnList <AToken>" - Mock unlists a given market in tests
          * E.g. "Comptroller UnList aZRX"
      `,
      "UnList",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("aToken", getATokenV)
      ],
      (world, from, {comptroller, aToken}) => unlistMarket(world, from, comptroller, aToken)
    ),
    new Command<{comptroller: Comptroller, aTokens: AToken[]}>(`
        #### EnterMarkets

        * "Comptroller EnterMarkets (<AToken> ...)" - User enters the given markets
          * E.g. "Comptroller EnterMarkets (aZRX aBNB)"
      `,
      "EnterMarkets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("aTokens", getATokenV, {mapped: true})
      ],
      (world, from, {comptroller, aTokens}) => enterMarkets(world, from, comptroller, aTokens.map((c) => c._address))
    ),
    new Command<{comptroller: Comptroller, aToken: AToken}>(`
        #### ExitMarket

        * "Comptroller ExitMarket <AToken>" - User exits the given markets
          * E.g. "Comptroller ExitMarket aZRX"
      `,
      "ExitMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("aToken", getATokenV)
      ],
      (world, from, {comptroller, aToken}) => exitMarket(world, from, comptroller, aToken._address)
    ),
    new Command<{comptroller: Comptroller, maxAssets: NumberA}>(`
        #### SetMaxAssets

        * "Comptroller SetMaxAssets <Number>" - Sets (or resets) the max allowed asset count
          * E.g. "Comptroller SetMaxAssets 4"
      `,
      "SetMaxAssets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("maxAssets", getNumberA)
      ],
      (world, from, {comptroller, maxAssets}) => setMaxAssets(world, from, comptroller, maxAssets)
    ),
    new Command<{comptroller: Comptroller, liquidationIncentive: NumberA}>(`
        #### LiquidationIncentive

        * "Comptroller LiquidationIncentive <Number>" - Sets the liquidation incentive
          * E.g. "Comptroller LiquidationIncentive 1.1"
      `,
      "LiquidationIncentive",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("liquidationIncentive", getExpNumberA)
      ],
      (world, from, {comptroller, liquidationIncentive}) => setLiquidationIncentive(world, from, comptroller, liquidationIncentive)
    ),
    new Command<{comptroller: Comptroller, priceOracle: AddressA}>(`
        #### SetPriceOracle

        * "Comptroller SetPriceOracle oracle:<Address>" - Sets the price oracle address
          * E.g. "Comptroller SetPriceOracle 0x..."
      `,
      "SetPriceOracle",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("priceOracle", getAddressA)
      ],
      (world, from, {comptroller, priceOracle}) => setPriceOracle(world, from, comptroller, priceOracle.val)
    ),
    new Command<{comptroller: Comptroller, aToken: AToken, collateralFactor: NumberA}>(`
        #### SetCollateralFactor

        * "Comptroller SetCollateralFactor <AToken> <Number>" - Sets the collateral factor for given aToken to number
          * E.g. "Comptroller SetCollateralFactor aZRX 0.1"
      `,
      "SetCollateralFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("aToken", getATokenV),
        new Arg("collateralFactor", getExpNumberA)
      ],
      (world, from, {comptroller, aToken, collateralFactor}) => setCollateralFactor(world, from, comptroller, aToken, collateralFactor)
    ),
    new Command<{comptroller: Comptroller, closeFactor: NumberA}>(`
        #### SetCloseFactor

        * "Comptroller SetCloseFactor <Number>" - Sets the close factor to given percentage
          * E.g. "Comptroller SetCloseFactor 0.2"
      `,
      "SetCloseFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("closeFactor", getPercentV)
      ],
      (world, from, {comptroller, closeFactor}) => setCloseFactor(world, from, comptroller, closeFactor)
    ),
    new Command<{comptroller: Comptroller, newPendingAdmin: AddressA}>(`
        #### SetPendingAdmin

        * "Comptroller SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the Comptroller
          * E.g. "Comptroller SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("newPendingAdmin", getAddressA)
      ],
      (world, from, {comptroller, newPendingAdmin}) => setPendingAdmin(world, from, comptroller, newPendingAdmin.val)
    ),
    new Command<{comptroller: Comptroller}>(`
        #### AcceptAdmin

        * "Comptroller AcceptAdmin" - Accepts admin for the Comptroller
          * E.g. "From Geoff (Comptroller AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, from, {comptroller}) => acceptAdmin(world, from, comptroller)
    ),
    new Command<{comptroller: Comptroller, blocks: NumberA, _keyword: StringA}>(`
        #### FastForward

        * "FastForward n:<Number> Blocks" - Moves the block number forward "n" blocks. Note: in "ATokenScenario" and "ComptrollerScenario" the current block number is mocked (starting at 100000). This is the only way for the protocol to see a higher block number (for accruing interest).
          * E.g. "Comptroller FastForward 5 Blocks" - Move block number forward 5 blocks.
      `,
      "FastForward",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("blocks", getNumberA),
        new Arg("_keyword", getStringA)
      ],
      (world, from, {comptroller, blocks}) => fastForward(world, from, comptroller, blocks)
    ),
    new View<{comptroller: Comptroller}>(`
        #### Liquidity

        * "Comptroller Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, {comptroller}) => printLiquidity(world, comptroller)
    ),
    new View<{comptroller: Comptroller, input: StringA}>(`
        #### Decode

        * "Decode input:<String>" - Prints information about a call to a Comptroller contract
      `,
      "Decode",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("input", getStringA)

      ],
      (world, {comptroller, input}) => decodeCall(world, comptroller, input.val)
    ),

    new Command<{comptroller: Comptroller, signature: StringA, callArgs: StringA[]}>(`
      #### Send
      * Comptroller Send functionSignature:<String> callArgs[] - Sends any transaction to comptroller
      * E.g: Comptroller Send "setAGLAddress(address)" (Address AGL)
      `,
      "Send",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("signature", getStringA),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      (world, from, {comptroller, signature, callArgs}) => sendAny(world, from, comptroller, signature.val, rawValues(callArgs))
    ),
    new Command<{comptroller: Comptroller, aTokens: AToken[]}>(`
      #### AddAgileMarkets

      * "Comptroller AddAgileMarkets (<Address> ...)" - Makes a market AGL-enabled
      * E.g. "Comptroller AddAgileMarkets (aZRX aBAT)
      `,
      "AddAgileMarkets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("aTokens", getATokenV, {mapped: true})
      ],
      (world, from, {comptroller, aTokens}) => addAgileMarkets(world, from, comptroller, aTokens)
     ),
    new Command<{comptroller: Comptroller, aToken: AToken}>(`
      #### DropAgileMarket

      * "Comptroller DropAgileMarket <Address>" - Makes a market AGL
      * E.g. "Comptroller DropAgileMarket aZRX
      `,
      "DropAgileMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("aToken", getATokenV)
      ],
      (world, from, {comptroller, aToken}) => dropAgileMarket(world, from, comptroller, aToken)
     ),

    new Command<{comptroller: Comptroller}>(`
      #### RefreshAgileSpeeds

      * "Comptroller RefreshAgileSpeeds" - Recalculates all the Agile market speeds
      * E.g. "Comptroller RefreshAgileSpeeds
      `,
      "RefreshAgileSpeeds",
      [
        new Arg("comptroller", getComptroller, {implicit: true})
      ],
      (world, from, {comptroller}) => refreshAgileSpeeds(world, from, comptroller)
    ),
    new Command<{comptroller: Comptroller, holder: AddressA}>(`
      #### ClaimAgile

      * "Comptroller ClaimAgile <holder>" - Claims agl
      * E.g. "Comptroller ClaimAgile Geoff
      `,
      "ClaimAgile",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("holder", getAddressA)
      ],
      (world, from, {comptroller, holder}) => claimAgile(world, from, comptroller, holder.val)
    ),
    new Command<{comptroller: Comptroller, rate: NumberA}>(`
      #### SetAgileRate

      * "Comptroller SetAgileRate <rate>" - Sets Agile rate
      * E.g. "Comptroller SetAgileRate 1e18
      `,
      "SetAgileRate",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("rate", getNumberA)
      ],
      (world, from, {comptroller, rate}) => setAgileRate(world, from, comptroller, rate)
    ),
    new Command<{comptroller: Comptroller, aToken: AToken, speed: NumberA}>(`
      #### SetAgileSpeed
      * "Comptroller SetAgileSpeed <aToken> <rate>" - Sets AGL speed for market
      * E.g. "Comptroller SetAgileSpeed aToken 1000
      `,
      "SetAgileSpeed",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("aToken", getATokenV),
        new Arg("speed", getNumberA)
      ],
      (world, from, {comptroller, aToken, speed}) => setAgileSpeed(world, from, comptroller, aToken, speed)
    ),
    new Command<{comptroller: Comptroller, aTokens: AToken[], borrowCaps: NumberA[]}>(`
      #### SetMarketBorrowCaps
      * "Comptroller SetMarketBorrowCaps (<AToken> ...) (<borrowCap> ...)" - Sets Market Borrow Caps
      * E.g "Comptroller SetMarketBorrowCaps (aZRX aUSDC) (10000.0e18, 1000.0e6)
      `,
      "SetMarketBorrowCaps",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("aTokens", getATokenV, {mapped: true}),
        new Arg("borrowCaps", getNumberA, {mapped: true})
      ],
      (world, from, {comptroller,aTokens,borrowCaps}) => setMarketBorrowCaps(world, from, comptroller, aTokens, borrowCaps)
    ),
    new Command<{comptroller: Comptroller, newBorrowCapGuardian: AddressA}>(`
        #### SetBorrowCapGuardian
        * "Comptroller SetBorrowCapGuardian newBorrowCapGuardian:<Address>" - Sets the Borrow Cap Guardian for the Comptroller
          * E.g. "Comptroller SetBorrowCapGuardian Geoff"
      `,
      "SetBorrowCapGuardian",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("newBorrowCapGuardian", getAddressA)
      ],
      (world, from, {comptroller, newBorrowCapGuardian}) => setBorrowCapGuardian(world, from, comptroller, newBorrowCapGuardian.val)
    ),
    new Command<{comptroller: Comptroller, guardian: AddressA, address: AddressA, percent: NumberA}>(`
      #### SetTreasuryData
      * "Comptroller SetTreasuryData <guardian> <address> <rate>" - Sets Treasury Data
      * E.g. "Comptroller SetTreasuryData 0x.. 0x.. 1e18
      `,
      "SetTreasuryData",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("guardian", getAddressA),
        new Arg("address", getAddressA),
        new Arg("percent", getNumberA)
      ],
      (world, from, {comptroller, guardian, address, percent}) => setTreasuryData(world, from, comptroller, guardian.val, address.val, percent)
    )
  ];
}

export async function processComptrollerEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Comptroller", comptrollerCommands(), world, event, from);
}
