import { Event } from '../Event';
import { World } from '../World';
import { ABep20Delegator, ABep20DelegatorScenario } from '../Contract/ABep20Delegator';
import { AToken } from '../Contract/AToken';
import { Invokation, invoke } from '../Invokation';
import { getAddressA, getExpNumberA, getNumberA, getStringA } from '../CoreValue';
import { AddressA, NumberA, StringA } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const ABep20Contract = getContract('ABep20Immutable');
const ABep20Delegator = getContract('ABep20Delegator');
const ABep20DelegatorScenario = getTestContract('ABep20DelegatorScenario');
const ABNBContract = getContract('ABNB');
const ABep20ScenarioContract = getTestContract('ABep20Scenario');
const ABNBScenarioContract = getTestContract('ABNBScenario');
const CEvilContract = getTestContract('AEvil');

export interface TokenData {
  invokation: Invokation<AToken>;
  name: string;
  symbol: string;
  decimals?: number;
  underlying?: string;
  address?: string;
  contract: string;
  initial_exchange_rate_mantissa?: string;
  admin?: string;
}

export async function buildAToken(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; aToken: AToken; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<
      {
        symbol: StringA;
        name: StringA;
        decimals: NumberA;
        underlying: AddressA;
        comptroller: AddressA;
        interestRateModel: AddressA;
        initialExchangeRate: NumberA;
        admin: AddressA;
        implementation: AddressA;
        becomeImplementationData: StringA;
      },
      TokenData
    >(
    `
      #### ABep20Delegator

      * "ABep20Delegator symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address> implementation:<Address> becomeImplementationData:<String>" - The real deal AToken
        * E.g. "AToken Deploy ABep20Delegator aDAI \"Agile DAI\" (Bep20 DAI Address) (Comptroller Address) (InterestRateModel Address) 1.0 8 Geoff (AToken ADaiDelegate Address) "0x0123434anyByTes314535q" "
    `,
      'ABep20Delegator',
      [
        new Arg('symbol', getStringA),
        new Arg('name', getStringA),
        new Arg('underlying', getAddressA),
        new Arg('comptroller', getAddressA),
        new Arg('interestRateModel', getAddressA),
        new Arg('initialExchangeRate', getExpNumberA),
        new Arg('decimals', getNumberA),
        new Arg('admin', getAddressA),
        new Arg('implementation', getAddressA),
        new Arg('becomeImplementationData', getStringA)
      ],
      async (
        world,
        {
          symbol,
          name,
          underlying,
          comptroller,
          interestRateModel,
          initialExchangeRate,
          decimals,
          admin,
          implementation,
          becomeImplementationData
        }
      ) => {
        return {
          invokation: await ABep20Delegator.deploy<ABep20Delegator>(world, from, [
            underlying.val,
            comptroller.val,
            interestRateModel.val,
            initialExchangeRate.val,
            name.val,
            symbol.val,
            decimals.val,
            admin.val,
            implementation.val,
            becomeImplementationData.val
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: 'ABep20Delegator',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val
        };
      }
    ),

    new Fetcher<
      {
        symbol: StringA;
        name: StringA;
        decimals: NumberA;
        underlying: AddressA;
        comptroller: AddressA;
        interestRateModel: AddressA;
        initialExchangeRate: NumberA;
        admin: AddressA;
        implementation: AddressA;
        becomeImplementationData: StringA;
      },
      TokenData
    >(
    `
      #### ABep20DelegatorScenario

      * "ABep20DelegatorScenario symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address> implementation:<Address> becomeImplementationData:<String>" - A AToken Scenario for local testing
        * E.g. "AToken Deploy ABep20DelegatorScenario aDAI \"Agile DAI\" (Bep20 DAI Address) (Comptroller Address) (InterestRateModel Address) 1.0 8 Geoff (AToken ADaiDelegate Address) "0x0123434anyByTes314535q" "
    `,
      'ABep20DelegatorScenario',
      [
        new Arg('symbol', getStringA),
        new Arg('name', getStringA),
        new Arg('underlying', getAddressA),
        new Arg('comptroller', getAddressA),
        new Arg('interestRateModel', getAddressA),
        new Arg('initialExchangeRate', getExpNumberA),
        new Arg('decimals', getNumberA),
        new Arg('admin', getAddressA),
        new Arg('implementation', getAddressA),
        new Arg('becomeImplementationData', getStringA)
      ],
      async (
        world,
        {
          symbol,
          name,
          underlying,
          comptroller,
          interestRateModel,
          initialExchangeRate,
          decimals,
          admin,
          implementation,
          becomeImplementationData
        }
      ) => {
        return {
          invokation: await ABep20DelegatorScenario.deploy<ABep20DelegatorScenario>(world, from, [
            underlying.val,
            comptroller.val,
            interestRateModel.val,
            initialExchangeRate.val,
            name.val,
            symbol.val,
            decimals.val,
            admin.val,
            implementation.val,
            becomeImplementationData.val
          ]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: 'ABep20DelegatorScenario',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val
        };
      }
    ),

    new Fetcher<{symbol: StringA, name: StringA, decimals: NumberA, underlying: AddressA, comptroller: AddressA, interestRateModel: AddressA, initialExchangeRate: NumberA, admin: AddressA}, TokenData>(`
        #### Scenario

        * "Scenario symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A AToken Scenario for local testing
          * E.g. "AToken Deploy Scenario aZRX \"Agile ZRX\" (Bep20 ZRX Address) (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "Scenario",
      [
        new Arg("symbol", getStringA),
        new Arg("name", getStringA),
        new Arg("underlying", getAddressA),
        new Arg("comptroller", getAddressA),
        new Arg("interestRateModel", getAddressA),
        new Arg("initialExchangeRate", getExpNumberA),
        new Arg("decimals", getNumberA),
        new Arg("admin", getAddressA)
      ],
      async (world, {symbol, name, underlying, comptroller, interestRateModel, initialExchangeRate, decimals, admin}) => {
        return {
          invokation: await ABep20ScenarioContract.deploy<AToken>(world, from, [underlying.val, comptroller.val, interestRateModel.val, initialExchangeRate.val, name.val, symbol.val, decimals.val, admin.val]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: 'ABep20Scenario',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val
        };
      }
    ),

    new Fetcher<{symbol: StringA, name: StringA, decimals: NumberA, admin: AddressA, comptroller: AddressA, interestRateModel: AddressA, initialExchangeRate: NumberA}, TokenData>(`
        #### ABNBScenario

        * "ABNBScenario symbol:<String> name:<String> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A AToken Scenario for local testing
          * E.g. "AToken Deploy ABNBScenario aBNB \"Agile BNB\" (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "ABNBScenario",
      [
        new Arg("symbol", getStringA),
        new Arg("name", getStringA),
        new Arg("comptroller", getAddressA),
        new Arg("interestRateModel", getAddressA),
        new Arg("initialExchangeRate", getExpNumberA),
        new Arg("decimals", getNumberA),
        new Arg("admin", getAddressA)
      ],
      async (world, {symbol, name, comptroller, interestRateModel, initialExchangeRate, decimals, admin}) => {
        return {
          invokation: await ABNBScenarioContract.deploy<AToken>(world, from, [name.val, symbol.val, decimals.val, admin.val, comptroller.val, interestRateModel.val, initialExchangeRate.val]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: "",
          contract: 'ABNBScenario',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val
        };
      }
    ),

    new Fetcher<{symbol: StringA, name: StringA, decimals: NumberA, admin: AddressA, comptroller: AddressA, interestRateModel: AddressA, initialExchangeRate: NumberA}, TokenData>(`
        #### ABNB

        * "ABNB symbol:<String> name:<String> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A AToken Scenario for local testing
          * E.g. "AToken Deploy ABNB aBNB \"Agile BNB\" (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "ABNB",
      [
        new Arg("symbol", getStringA),
        new Arg("name", getStringA),
        new Arg("comptroller", getAddressA),
        new Arg("interestRateModel", getAddressA),
        new Arg("initialExchangeRate", getExpNumberA),
        new Arg("decimals", getNumberA),
        new Arg("admin", getAddressA)
      ],
      async (world, {symbol, name, comptroller, interestRateModel, initialExchangeRate, decimals, admin}) => {
        return {
          invokation: await ABNBContract.deploy<AToken>(world, from, [comptroller.val, interestRateModel.val, initialExchangeRate.val, name.val, symbol.val, decimals.val, admin.val]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: "",
          contract: 'ABNB',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val
        };
      }
    ),

    new Fetcher<{symbol: StringA, name: StringA, decimals: NumberA, admin: AddressA, underlying: AddressA, comptroller: AddressA, interestRateModel: AddressA, initialExchangeRate: NumberA}, TokenData>(`
        #### ABep20

        * "ABep20 symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A official AToken contract
          * E.g. "AToken Deploy ABep20 aZRX \"Agile ZRX\" (Bep20 ZRX Address) (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "ABep20",
      [
        new Arg("symbol", getStringA),
        new Arg("name", getStringA),
        new Arg("underlying", getAddressA),
        new Arg("comptroller", getAddressA),
        new Arg("interestRateModel", getAddressA),
        new Arg("initialExchangeRate", getExpNumberA),
        new Arg("decimals", getNumberA),
        new Arg("admin", getAddressA)
      ],
      async (world, {symbol, name, underlying, comptroller, interestRateModel, initialExchangeRate, decimals, admin}) => {

        return {
          invokation: await ABep20Contract.deploy<AToken>(world, from, [underlying.val, comptroller.val, interestRateModel.val, initialExchangeRate.val, name.val, symbol.val, decimals.val, admin.val]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: 'ABep20',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val
        };
      }
    ),

    new Fetcher<{symbol: StringA, name: StringA, decimals: NumberA, admin: AddressA, underlying: AddressA, comptroller: AddressA, interestRateModel: AddressA, initialExchangeRate: NumberA}, TokenData>(`
        #### AEvil

        * "AEvil symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A malicious AToken contract
          * E.g. "AToken Deploy AEvil aEVL \"Agile EVL\" (Bep20 ZRX Address) (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "AEvil",
      [
        new Arg("symbol", getStringA),
        new Arg("name", getStringA),
        new Arg("underlying", getAddressA),
        new Arg("comptroller", getAddressA),
        new Arg("interestRateModel", getAddressA),
        new Arg("initialExchangeRate", getExpNumberA),
        new Arg("decimals", getNumberA),
        new Arg("admin", getAddressA)
      ],
      async (world, {symbol, name, underlying, comptroller, interestRateModel, initialExchangeRate, decimals, admin}) => {
        return {
          invokation: await CEvilContract.deploy<AToken>(world, from, [underlying.val, comptroller.val, interestRateModel.val, initialExchangeRate.val, name.val, symbol.val, decimals.val, admin.val]),
          name: name.val,
          symbol: symbol.val,
          decimals: decimals.toNumber(),
          underlying: underlying.val,
          contract: 'AEvil',
          initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
          admin: admin.val
        };
      }
    ),

    new Fetcher<{symbol: StringA, name: StringA, decimals: NumberA, admin: AddressA, underlying: AddressA, comptroller: AddressA, interestRateModel: AddressA, initialExchangeRate: NumberA}, TokenData>(`
        #### Standard

        * "symbol:<String> name:<String> underlying:<Address> comptroller:<Address> interestRateModel:<Address> initialExchangeRate:<Number> decimals:<Number> admin: <Address>" - A official AToken contract
          * E.g. "AToken Deploy Standard aZRX \"Agile ZRX\" (Bep20 ZRX Address) (Comptroller Address) (InterestRateModel Address) 1.0 8"
      `,
      "Standard",
      [
        new Arg("symbol", getStringA),
        new Arg("name", getStringA),
        new Arg("underlying", getAddressA),
        new Arg("comptroller", getAddressA),
        new Arg("interestRateModel", getAddressA),
        new Arg("initialExchangeRate", getExpNumberA),
        new Arg("decimals", getNumberA),
        new Arg("admin", getAddressA)
      ],
      async (world, {symbol, name, underlying, comptroller, interestRateModel, initialExchangeRate, decimals, admin}) => {
        // Note: we're going to use the scenario contract as the standard deployment on local networks
        if (world.isLocalNetwork()) {
          return {
            invokation: await ABep20ScenarioContract.deploy<AToken>(world, from, [underlying.val, comptroller.val, interestRateModel.val, initialExchangeRate.val, name.val, symbol.val, decimals.val, admin.val]),
            name: name.val,
            symbol: symbol.val,
            decimals: decimals.toNumber(),
            underlying: underlying.val,
            contract: 'ABep20Scenario',
            initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
            admin: admin.val
          };
        } else {
          return {
            invokation: await ABep20Contract.deploy<AToken>(world, from, [underlying.val, comptroller.val, interestRateModel.val, initialExchangeRate.val, name.val, symbol.val, decimals.val, admin.val]),
            name: name.val,
            symbol: symbol.val,
            decimals: decimals.toNumber(),
            underlying: underlying.val,
            contract: 'ABep20Immutable',
            initial_exchange_rate_mantissa: initialExchangeRate.encode().toString(),
            admin: admin.val
          };
        }
      },
      {catchall: true}
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployAToken", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const aToken = invokation.value!;
  tokenData.address = aToken._address;

  world = await storeAndSaveContract(
    world,
    aToken,
    tokenData.symbol,
    invokation,
    [
      { index: ['aTokens', tokenData.symbol], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  return {world, aToken, tokenData};
}
