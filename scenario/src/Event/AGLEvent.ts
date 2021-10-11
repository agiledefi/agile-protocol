import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { AGL, AGLScenario } from '../Contract/AGL';
import { buildAGL } from '../Builder/AGLBuilder';
import { invoke } from '../Invokation';
import {
  getAddressA,
  getEventV,
  getNumberA,
  getStringA,
} from '../CoreValue';
import {
  AddressA,
  EventV,
  NumberA,
  StringA
} from '../Value';
import { Arg, Command, processCommandEvent, View } from '../Command';
import { getAGL } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genAGL(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, agl, tokenData } = await buildAGL(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed AGL (${agl.name}) to address ${agl._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyAGL(world: World, agl: AGL, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, agl._address);
  }

  return world;
}

async function approve(world: World, from: string, agl: AGL, address: string, amount: NumberA): Promise<World> {
  let invokation = await invoke(world, agl.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved AGL token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, agl: AGL, address: string, amount: NumberA): Promise<World> {
  let invokation = await invoke(world, agl.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} AGL tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, agl: AGL, owner: string, spender: string, amount: NumberA): Promise<World> {
  let invokation = await invoke(world, agl.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} AGL tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, agl: AGLScenario, addresses: string[], amount: NumberA): Promise<World> {
  let invokation = await invoke(world, agl.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} AGL tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, agl: AGLScenario, addresses: string[], amount: NumberA): Promise<World> {
  let invokation = await invoke(world, agl.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} AGL tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

async function delegate(world: World, from: string, agl: AGL, account: string): Promise<World> {
  let invokation = await invoke(world, agl.methods.delegate(account), from, NoErrorReporter);

  world = addAction(
    world,
    `"Delegated from" ${from} to ${account}`,
    invokation
  );

  return world;
}

async function setBlockNumber(
  world: World,
  from: string,
  agl: AGL,
  blockNumber: NumberA
): Promise<World> {
  return addAction(
    world,
    `Set AGL blockNumber to ${blockNumber.show()}`,
    await invoke(world, agl.methods.setBlockNumber(blockNumber.encode()), from)
  );
}

export function aglCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new AGL token
          * E.g. "AGL Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genAGL(world, from, params.val)
    ),

    new View<{ agl: AGL, apiKey: StringA, contractName: StringA }>(`
        #### Verify

        * "<AGL> Verify apiKey:<String> contractName:<String>=AGL" - Verifies AGL token in BscScan
          * E.g. "AGL Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("apiKey", getStringA),
        new Arg("contractName", getStringA, { default: new StringA("AGL") })
      ],
      async (world, { agl, apiKey, contractName }) => {
        return await verifyAGL(world, agl, apiKey.val, agl.name, contractName.val)
      }
    ),

    new Command<{ agl: AGL, spender: AddressA, amount: NumberA }>(`
        #### Approve

        * "AGL Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "AGL Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("spender", getAddressA),
        new Arg("amount", getNumberA)
      ],
      (world, from, { agl, spender, amount }) => {
        return approve(world, from, agl, spender.val, amount)
      }
    ),

    new Command<{ agl: AGL, recipient: AddressA, amount: NumberA }>(`
        #### Transfer

        * "AGL Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "AGL Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("recipient", getAddressA),
        new Arg("amount", getNumberA)
      ],
      (world, from, { agl, recipient, amount }) => transfer(world, from, agl, recipient.val, amount)
    ),

    new Command<{ agl: AGL, owner: AddressA, spender: AddressA, amount: NumberA }>(`
        #### TransferFrom

        * "AGL TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "AGL TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("owner", getAddressA),
        new Arg("spender", getAddressA),
        new Arg("amount", getNumberA)
      ],
      (world, from, { agl, owner, spender, amount }) => transferFrom(world, from, agl, owner.val, spender.val, amount)
    ),

    new Command<{ agl: AGLScenario, recipients: AddressA[], amount: NumberA }>(`
        #### TransferScenario

        * "AGL TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "AGL TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("recipients", getAddressA, { mapped: true }),
        new Arg("amount", getNumberA)
      ],
      (world, from, { agl, recipients, amount }) => transferScenario(world, from, agl, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ agl: AGLScenario, froms: AddressA[], amount: NumberA }>(`
        #### TransferFromScenario

        * "AGL TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "AGL TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("froms", getAddressA, { mapped: true }),
        new Arg("amount", getNumberA)
      ],
      (world, from, { agl, froms, amount }) => transferFromScenario(world, from, agl, froms.map(_from => _from.val), amount)
    ),

    new Command<{ agl: AGL, account: AddressA }>(`
        #### Delegate

        * "AGL Delegate account:<Address>" - Delegates votes to a given account
          * E.g. "AGL Delegate Torrey"
      `,
      "Delegate",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("account", getAddressA),
      ],
      (world, from, { agl, account }) => delegate(world, from, agl, account.val)
    ),
    new Command<{ agl: AGL, blockNumber: NumberA }>(`
      #### SetBlockNumber

      * "SetBlockNumber <Seconds>" - Sets the blockTimestamp of the AGL Harness
      * E.g. "AGL SetBlockNumber 500"
      `,
        'SetBlockNumber',
        [new Arg('agl', getAGL, { implicit: true }), new Arg('blockNumber', getNumberA)],
        (world, from, { agl, blockNumber }) => setBlockNumber(world, from, agl, blockNumber)
      )
  ];
}

export async function processAGLEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("AGL", aglCommands(), world, event, from);
}
