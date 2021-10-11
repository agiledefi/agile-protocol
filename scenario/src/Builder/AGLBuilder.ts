import { Event } from '../Event';
import { World, addAction } from '../World';
import { AGL, AGLScenario } from '../Contract/AGL';
import { Invokation } from '../Invokation';
import { getAddressA } from '../CoreValue';
import { StringA, AddressA } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const AGLContract = getContract('AGL');
const AGLScenarioContract = getContract('AGLScenario');

export interface TokenData {
  invokation: Invokation<AGL>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildAGL(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; agl: AGL; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressA }, TokenData>(
      `
      #### Scenario

      * "AGL Deploy Scenario account:<Address>" - Deploys Scenario AGL Token
        * E.g. "AGL Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressA),
      ],
      async (world, { account }) => {
        return {
          invokation: await AGLScenarioContract.deploy<AGLScenario>(world, from, [account.val]),
          contract: 'AGLScenario',
          symbol: 'AGL',
          name: 'Agile Governance Token',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressA }, TokenData>(
      `
      #### AGL

      * "AGL Deploy account:<Address>" - Deploys AGL Token
        * E.g. "AGL Deploy Geoff"
    `,
      'AGL',
      [
        new Arg("account", getAddressA),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await AGLScenarioContract.deploy<AGLScenario>(world, from, [account.val]),
            contract: 'AGLScenario',
            symbol: 'AGL',
            name: 'Agile Governance Token',
            decimals: 18
          };
        } else {
          return {
            invokation: await AGLContract.deploy<AGL>(world, from, [account.val]),
            contract: 'AGL',
            symbol: 'AGL',
            name: 'Agile Governance Token',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployAGL", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const agl = invokation.value!;
  tokenData.address = agl._address;

  world = await storeAndSaveContract(
    world,
    agl,
    'AGL',
    invokation,
    [
      { index: ['AGL'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, agl, tokenData };
}
