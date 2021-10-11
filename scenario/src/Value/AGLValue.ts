import { Event } from '../Event';
import { World } from '../World';
import { AGL } from '../Contract/AGL';
import {
  getAddressA,
  getNumberA
} from '../CoreValue';
import {
  AddressA,
  ListV,
  NumberA,
  StringA,
  Value
} from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { getAGL } from '../ContractLookup';

export function aglFetchers() {
  return [
    new Fetcher<{ agl: AGL }, AddressA>(`
        #### Address

        * "<AGL> Address" - Returns the address of AGL token
          * E.g. "AGL Address"
      `,
      "Address",
      [
        new Arg("agl", getAGL, { implicit: true })
      ],
      async (world, { agl }) => new AddressA(agl._address)
    ),

    new Fetcher<{ agl: AGL }, StringA>(`
        #### Name

        * "<AGL> Name" - Returns the name of the AGL token
          * E.g. "AGL Name"
      `,
      "Name",
      [
        new Arg("agl", getAGL, { implicit: true })
      ],
      async (world, { agl }) => new StringA(await agl.methods.name().call())
    ),

    new Fetcher<{ agl: AGL }, StringA>(`
        #### Symbol

        * "<AGL> Symbol" - Returns the symbol of the AGL token
          * E.g. "AGL Symbol"
      `,
      "Symbol",
      [
        new Arg("agl", getAGL, { implicit: true })
      ],
      async (world, { agl }) => new StringA(await agl.methods.symbol().call())
    ),

    new Fetcher<{ agl: AGL }, NumberA>(`
        #### Decimals

        * "<AGL> Decimals" - Returns the number of decimals of the AGL token
          * E.g. "AGL Decimals"
      `,
      "Decimals",
      [
        new Arg("agl", getAGL, { implicit: true })
      ],
      async (world, { agl }) => new NumberA(await agl.methods.decimals().call())
    ),

    new Fetcher<{ agl: AGL }, NumberA>(`
        #### TotalSupply

        * "AGL TotalSupply" - Returns AGL token's total supply
      `,
      "TotalSupply",
      [
        new Arg("agl", getAGL, { implicit: true })
      ],
      async (world, { agl }) => new NumberA(await agl.methods.totalSupply().call())
    ),

    new Fetcher<{ agl: AGL, address: AddressA }, NumberA>(`
        #### TokenBalance

        * "AGL TokenBalance <Address>" - Returns the AGL token balance of a given address
          * E.g. "AGL TokenBalance Geoff" - Returns Geoff's AGL balance
      `,
      "TokenBalance",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("address", getAddressA)
      ],
      async (world, { agl, address }) => new NumberA(await agl.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ agl: AGL, owner: AddressA, spender: AddressA }, NumberA>(`
        #### Allowance

        * "AGL Allowance owner:<Address> spender:<Address>" - Returns the AGL allowance from owner to spender
          * E.g. "AGL Allowance Geoff Torrey" - Returns the AGL allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("owner", getAddressA),
        new Arg("spender", getAddressA)
      ],
      async (world, { agl, owner, spender }) => new NumberA(await agl.methods.allowance(owner.val, spender.val).call())
    ),

    new Fetcher<{ agl: AGL, account: AddressA }, NumberA>(`
        #### GetCurrentVotes

        * "AGL GetCurrentVotes account:<Address>" - Returns the current AGL votes balance for an account
          * E.g. "AGL GetCurrentVotes Geoff" - Returns the current AGL vote balance of Geoff
      `,
      "GetCurrentVotes",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("account", getAddressA),
      ],
      async (world, { agl, account }) => new NumberA(await agl.methods.getCurrentVotes(account.val).call())
    ),

    new Fetcher<{ agl: AGL, account: AddressA, blockNumber: NumberA }, NumberA>(`
        #### GetPriorVotes

        * "AGL GetPriorVotes account:<Address> blockBumber:<Number>" - Returns the current AGL votes balance at given block
          * E.g. "AGL GetPriorVotes Geoff 5" - Returns the AGL vote balance for Geoff at block 5
      `,
      "GetPriorVotes",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("account", getAddressA),
        new Arg("blockNumber", getNumberA),
      ],
      async (world, { agl, account, blockNumber }) => new NumberA(await agl.methods.getPriorVotes(account.val, blockNumber.encode()).call())
    ),

    new Fetcher<{ agl: AGL, account: AddressA }, NumberA>(`
        #### GetCurrentVotesBlock

        * "AGL GetCurrentVotesBlock account:<Address>" - Returns the current AGL votes checkpoint block for an account
          * E.g. "AGL GetCurrentVotesBlock Geoff" - Returns the current AGL votes checkpoint block for Geoff
      `,
      "GetCurrentVotesBlock",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("account", getAddressA),
      ],
      async (world, { agl, account }) => {
        const numCheckpoints = Number(await agl.methods.numCheckpoints(account.val).call());
        const checkpoint = await agl.methods.checkpoints(account.val, numCheckpoints - 1).call();

        return new NumberA(checkpoint.fromBlock);
      }
    ),

    new Fetcher<{ agl: AGL, account: AddressA }, NumberA>(`
        #### VotesLength

        * "AGL VotesLength account:<Address>" - Returns the AGL vote checkpoint array length
          * E.g. "AGL VotesLength Geoff" - Returns the AGL vote checkpoint array length of Geoff
      `,
      "VotesLength",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("account", getAddressA),
      ],
      async (world, { agl, account }) => new NumberA(await agl.methods.numCheckpoints(account.val).call())
    ),

    new Fetcher<{ agl: AGL, account: AddressA }, ListV>(`
        #### AllVotes

        * "AGL AllVotes account:<Address>" - Returns information about all votes an account has had
          * E.g. "AGL AllVotes Geoff" - Returns the AGL vote checkpoint array
      `,
      "AllVotes",
      [
        new Arg("agl", getAGL, { implicit: true }),
        new Arg("account", getAddressA),
      ],
      async (world, { agl, account }) => {
        const numCheckpoints = Number(await agl.methods.numCheckpoints(account.val).call());
        const checkpoints = await Promise.all(new Array(numCheckpoints).fill(undefined).map(async (_, i) => {
          const {fromBlock, votes} = await agl.methods.checkpoints(account.val, i).call();

          return new StringA(`Block ${fromBlock}: ${votes} vote${votes !== 1 ? "s" : ""}`);
        }));

        return new ListV(checkpoints);
      }
    )
  ];
}

export async function getAGLValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("AGL", aglFetchers(), world, event);
}
